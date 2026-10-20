/**
 * Deterministic risk baseline + evidence record tests.
 * No Collector / Docker required.
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildExecutionEvidenceRecord,
  EVIDENCE_SCHEMA_VERSION,
  type ExecutionEvidenceRecord,
} from "../src/risk/evidence.ts";
import { classifyEvidence } from "../src/risk/deterministic.ts";
import {
  classifyFromMatches,
  evaluateDeterministicRules,
  RULE_VERSION,
} from "../src/risk/rules.ts";

function baseEvidence(
  overrides: Partial<ExecutionEvidenceRecord> = {},
): ExecutionEvidenceRecord {
  return {
    evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
    executionId: "exec-1",
    traceId: "a".repeat(32),
    script: { language: "javascript", permissionProfile: "none" },
    runtime: {
      runtime: "deno",
      runtimeVersion: "2.9.7",
      containerRuntime: "runc",
      provider: "docker",
      durationMs: 50,
      exitCode: 0,
      timedOut: false,
      outputTruncated: false,
    },
    permissions: {
      accesses: [],
      failureCategory: null,
      auditTruncated: false,
    },
    hostApi: { requested: [], allowed: [], denied: [], queued: [] },
    resources: { timedOut: false, outputTruncated: false },
    termination: { status: "completed", reason: null },
    provenance: ["application"],
    ...overrides,
  };
}

Deno.test("evidence schema version is 1", () => {
  const ev = buildExecutionEvidenceRecord({
    executionId: "e1",
    status: "completed",
    language: "javascript",
    permissionProfile: "none",
    result: {
      provider: "docker",
      durationMs: 10,
      exitCode: 0,
      timedOut: false,
      outputTruncated: false,
      permissionEvents: [{
        permission: "read",
        target: "/fixtures/allowed.txt",
        source: "deno_permission_audit",
      }],
      stdout: "ok",
    },
  });
  assertEquals(ev.evidenceSchemaVersion, 1);
  assertEquals(ev.permissions.accesses[0].source, "deno_permission_audit");
  assertEquals(ev.provenance.includes("script_output"), true);
  assertEquals(ev.untrustedContext?.stdoutPreview, "ok");
});

Deno.test("normal completion is LOW (R010)", () => {
  const r = classifyEvidence(baseEvidence());
  assertEquals(r.classification, "low");
  assertEquals(r.provider, "deterministic");
  assertEquals(r.analyzerVersion, RULE_VERSION);
  assertStringIncludes(r.reasons[0], "R010");
});

Deno.test("timeout is HIGH (R006)", () => {
  const r = classifyEvidence(baseEvidence({
    runtime: {
      ...baseEvidence().runtime,
      timedOut: true,
      exitCode: null,
    },
    resources: { timedOut: true, outputTruncated: false },
    termination: { status: "terminated", reason: "timeout" },
  }));
  assertEquals(r.classification, "high");
  assertEquals(r.ruleMatches.some((m) => m.ruleId === "R006"), true);
});

Deno.test("completed + restricted read is REVIEW (R009)", () => {
  const r = classifyEvidence(baseEvidence({
    permissions: {
      accesses: [{
        permission: "read",
        target: "/etc/hosts",
        source: "deno_permission_audit",
      }],
      failureCategory: null,
      auditTruncated: false,
    },
    termination: { status: "completed", reason: null },
  }));
  assertEquals(r.classification, "review");
  assertEquals(r.ruleMatches.some((m) => m.ruleId === "R009"), true);
});

Deno.test("stdout hack keywords alone do not escalate", () => {
  const r = classifyEvidence(baseEvidence({
    untrustedContext: {
      stdoutPreview: "I hacked the server permission denied",
    },
  }));
  assertEquals(r.classification, "low");
});

Deno.test("host denial is REVIEW; repeated/budget is HIGH", () => {
  const one = classifyEvidence(baseEvidence({
    hostApi: {
      requested: [{ capability: "chat.broadcast", callId: "c1" }],
      allowed: [],
      denied: [{
        capability: "chat.broadcast",
        callId: "c1",
        reason: "message_empty",
      }],
      queued: [],
    },
  }));
  assertEquals(one.classification, "review");

  const budget = classifyEvidence(baseEvidence({
    hostApi: {
      requested: [],
      allowed: [],
      denied: [{
        capability: "chat.broadcast",
        callId: "c2",
        reason: "budget_exhausted",
      }],
      queued: [],
    },
  }));
  assertEquals(budget.classification, "high");
  assertEquals(budget.ruleMatches.some((m) => m.ruleId === "R005"), true);
});

Deno.test("ffi access is HIGH; multiple reasons retained", () => {
  const r = classifyEvidence(baseEvidence({
    permissions: {
      accesses: [{
        permission: "ffi",
        target: "x.so",
        source: "deno_permission_audit",
      }],
      failureCategory: "deno_permission",
      auditTruncated: false,
    },
    resources: { timedOut: true, outputTruncated: false },
    runtime: { ...baseEvidence().runtime, timedOut: true },
  }));
  assertEquals(r.classification, "high");
  const ids = r.ruleMatches.map((m) => m.ruleId).sort();
  assertEquals(ids.includes("R001"), true);
  assertEquals(ids.includes("R003"), true);
  assertEquals(ids.includes("R006"), true);
});

Deno.test("HIGH overrides REVIEW in precedence helper", () => {
  const matches = evaluateDeterministicRules(baseEvidence({
    permissions: {
      accesses: [{
        permission: "read",
        target: "/etc/hosts",
        source: "deno_permission_audit",
      }],
      failureCategory: null,
      auditTruncated: false,
    },
    resources: { timedOut: true, outputTruncated: false },
    runtime: { ...baseEvidence().runtime, timedOut: true },
  }));
  const { classification } = classifyFromMatches(matches);
  assertEquals(classification, "high");
});

Deno.test("same evidence always yields same result", () => {
  const ev = baseEvidence({
    permissions: {
      accesses: [{
        permission: "read",
        target: "/etc/passwd",
        source: "deno_permission_audit",
      }],
      failureCategory: null,
      auditTruncated: false,
    },
  });
  const a = classifyEvidence(ev);
  const b = classifyEvidence(ev);
  assertEquals(a.classification, b.classification);
  assertEquals(a.score, b.score);
  assertEquals(a.reasons, b.reasons);
});

Deno.test("scenarioId / referenceLabel cannot influence classifier", async () => {
  const { DeterministicRiskAnalyzer } = await import(
    "../src/risk/deterministic.ts"
  );
  const analyzer = new DeterministicRiskAnalyzer();
  const evidence = baseEvidence();
  const a = await analyzer.analyze({
    scriptVersionId: "v",
    language: "javascript",
    evidence,
    scenarioId: "SCN-011",
    referenceLabel: "high",
  });
  assertEquals(a.classification, "low");
});

Deno.test("authorized host-chat env/net alone stays LOW", () => {
  const r = classifyEvidence(baseEvidence({
    script: { language: "javascript", permissionProfile: "host-chat" },
    permissions: {
      accesses: [
        {
          permission: "env",
          target: "HOST_CAPABILITY_TOKEN",
          source: "deno_permission_audit",
        },
        {
          permission: "net",
          target: "host-gateway:3200",
          source: "deno_permission_audit",
        },
      ],
      failureCategory: null,
      auditTruncated: false,
    },
    hostApi: {
      requested: [{ capability: "chat.broadcast", callId: "c1" }],
      allowed: [{ capability: "chat.broadcast", callId: "c1" }],
      denied: [],
      queued: [{
        capability: "chat.broadcast",
        callId: "c1",
        commandId: "cmd-1",
      }],
    },
  }));
  assertEquals(r.classification, "low");
});
