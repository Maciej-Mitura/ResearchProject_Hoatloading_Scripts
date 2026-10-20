/**
 * Independent dual classification over the same ExecutionEvidenceRecord.
 * Deterministic and Jev never see each other's outputs.
 */

import { classifyEvidence } from "./deterministic.ts";
import type { ExecutionEvidenceRecord } from "./evidence.ts";
import {
  JevRiskAnalyzer,
  type JevAnalyzeResult,
  type JevClientConfig,
} from "./jev.ts";
import type { JevStatePresentation } from "./jev-input.ts";
import type { DeterministicAnalyzeResult } from "./deterministic.ts";

export interface ComparisonClassifyResult {
  evidenceId: string;
  evidenceSchemaVersion: number;
  deterministic: DeterministicAnalyzeResult & { latencyMs: number };
  jev: JevAnalyzeResult;
}

export async function classifyEvidenceComparison(
  evidence: ExecutionEvidenceRecord,
  opts: {
    jev?: JevClientConfig;
    presentation?: JevStatePresentation;
  } = {},
): Promise<ComparisonClassifyResult> {
  const detStarted = performance.now();
  const deterministic = classifyEvidence(evidence);
  const detLatency = Math.round(performance.now() - detStarted);

  const jevAnalyzer = new JevRiskAnalyzer({
    ...opts.jev,
    presentation: opts.presentation ?? opts.jev?.presentation,
  });
  const jev = await jevAnalyzer.classify(evidence, {
    presentation: opts.presentation,
  });

  return {
    evidenceId: evidence.executionId,
    evidenceSchemaVersion: evidence.evidenceSchemaVersion,
    deterministic: { ...deterministic, latencyMs: detLatency },
    jev,
  };
}
