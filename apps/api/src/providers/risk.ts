/**
 * RiskAnalyzer abstraction.
 *
 * Implementations:
 * - mock          — legacy keyword heuristics (pre-execution source scan)
 * - deterministic — post-execution behavioral baseline (ExecutionEvidenceRecord)
 * - jev           — TypeSafe System One / Jev Choice on compact evidence state
 *
 * CRITICAL: Risk assessment is ADVISORY METADATA ONLY.
 * It must NEVER grant a permission, override Host Gateway, or terminate runs.
 *
 * RISK_ANALYZER=comparison is research tooling only — use /api/research routes
 * and scripts/risk-comparison.mjs. The execution hot path stays deterministic.
 */

import type { RiskClassification } from "../domain/types.ts";
import type { ExecutionEvidenceRecord } from "../risk/evidence.ts";
import { DeterministicRiskAnalyzer } from "../risk/deterministic.ts";
import { JevRiskAnalyzer } from "../risk/jev.ts";

export interface RiskAnalyzeInput {
  scriptVersionId: string;
  language: string;
  /** Used by MockRiskAnalyzer only — deterministic/jev ignore source. */
  source?: string;
  executionId?: string;
  /** Required for DeterministicRiskAnalyzer and JevRiskAnalyzer. */
  evidence?: ExecutionEvidenceRecord;
}

export interface RiskAnalyzeResult {
  /** Null on provider failure / unavailable (never invent a class). */
  classification: RiskClassification | null;
  score: number;
  confidence: number | null;
  reasons: string[];
  provider: string;
  analyzerVersion?: string;
  latencyMs?: number;
  status?: "ok" | "failed" | "unavailable";
  failureKind?: string;
  providerMetadata?: Record<string, unknown>;
  evidenceSchemaVersion?: number;
}

export interface RiskAnalyzer {
  readonly name: string;
  analyze(input: RiskAnalyzeInput): Promise<RiskAnalyzeResult>;
}

export class MockRiskAnalyzer implements RiskAnalyzer {
  readonly name = "mock";

  async analyze(input: RiskAnalyzeInput): Promise<RiskAnalyzeResult> {
    const src = (input.source ?? "").toLowerCase();
    const reasons: string[] = [];
    let score = 0.1;

    const highKeywords = [
      "eval(",
      "child_process",
      "deno.run",
      "fetch(",
      "writefile",
      "rm -rf",
    ];
    const reviewKeywords = [
      "import(",
      "require(",
      "process.env",
      "net.",
      "filesystem",
    ];

    for (const kw of highKeywords) {
      if (src.includes(kw)) {
        score = Math.max(score, 0.85);
        reasons.push(`Mock heuristic: found suspicious token "${kw}"`);
      }
    }
    for (const kw of reviewKeywords) {
      if (src.includes(kw)) {
        score = Math.max(score, 0.45);
        reasons.push(`Mock heuristic: found review-level token "${kw}"`);
      }
    }

    if (src.includes("host.broadcast") || src.includes("host.requeststatus")) {
      reasons.push("Uses allowlisted host API surface (heuristic)");
      score = Math.min(score, Math.max(score, 0.15));
    }

    if (reasons.length === 0) {
      reasons.push("No mock heuristic keywords matched");
    }

    if ((input.source ?? "").includes("BLOCK_DEMO")) {
      return {
        classification: "high",
        score: 0.95,
        confidence: 0.9,
        reasons: ["Deterministic demo block marker BLOCK_DEMO present"],
        provider: "mock",
        status: "ok",
      };
    }

    const classification: RiskClassification = score >= 0.7
      ? "high"
      : score >= 0.35
      ? "review"
      : "low";

    return {
      classification,
      score,
      confidence: 0.55,
      reasons,
      provider: "mock",
      status: "ok",
    };
  }
}

export function createRiskAnalyzer(
  kind: string = "deterministic",
): RiskAnalyzer {
  switch (kind) {
    case "mock":
      return new MockRiskAnalyzer();
    case "deterministic":
      return new DeterministicRiskAnalyzer();
    case "jev":
      return new JevRiskAnalyzer();
    case "comparison":
      // Comparison of both analyzers is performed post-execution via research
      // tooling. Hot path stays deterministic so execution never waits on Jev.
      console.info(
        "[risk] RISK_ANALYZER=comparison: execution path uses deterministic; " +
          "run scripts/risk-comparison.mjs or POST /api/research/risk-classify for dual analysis",
      );
      return new DeterministicRiskAnalyzer();
    default:
      console.warn(
        `[risk] unknown analyzer "${kind}", falling back to deterministic`,
      );
      return new DeterministicRiskAnalyzer();
  }
}

export { DeterministicRiskAnalyzer, JevRiskAnalyzer };
