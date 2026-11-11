import { deadline } from "../../../../packages/contracts/src/deadline.ts";
import type { RiskAnalyzeResult } from "../providers/risk.ts";
/** Analysis cannot retroactively change the sandbox outcome. */
export async function advisoryOutcome(provider: string, operation: () => Promise<RiskAnalyzeResult>, timeoutMs = 35000): Promise<RiskAnalyzeResult> {
  try { return await deadline(timeoutMs, "analysis_timeout", operation); }
  catch { return { provider, status: "failed", classification: null, confidence: null, score: 0, reasons: ["Advisory analysis failed or exceeded its deadline; execution outcome is independent"], failureKind: "analysis_failure" }; }
}
