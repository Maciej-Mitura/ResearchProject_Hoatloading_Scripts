/**
 * Experimental deterministic baseline v1 — transparent advisory rules.
 * These thresholds are research heuristics, not academically optimal.
 */

import type {
  ExecutionEvidenceRecord,
  PermissionAccessEvidence,
} from "./evidence.ts";

export const RULE_VERSION = "1" as const;

export type RuleSeverity = "review" | "high";

export interface RuleMatch {
  ruleId: string;
  description: string;
  severity: RuleSeverity;
  /** Opaque references into the evidence record (paths / ids). */
  evidenceReferences: string[];
  weight: number;
}

export interface DeterministicRule {
  id: string;
  description: string;
  severity: RuleSeverity;
  weight: number;
  evaluate(evidence: ExecutionEvidenceRecord): RuleMatch | null;
}

const EXPECTED_HOST_ENV = new Set([
  "HOST_CAPABILITY_TOKEN",
  "HOST_GATEWAY_URL",
]);
const EXPECTED_DEMO_ENV = new Set(["SANDBOX_DEMO_VALUE"]);

function isFixtureRead(access: PermissionAccessEvidence): boolean {
  if (access.permission !== "read") return false;
  const t = access.target ?? "";
  return t === "/fixtures" || t.startsWith("/fixtures/");
}

function isExpectedHostNet(access: PermissionAccessEvidence): boolean {
  if (access.permission !== "net") return false;
  const t = (access.target ?? "").toLowerCase();
  return t.includes("host-gateway");
}

function isExpectedHostEnv(access: PermissionAccessEvidence): boolean {
  if (access.permission !== "env") return false;
  const t = access.target ?? "";
  return EXPECTED_HOST_ENV.has(t);
}

function isExpectedDemoEnv(access: PermissionAccessEvidence): boolean {
  if (access.permission !== "env") return false;
  return EXPECTED_DEMO_ENV.has(access.target ?? "");
}

/** Restricted filesystem read (research heuristic). */
function isRestrictedRead(access: PermissionAccessEvidence): boolean {
  if (access.permission !== "read") return false;
  if (isFixtureRead(access)) return false;
  return true;
}

export const DETERMINISTIC_RULES: DeterministicRule[] = [
  {
    id: "R001",
    description: "Deno permission-related execution failure",
    severity: "review",
    weight: 0.5,
    evaluate(ev) {
      if (ev.permissions.failureCategory !== "deno_permission") return null;
      return {
        ruleId: "R001",
        description: "Deno permission-related execution failure",
        severity: "review",
        weight: 0.5,
        evidenceReferences: ["permissions.failureCategory"],
      };
    },
  },
  {
    id: "R002",
    description: "Subprocess/run permission access observed",
    severity: "high",
    weight: 0.85,
    evaluate(ev) {
      const hits = ev.permissions.accesses.filter((a) => a.permission === "run");
      if (hits.length === 0) return null;
      return {
        ruleId: "R002",
        description: "Subprocess/run permission access observed",
        severity: "high",
        weight: 0.85,
        evidenceReferences: hits.map(
          (_, i) => `permissions.accesses[run]#${i}`,
        ),
      };
    },
  },
  {
    id: "R003",
    description: "FFI permission access observed",
    severity: "high",
    weight: 0.9,
    evaluate(ev) {
      const hits = ev.permissions.accesses.filter((a) => a.permission === "ffi");
      if (hits.length === 0) return null;
      return {
        ruleId: "R003",
        description: "FFI permission access observed",
        severity: "high",
        weight: 0.9,
        evidenceReferences: hits.map(
          (_, i) => `permissions.accesses[ffi]#${i}`,
        ),
      };
    },
  },
  {
    id: "R004",
    description: "Host API request denied",
    severity: "review",
    weight: 0.5,
    evaluate(ev) {
      if (ev.hostApi.denied.length === 0) return null;
      return {
        ruleId: "R004",
        description: "Host API request denied",
        severity: "review",
        weight: 0.5,
        evidenceReferences: ev.hostApi.denied.map(
          (d) => `hostApi.denied:${d.callId}`,
        ),
      };
    },
  },
  {
    id: "R005",
    description: "Repeated denied host API calls or budget exhausted",
    severity: "high",
    weight: 0.85,
    evaluate(ev) {
      const denied = ev.hostApi.denied;
      const budget = denied.some((d) =>
        (d.reason ?? "").includes("budget")
      );
      if (denied.length >= 2 || budget) {
        return {
          ruleId: "R005",
          description: "Repeated denied host API calls or budget exhausted",
          severity: "high",
          weight: 0.85,
          evidenceReferences: denied.map((d) => `hostApi.denied:${d.callId}`),
        };
      }
      return null;
    },
  },
  {
    id: "R006",
    description: "Execution timed out (resource limit)",
    severity: "high",
    weight: 0.8,
    evaluate(ev) {
      if (!ev.resources.timedOut && !ev.runtime.timedOut) return null;
      return {
        ruleId: "R006",
        description: "Execution timed out (resource limit)",
        severity: "high",
        weight: 0.8,
        evidenceReferences: ["resources.timedOut"],
      };
    },
  },
  {
    id: "R007",
    description: "Output limit exceeded (truncated)",
    severity: "review",
    weight: 0.45,
    evaluate(ev) {
      if (!ev.resources.outputTruncated && !ev.runtime.outputTruncated) {
        return null;
      }
      return {
        ruleId: "R007",
        description: "Output limit exceeded (truncated)",
        severity: "review",
        weight: 0.45,
        evidenceReferences: ["resources.outputTruncated"],
      };
    },
  },
  {
    id: "R009",
    description:
      "Restricted filesystem permission activity (including caught failures)",
    severity: "review",
    weight: 0.5,
    evaluate(ev) {
      const hits = ev.permissions.accesses.filter(isRestrictedRead);
      if (hits.length === 0) return null;
      return {
        ruleId: "R009",
        description:
          "Restricted filesystem permission activity (including caught failures)",
        severity: "review",
        weight: 0.5,
        evidenceReferences: hits.map(
          (h, i) => `permissions.accesses[read]:${h.target ?? i}`,
        ),
      };
    },
  },
  {
    id: "R011",
    description: "Unexpected environment permission access",
    severity: "review",
    weight: 0.45,
    evaluate(ev) {
      const hits = ev.permissions.accesses.filter((a) => {
        if (a.permission !== "env") return false;
        if (isExpectedDemoEnv(a) || isExpectedHostEnv(a)) return false;
        // Broad env probe with no target still counts.
        return true;
      });
      if (hits.length === 0) return null;
      return {
        ruleId: "R011",
        description: "Unexpected environment permission access",
        severity: "review",
        weight: 0.45,
        evidenceReferences: hits.map(
          (h, i) => `permissions.accesses[env]:${h.target ?? i}`,
        ),
      };
    },
  },
  {
    id: "R012",
    description: "Unexpected network permission access",
    severity: "review",
    weight: 0.45,
    evaluate(ev) {
      const hits = ev.permissions.accesses.filter((a) => {
        if (a.permission !== "net") return false;
        return !isExpectedHostNet(a);
      });
      if (hits.length === 0) return null;
      return {
        ruleId: "R012",
        description: "Unexpected network permission access",
        severity: "review",
        weight: 0.45,
        evidenceReferences: hits.map(
          (h, i) => `permissions.accesses[net]:${h.target ?? i}`,
        ),
      };
    },
  },
];

/**
 * Evaluate all rules. HIGH overrides REVIEW overrides LOW.
 * R008/R010 are implicit: authorized host-chat alone does not escalate;
 * no matches → LOW.
 */
export function evaluateDeterministicRules(
  evidence: ExecutionEvidenceRecord,
): RuleMatch[] {
  const matches: RuleMatch[] = [];
  for (const rule of DETERMINISTIC_RULES) {
    const m = rule.evaluate(evidence);
    if (m) matches.push(m);
  }
  return matches;
}

export function classifyFromMatches(
  matches: RuleMatch[],
): { classification: "low" | "review" | "high"; score: number } {
  if (matches.some((m) => m.severity === "high")) {
    const score = Math.max(
      0.67,
      ...matches.filter((m) => m.severity === "high").map((m) => m.weight),
    );
    return { classification: "high", score: Math.min(1, score) };
  }
  if (matches.some((m) => m.severity === "review")) {
    const score = Math.max(
      0.34,
      ...matches.filter((m) => m.severity === "review").map((m) => m.weight),
    );
    return { classification: "review", score: Math.min(0.66, score) };
  }
  // R010 — no predefined high-risk indicators in this controlled model.
  return { classification: "low", score: 0.15 };
}
