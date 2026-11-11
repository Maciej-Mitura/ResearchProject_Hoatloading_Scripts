import type { AuditCollection } from "../../../packages/contracts/src/audit-collection.ts";
export type { AuditCollection };

export function collectAuditStatus(input: {
  frame: "complete" | "missing" | "malformed";
  timedOut: boolean;
  outputTruncated: boolean;
  auditTruncated: boolean;
  malformedCount: number;
  infrastructureFailure?: boolean;
  terminated?: boolean;
}): AuditCollection {
  const reasons: string[] = [];
  if (input.infrastructureFailure) reasons.push("runner_failure");
  if (input.timedOut) reasons.push("timeout");
  if (input.terminated) reasons.push("process_terminated");
  if (input.outputTruncated) reasons.push("output_capture_or_return_limit");
  if (input.frame !== "complete") reasons.push(`${input.frame}_audit_frame`);
  if (input.auditTruncated) reasons.push("audit_limit");
  if (input.malformedCount) reasons.push("malformed_audit_records");
  return {
    version: 1,
    status: reasons.length === 0
      ? "complete"
      : input.frame === "missing" || input.infrastructureFailure
      ? "unavailable"
      : "partial",
    reasons,
  };
}
