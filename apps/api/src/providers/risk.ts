/**
 * RiskAnalyzer abstraction (Jev placeholder).
 *
 * RESEARCH TODO: replace MockRiskAnalyzer with a Jev-backed implementation
 * after literature research defines the integration.
 *
 * CRITICAL: Risk assessment is ADVISORY METADATA ONLY.
 * It must NEVER automatically grant a permission or override a deterministic deny.
 */

import type { RiskClassification } from "../domain/types.ts";

export interface RiskAnalyzeInput {
  scriptVersionId: string;
  language: string;
  source: string;
  executionId?: string;
}

export interface RiskAnalyzeResult {
  classification: RiskClassification;
  score: number;
  confidence: number;
  reasons: string[];
  provider: string;
}

export interface RiskAnalyzer {
  readonly name: string;
  analyze(input: RiskAnalyzeInput): Promise<RiskAnalyzeResult>;
}

export class MockRiskAnalyzer implements RiskAnalyzer {
  readonly name = "mock";

  async analyze(input: RiskAnalyzeInput): Promise<RiskAnalyzeResult> {
    const src = input.source.toLowerCase();
    const reasons: string[] = [];
    let score = 0.1;

    // Heuristic keywords only — not real security analysis.
    const highKeywords = ["eval(", "child_process", "deno.run", "fetch(", "writefile", "rm -rf"];
    const mediumKeywords = ["import(", "require(", "process.env", "net.", "filesystem"];

    for (const kw of highKeywords) {
      if (src.includes(kw)) {
        score = Math.max(score, 0.85);
        reasons.push(`Mock heuristic: found suspicious token "${kw}"`);
      }
    }
    for (const kw of mediumKeywords) {
      if (src.includes(kw)) {
        score = Math.max(score, 0.45);
        reasons.push(`Mock heuristic: found medium-risk token "${kw}"`);
      }
    }

    if (src.includes("host.broadcast") || src.includes("host.requeststatus")) {
      reasons.push("Uses allowlisted host API surface (heuristic)");
      score = Math.min(score, Math.max(score, 0.15));
    }

    if (reasons.length === 0) {
      reasons.push("No mock heuristic keywords matched");
    }

    // Deterministic demo failure path for fixtures containing "BLOCK_DEMO"
    if (input.source.includes("BLOCK_DEMO")) {
      return {
        classification: "high",
        score: 0.95,
        confidence: 0.9,
        reasons: ["Deterministic demo block marker BLOCK_DEMO present"],
        provider: "mock",
      };
    }

    const classification: RiskClassification =
      score >= 0.7 ? "high" : score >= 0.35 ? "medium" : "low";

    return {
      classification,
      score,
      confidence: 0.55,
      reasons,
      provider: "mock",
    };
  }
}

export function createRiskAnalyzer(kind: string = "mock"): RiskAnalyzer {
  switch (kind) {
    case "mock":
      return new MockRiskAnalyzer();
    default:
      console.warn(`[risk] unknown analyzer "${kind}", falling back to mock`);
      return new MockRiskAnalyzer();
  }
}
