/**
 * Compact Jev System One `state` derived ONLY from ExecutionEvidenceRecord v1.
 *
 * Never includes: scenarioId, reference labels, deterministic classification,
 * rule IDs, script source, capability tokens, or full stdout/stderr.
 */

import type { ExecutionEvidenceRecord } from "./evidence.ts";

import { JEV_POLICY_VERSION } from "./jev-policy.ts";
export { JEV_POLICY_VERSION };
import {
  type AuditCollection,
  normalizeAuditCollection,
} from "../../../../packages/contracts/src/audit-collection.ts";
export const JEV_INPUT_SCHEMA_VERSION = 2;
export const JEV_TRANSFORM_VERSION = "2";

/** Minimal classification state sent to TypeSafe / Jev. */
export interface JevRiskState {
  inputSchemaVersion: number;
  auditCollection: AuditCollection;
  evidenceSchemaVersion: number;
  policyVersion: typeof JEV_POLICY_VERSION;
  termination: {
    status: string;
    reason: string | null;
  };
  runtime: {
    runtime: string;
    runtimeVersion: string | null;
    containerRuntime: string | null;
    provider: string;
    durationMs: number | null;
    exitCode: number | null;
    timedOut: boolean;
    outputTruncated: boolean;
  };
  script: {
    language: string;
    permissionProfile: string;
  };
  permissions: {
    failureCategory: string | null;
    auditTruncated: boolean;
    accessCount: number;
    accesses: Array<{ permission: string; target: string | null }>;
  };
  hostApi: {
    requestedCount: number;
    allowedCount: number;
    deniedCount: number;
    queuedCount: number;
    deniedReasons: string[];
    capabilitiesRequested: string[];
  };
  resources: {
    timedOut: boolean;
    outputTruncated: boolean;
  };
  provenance: string[];
}

/**
 * Build compact Jev state from canonical evidence.
 * Strips untrusted context and any accidental comparison fields.
 */
export function buildJevRiskState(
  evidence: ExecutionEvidenceRecord,
): JevRiskState {
  validateEvidenceForJev(evidence);
  const deniedReasons = [
    ...new Set(
      evidence.hostApi.denied
        .map((d) => d.reason)
        .filter((r): r is string => typeof r === "string" && r.length > 0),
    ),
  ];

  const capabilitiesRequested = [
    ...new Set(evidence.hostApi.requested.map((r) => r.capability)),
  ];

  const accesses = evidence.permissions.accesses
    .map((a) => ({
      permission: a.permission,
      target: a.target,
    }));

  return {
    inputSchemaVersion: JEV_INPUT_SCHEMA_VERSION,
    auditCollection: normalizeAuditCollection(
      (evidence as ExecutionEvidenceRecord & { auditCollection?: unknown })
        .auditCollection,
    ),
    evidenceSchemaVersion: evidence.evidenceSchemaVersion,
    policyVersion: JEV_POLICY_VERSION,
    termination: {
      status: evidence.termination.status,
      reason: evidence.termination.reason,
    },
    runtime: {
      runtime: evidence.runtime.runtime,
      runtimeVersion: evidence.runtime.runtimeVersion,
      containerRuntime: evidence.runtime.containerRuntime,
      provider: evidence.runtime.provider,
      durationMs: evidence.runtime.durationMs,
      exitCode: evidence.runtime.exitCode,
      timedOut: evidence.runtime.timedOut,
      outputTruncated: evidence.runtime.outputTruncated,
    },
    script: {
      language: evidence.script.language,
      permissionProfile: evidence.script.permissionProfile,
    },
    permissions: {
      failureCategory: evidence.permissions.failureCategory,
      auditTruncated: evidence.permissions.auditTruncated,
      accessCount: evidence.permissions.accesses.length,
      accesses,
    },
    hostApi: {
      requestedCount: evidence.hostApi.requested.length,
      allowedCount: evidence.hostApi.allowed.length,
      deniedCount: evidence.hostApi.denied.length,
      queuedCount: evidence.hostApi.queued.length,
      deniedReasons,
      capabilitiesRequested,
    },
    resources: {
      timedOut: evidence.resources.timedOut,
      outputTruncated: evidence.resources.outputTruncated,
    },
    // Trusted provenance only — drop script_output if present.
    provenance: evidence.provenance.filter((p) => p !== "script_output"),
  };
}

/** Validate the actual evidence shape before request construction; labels are never features. */
export function validateEvidenceForJev(e: ExecutionEvidenceRecord): void {
  const str = (v: unknown): v is string => typeof v === "string";
  const nullableStr = (v: unknown) => v === null || str(v);
  const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (
    !e || e.evidenceSchemaVersion !== 1 || !str(e.executionId) ||
    !nullableStr(e.traceId) ||
    !e.script || !str(e.script.language) || !str(e.script.permissionProfile) ||
    !e.runtime || !str(e.runtime.runtime) || !str(e.runtime.provider) ||
    !nullableStr(e.runtime.runtimeVersion) ||
    !nullableStr(e.runtime.containerRuntime) ||
    !(e.runtime.durationMs === null ||
      finite(e.runtime.durationMs) && e.runtime.durationMs >= 0) ||
    !(e.runtime.exitCode === null || Number.isInteger(e.runtime.exitCode)) ||
    typeof e.runtime.timedOut !== "boolean" ||
    typeof e.runtime.outputTruncated !== "boolean" ||
    !e.permissions || !Array.isArray(e.permissions.accesses) ||
    e.permissions.accesses.length > 200 ||
    !nullableStr(e.permissions.failureCategory) ||
    typeof e.permissions.auditTruncated !== "boolean" ||
    !e.permissions.accesses.every((a) =>
      a && str(a.permission) && nullableStr(a.target) && str(a.source)
    ) ||
    !e.hostApi || !["requested", "allowed", "denied", "queued"].every((key) => {
      const list = e.hostApi[key as keyof typeof e.hostApi];
      return Array.isArray(list) && list.length <= 500 &&
        list.every((v) =>
          v && str(v.callId) && str(v.capability) &&
          (v.reason == null || str(v.reason))
        );
    }) || !e.resources || typeof e.resources.timedOut !== "boolean" ||
    typeof e.resources.outputTruncated !== "boolean" ||
    !e.termination || !str(e.termination.status) ||
    !nullableStr(e.termination.reason) ||
    !Array.isArray(e.provenance) || !e.provenance.every(str)
  ) throw new Error("invalid_evidence_schema");
}

const FORBIDDEN_KEYS = new Set([
  "scenarioId",
  "expectedResearchLabel",
  "referenceLabel",
  "corpusType",
  "holdout",
  "deterministic",
  "ruleId",
  "ruleMatches",
  "source",
  "scriptSource",
  "stdout",
  "stderr",
  "untrustedContext",
  "HOST_CAPABILITY_TOKEN",
  "BRIDGE_TOKEN",
  "JEV_API_KEY",
  "TYPESAFE_API_KEY",
  "AI_GATEWAY_API_KEY",
  "authorization",
  "apiKey",
  "token",
]);
const SECRET_ENV_NAMES = [
  "HOST_CAPABILITY_TOKEN",
  "HOST_GATEWAY_ADMIN_TOKEN",
  "HOST_GATEWAY_SERVICE_TOKEN",
  "BRIDGE_TOKEN",
  "JEV_API_KEY",
  "TYPESAFE_API_KEY",
  "AI_GATEWAY_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DATABASE_URL",
];

/** Structural keys are forbidden; variable NAMES in env targets are legitimate facts.
 * Also reject explicit secret assignments, token/key signatures and known configured values.
 * This cannot identify every arbitrary unknown secret in a script-controlled string.
 */
export function jevStateLooksSafe(
  state: unknown,
  extraSecretValues: readonly string[] = [],
): boolean {
  const known = [
    ...extraSecretValues,
    ...SECRET_ENV_NAMES.map((k) => Deno.env.get(k) ?? ""),
  ].filter((v) => v.length >= 8);
  const visit = (v: unknown): boolean => {
    if (typeof v === "string") {
      return !known.some((secret) => v.includes(secret)) &&
        !/\b(?:sk-[A-Za-z0-9_-]{8,}|vck_[A-Za-z0-9_-]{8,}|[a-f0-9]{64})\b/i
          .test(v) &&
        !/(?:HOST_CAPABILITY_TOKEN|BRIDGE_TOKEN|(?:JEV|TYPESAFE|AI_GATEWAY|OPENAI|GEMINI)_API_KEY)\s*[=:]\s*\S+/i
          .test(v) &&
        !/Bearer\s+\S+/i.test(v);
    }
    if (Array.isArray(v)) return v.every(visit);
    if (v && typeof v === "object") {
      return Object.entries(v).every(([k, value]) =>
        !FORBIDDEN_KEYS.has(k) && visit(value)
      );
    }
    return v === null || typeof v === "boolean" ||
      typeof v === "number" && Number.isFinite(v);
  };
  return !!state && typeof state === "object" && visit(state);
}

/**
 * Local evidence facts for researcher-facing reasons.
 * These are NOT free-text rationales generated by Jev (System One does not
 * return explanation text).
 */
export function evidenceFactReasons(
  evidence: ExecutionEvidenceRecord,
): string[] {
  const facts: string[] = [];
  facts.push(`termination.status=${evidence.termination.status}`);
  if (evidence.resources.timedOut || evidence.runtime.timedOut) {
    facts.push("resources.timedOut=true");
  }
  if (evidence.resources.outputTruncated || evidence.runtime.outputTruncated) {
    facts.push("resources.outputTruncated=true");
  }
  if (evidence.permissions.failureCategory) {
    facts.push(
      `permissions.failureCategory=${evidence.permissions.failureCategory}`,
    );
  }
  for (const a of evidence.permissions.accesses.slice(0, 12)) {
    facts.push(
      `permission.accessed ${a.permission}${a.target ? ` ${a.target}` : ""}`,
    );
  }
  if (evidence.hostApi.denied.length) {
    facts.push(`hostApi.deniedCount=${evidence.hostApi.denied.length}`);
    for (const d of evidence.hostApi.denied.slice(0, 6)) {
      facts.push(
        `hostApi.denied ${d.capability}${d.reason ? ` (${d.reason})` : ""}`,
      );
    }
  }
  if (evidence.hostApi.allowed.length) {
    facts.push(`hostApi.allowedCount=${evidence.hostApi.allowed.length}`);
  }
  if (evidence.hostApi.queued.length) {
    facts.push(`hostApi.queuedCount=${evidence.hostApi.queued.length}`);
  }
  return facts;
}

/** Sensitivity variants: same facts, different presentation only. */
export type JevStatePresentation =
  | "canonical"
  | "reordered"
  | "compact_notes";

export function presentJevState(
  state: JevRiskState,
  variant: JevStatePresentation = "canonical",
): Record<string, unknown> {
  if (variant === "canonical") {
    return { ...state };
  }
  if (variant === "reordered") {
    // Equivalent object with keys shuffled — values unchanged.
    return {
      inputSchemaVersion: state.inputSchemaVersion,
      auditCollection: state.auditCollection,
      provenance: state.provenance,
      resources: state.resources,
      hostApi: state.hostApi,
      permissions: state.permissions,
      script: state.script,
      runtime: state.runtime,
      termination: state.termination,
      policyVersion: state.policyVersion,
      evidenceSchemaVersion: state.evidenceSchemaVersion,
    };
  }
  // compact_notes: wrap in a thin envelope with neutral wording (no new facts).
  return {
    case: "controlled_sandbox_execution_evidence",
    note: "Classify observed behavior only; categories are research labels.",
    evidence: state,
  };
}
