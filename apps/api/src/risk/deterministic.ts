/**
 * DeterministicRiskAnalyzer — experimental advisory baseline v1.
 *
 * Consumes ONLY ExecutionEvidenceRecord.
 * Never reads scenarioId / referenceLabel / raw script source for decisions.
 */

import type { RiskAnalyzeResult, RiskAnalyzer } from "../providers/risk.ts";
import type { ExecutionEvidenceRecord } from "./evidence.ts";
import {
  classifyFromMatches,
  evaluateDeterministicRules,
  RULE_VERSION,
  type RuleMatch,
} from "./rules.ts";

export interface DeterministicAnalyzeResult extends RiskAnalyzeResult {
  ruleMatches: RuleMatch[];
  analyzerVersion: string;
  evidenceSchemaVersion: number;
}

export function classifyEvidence(
  evidence: ExecutionEvidenceRecord,
): DeterministicAnalyzeResult {
  // Defensive: ignore any accidental scenario fields if present on a wider object.
  const clean: ExecutionEvidenceRecord = {
    evidenceSchemaVersion: evidence.evidenceSchemaVersion,
    executionId: evidence.executionId,
    traceId: evidence.traceId,
    script: { ...evidence.script },
    runtime: { ...evidence.runtime },
    permissions: {
      accesses: [...evidence.permissions.accesses],
      failureCategory: evidence.permissions.failureCategory,
      auditTruncated: evidence.permissions.auditTruncated,
    },
    hostApi: {
      requested: [...evidence.hostApi.requested],
      allowed: [...evidence.hostApi.allowed],
      denied: [...evidence.hostApi.denied],
      queued: [...evidence.hostApi.queued],
    },
    resources: { ...evidence.resources },
    termination: { ...evidence.termination },
    provenance: [...evidence.provenance],
    // Keep untrusted context attached but rules must not key off stdout keywords.
    untrustedContext: evidence.untrustedContext
      ? { ...evidence.untrustedContext }
      : undefined,
  };

  const ruleMatches = evaluateDeterministicRules(clean);
  const { classification, score } = classifyFromMatches(ruleMatches);

  const reasons = ruleMatches.length > 0
    ? ruleMatches.map((m) => `[${m.ruleId}] ${m.description}`)
    : [
      "[R010] No predefined high-risk indicators observed in this controlled model",
    ];

  return {
    classification,
    score,
    confidence: 1,
    reasons,
    provider: "deterministic",
    status: "ok",
    ruleMatches,
    analyzerVersion: RULE_VERSION,
    evidenceSchemaVersion: clean.evidenceSchemaVersion,
  };
}

export class DeterministicRiskAnalyzer implements RiskAnalyzer {
  readonly name = "deterministic";

  /**
   * Preferred entry: classify a canonical evidence record.
   * The orchestrator must call this after execution evidence exists.
   */
  classify(evidence: ExecutionEvidenceRecord): DeterministicAnalyzeResult {
    return classifyEvidence(evidence);
  }

  /**
   * RiskAnalyzer interface — requires `evidence` on the input.
   * Source/scenarioId are ignored for classification.
   */
  async analyze(input: {
    scriptVersionId: string;
    language: string;
    source?: string;
    executionId?: string;
    evidence?: ExecutionEvidenceRecord;
    scenarioId?: string;
    referenceLabel?: string;
  }): Promise<RiskAnalyzeResult> {
    void input.scenarioId;
    void input.referenceLabel;
    void input.source;

    if (!input.evidence) {
      return {
        classification: "review",
        score: 0.4,
        confidence: 0,
        reasons: [
          "[R000] Insufficient evidence for deterministic analysis (no ExecutionEvidenceRecord)",
        ],
        provider: "deterministic",
        status: "ok",
        analyzerVersion: RULE_VERSION,
      };
    }
    const started = performance.now();
    const full = this.classify(input.evidence);
    return {
      classification: full.classification,
      score: full.score,
      confidence: full.confidence,
      reasons: full.reasons,
      provider: full.provider,
      status: "ok",
      analyzerVersion: full.analyzerVersion,
      evidenceSchemaVersion: full.evidenceSchemaVersion,
      latencyMs: Math.round(performance.now() - started),
    };
  }
}
