/**
 * JevRiskAnalyzer adapter tests — mocked network only (no credits).
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { EVIDENCE_SCHEMA_VERSION, type ExecutionEvidenceRecord } from "../src/risk/evidence.ts";
import {
  buildJevRiskState,
  evidenceFactReasons,
  jevStateLooksSafe,
  presentJevState,
} from "../src/risk/jev-input.ts";
import {
  buildJevSystemOneRequest,
  JevRiskAnalyzer,
  mapChoiceToClassification,
  parseJevChoiceAnswer,
} from "../src/risk/jev.ts";
import { classifyEvidence } from "../src/risk/deterministic.ts";
import { classifyEvidenceComparison } from "../src/risk/comparison.ts";
import { createRiskAnalyzer } from "../src/providers/risk.ts";

function baseEvidence(
  overrides: Partial<ExecutionEvidenceRecord> = {},
): ExecutionEvidenceRecord {
  return {
    evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
    executionId: "exec-jev-1",
    traceId: "b".repeat(32),
    script: { language: "javascript", permissionProfile: "none" },
    runtime: {
      runtime: "deno",
      runtimeVersion: "2.9.7",
      containerRuntime: "runc",
      provider: "docker",
      durationMs: 40,
      exitCode: 0,
      timedOut: false,
      outputTruncated: false,
    },
    permissions: {
      accesses: [{
        permission: "ffi",
        target: null,
        source: "deno_permission_audit",
      }],
      failureCategory: "deno_permission",
      auditTruncated: false,
    },
    hostApi: { requested: [], allowed: [], denied: [], queued: [] },
    resources: { timedOut: false, outputTruncated: false },
    termination: { status: "failed", reason: "deno_permission" },
    provenance: ["application", "deno_permission_audit"],
    untrustedContext: {
      stdoutPreview: "should-not-appear-in-jev-state",
      stderrPreview: "secret-looking",
    },
    ...overrides,
  };
}

Deno.test("createRiskAnalyzer(jev) returns JevRiskAnalyzer (not silent deterministic)", () => {
  const a = createRiskAnalyzer("jev");
  assertEquals(a.name, "jev");
});

Deno.test("Jev state excludes untrusted stdout and forbidden research fields", () => {
  const ev = baseEvidence();
  const wider = {
    ...ev,
    scenarioId: "SCN-010",
    expectedResearchLabel: "high",
    holdout: true,
  } as ExecutionEvidenceRecord;
  const state = buildJevRiskState(wider);
  const blob = JSON.stringify(state);
  assertEquals(blob.includes("SCN-010"), false);
  assertEquals(blob.includes("expectedResearchLabel"), false);
  assertEquals(blob.includes("should-not-appear"), false);
  assertEquals(blob.includes("secret-looking"), false);
  assertEquals(jevStateLooksSafe(state), true);
  assertEquals(state.permissions.accesses[0].permission, "ffi");
});

Deno.test("deterministic classification is not part of Jev state", () => {
  const ev = baseEvidence();
  const det = classifyEvidence(ev);
  const state = buildJevRiskState(ev);
  const blob = JSON.stringify(state);
  assertEquals(det.classification != null, true);
  assertEquals(blob.includes(String(det.classification)), false);
  assertEquals(blob.includes("R003"), false);
  assertEquals(blob.includes("ruleMatches"), false);
});

Deno.test("parseJevChoiceAnswer accepts valid Choice and rejects unknown", () => {
  const ok = parseJevChoiceAnswer({
    model: "jev-1.14.0",
    answers: {
      risk_class: {
        type: "choice",
        choice: "high",
        probabilities: { low: 0.05, review: 0.1, high: 0.85 },
        confidence: 0.775,
      },
    },
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  assertEquals(ok.classification, "high");
  assertEquals(ok.confidence, 0.775);
  assertEquals(ok.model, "jev-1.14.0");

  let threw = false;
  try {
    parseJevChoiceAnswer({
      answers: {
        risk_class: { type: "choice", choice: "malicious", confidence: 0.9 },
      },
    });
  } catch (e) {
    threw = true;
    assertStringIncludes(String(e), "unknown_classification");
  }
  assertEquals(threw, true);
  assertEquals(mapChoiceToClassification("REVIEW"), "review");
  assertEquals(mapChoiceToClassification("evil"), null);
});

Deno.test("Jev unavailable without credentials does not invent classification", async () => {
  const analyzer = new JevRiskAnalyzer({ apiKey: null });
  const r = await analyzer.classify(baseEvidence());
  assertEquals(r.provider, "jev");
  assertEquals(r.status, "unavailable");
  assertEquals(r.classification, null);
  assertEquals(r.confidence, null);
  assertEquals(r.failureKind, "missing_credentials");
  assertStringIncludes(
    String(r.providerMetadata.confidenceSemantics),
    "NOT a probability",
  );
});

Deno.test("invalid Jev output is rejected (mocked fetch)", async () => {
  const analyzer = new JevRiskAnalyzer({
    apiKey: "test-key-not-real",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          model: "jev-1.14.0",
          answers: {
            risk_class: {
              type: "choice",
              choice: "probably_fine",
              confidence: 0.5,
            },
          },
        }),
        { status: 200 },
      ),
  });
  const r = await analyzer.classify(baseEvidence());
  assertEquals(r.status, "failed");
  assertEquals(r.classification, null);
  assertEquals(r.failureKind, "unknown_classification");
});

Deno.test("timeout is handled as provider failure", async () => {
  const analyzer = new JevRiskAnalyzer({
    apiKey: "test-key-not-real",
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
  });
  const r = await analyzer.classify(baseEvidence());
  assertEquals(r.status, "failed");
  assertEquals(r.failureKind, "timeout");
  assertEquals(r.classification, null);
});

Deno.test("serialized System One request excludes labels and deterministic output", () => {
  const ev = baseEvidence();
  const det = classifyEvidence(ev);
  const built = buildJevSystemOneRequest(ev, { presentation: "canonical" });
  const stateBlob = JSON.stringify(built.body.state);
  const payload = JSON.stringify(built.body);
  assertEquals(built.integrity.safe, true);
  assertEquals(built.integrity.forbiddenHits.length, 0);
  for (const leak of [
    "scenarioId",
    "expectedResearchLabel",
    "referenceLabel",
    "corpusType",
    "holdout",
    "ruleMatches",
    "R003",
    "should-not-appear",
    "HOST_CAPABILITY_TOKEN",
    "JEV_API_KEY",
  ]) {
    assertEquals(payload.includes(leak), false, `leak=${leak}`);
  }
  // Deterministic reasons / rule IDs must not appear in state.
  for (const reason of det.reasons) {
    assertEquals(stateBlob.includes(reason), false);
  }
  assertEquals(built.body.questions.risk_class.type, "choice");
  assertEquals(
    Object.keys(built.body.questions.risk_class.criteria).sort().join(","),
    "high,low,review",
  );
});

Deno.test("comparison runs analyzers independently; Jev never sees det output", async () => {
  let capturedBody: string | null = null;
  const analyzerFetch: typeof fetch = async (_url, init) => {
    capturedBody = String(init?.body ?? "");
    return new Response(
      JSON.stringify({
        model: "jev-1.14.0",
        answers: {
          risk_class: {
            type: "choice",
            choice: "high",
            probabilities: { low: 0, review: 0.1, high: 0.9 },
            confidence: 0.85,
          },
        },
      }),
      { status: 200 },
    );
  };

  const cmp = await classifyEvidenceComparison(baseEvidence(), {
    jev: { apiKey: "k", fetchImpl: analyzerFetch },
  });
  assertEquals(cmp.deterministic.classification, "high");
  assertEquals(cmp.jev.classification, "high");
  assertEquals(capturedBody != null, true);
  assertEquals(capturedBody!.includes("deterministic"), false);
  assertEquals(capturedBody!.includes("R003"), false);
  assertEquals(capturedBody!.includes("ruleMatches"), false);
  assertEquals(capturedBody!.includes("expectedResearchLabel"), false);
  assertEquals(capturedBody!.includes("scenarioId"), false);
});

Deno.test("evidence fact reasons reference observables only", () => {
  const facts = evidenceFactReasons(baseEvidence());
  assertEquals(facts.some((f) => f.includes("ffi")), true);
  assertEquals(facts.some((f) => /malware|intent|malicious/i.test(f)), false);
});

Deno.test("sensitivity presentations preserve factual values", () => {
  const state = buildJevRiskState(baseEvidence());
  const reordered = presentJevState(state, "reordered");
  const notes = presentJevState(state, "compact_notes");
  assertEquals(
    JSON.stringify(reordered.permissions),
    JSON.stringify(state.permissions),
  );
  assertEquals(
    JSON.stringify((notes as { evidence: unknown }).evidence),
    JSON.stringify(state),
  );
});

Deno.test("repeated classifications stay separate objects", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls++;
    const choice = calls === 1 ? "review" : "high";
    return new Response(
      JSON.stringify({
        model: "jev-1.14.0",
        answers: {
          risk_class: {
            type: "choice",
            choice,
            probabilities: { low: 0.1, review: 0.4, high: 0.5 },
            confidence: 0.25,
          },
        },
      }),
      { status: 200 },
    );
  };
  const analyzer = new JevRiskAnalyzer({ apiKey: "k", fetchImpl });
  const a = await analyzer.classify(baseEvidence());
  const b = await analyzer.classify(baseEvidence());
  assertEquals(a.classification, "review");
  assertEquals(b.classification, "high");
  assertEquals(calls, 2);
});
