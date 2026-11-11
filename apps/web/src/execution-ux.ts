import type { Execution, RiskAssessment } from "./types";
import { assessmentLabel, evidenceStatus } from "./insights";
export const terminalStatuses = new Set([
  "completed",
  "failed",
  "terminated",
  "blocked",
]);
export const isTerminal = (x: Execution) => terminalStatuses.has(x.status);
export const provenanceHelp = {
  Observed:
    "Directly supported by a trusted stored/runtime record. Recorded does not mean successful.",
  Inferred:
    "Derived from trusted related records; this exact stage was not independently recorded.",
  "Not recorded":
    "No reliable record is available for this stage. This does not prove nothing happened.",
  "Not applicable": "This execution did not use this stage.",
};
export const collectionHelp: Record<string, { label: string; text: string }> = {
  complete: {
    label: "Complete",
    text: "Collection finished normally. This does not mean the script succeeded or that every possible script action was observable.",
  },
  partial: {
    label: "Partial",
    text: "Some evidence was collected, but known collection limits prevented a complete record.",
  },
  unavailable: {
    label: "Unavailable",
    text: "Reliable permission evidence could not be completed for this execution. Other execution or host records may still be available.",
  },
  legacy_unknown: {
    label: "Legacy status unknown",
    text: "This execution has no explicit collection-status record. Its historical collection quality is unknown.",
  },
  not_recorded: {
    label: "Not recorded",
    text: "No reliable collection-status record is available.",
  },
  pending: {
    label: "Pending",
    text: "The current execution has not returned its collection result yet. This is not a final empty result.",
  },
};
export const reasonDescriptions: Record<
  string,
  { title: string; text: string }
> = {
  job_wall_timeout: {
    title: "Execution exceeded time limit",
    text: "The runner reported that the sandbox reached its configured wall-time deadline.",
  },
  timeout: {
    title: "Execution timed out",
    text: "A timeout was recorded for this execution.",
  },
  missing_audit_frame: {
    title: "Final audit frame not received",
    text: "The runner did not record a usable final permission-audit frame. Permission activity cannot be reconstructed from its absence.",
  },
  malformed_audit_frame: {
    title: "Audit frame could not be decoded",
    text: "The returned audit frame did not have a usable format.",
  },
  process_terminated: {
    title: "Process was stopped",
    text: "Process termination limited evidence collection.",
  },
  output_capture_or_return_limit: {
    title: "Output capture was limited",
    text: "A capture or return limit prevented a complete output record.",
  },
  audit_limit: {
    title: "Audit collection limit reached",
    text: "The permission record was bounded by its configured collection limit.",
  },
  malformed_audit_records: {
    title: "Some audit records were malformed",
    text: "Some permission records could not be decoded.",
  },
  runner_failure: {
    title: "Runner collection failed",
    text: "An infrastructure failure prevented reliable collection.",
  },
  execution_not_observed: {
    title: "Execution result not observed",
    text: "The runner did not obtain a usable execution result.",
  },
};
export function explainReason(code: string) {
  return (
    reasonDescriptions[code] ?? {
      title: code.replaceAll("_", " "),
      text: "An additional collection condition was recorded. Its raw code is available in Technical details.",
    }
  );
}
export function collectionState(x: Execution) {
  return !x.result && !isTerminal(x) ? "pending" : evidenceStatus(x);
}
export function outcomeSummary(x: Execution) {
  const r = x.result;
  if (r?.timedOut || r?.failureCategory === "timeout")
    return r?.manifest?.timeoutMs != null
      ? `Execution terminated after reaching its ${(r.manifest.timeoutMs / 1000).toLocaleString()} s limit.`
      : "Execution terminated after reaching its configured time limit.";
  if (r?.oomKilled === true || r?.failureCategory === "memory_limit")
    return "The runner reported a memory-limit termination.";
  if (
    x.status === "failed" &&
    r?.failureCategory &&
    [
      "supervisor_error",
      "docker_operation_timeout",
      "gateway_admin_timeout",
      "runner_failure",
      "supervisor_unavailable",
    ].includes(r.failureCategory)
  )
    return "An infrastructure failure prevented execution from completing.";
  if (x.status === "failed")
    return r?.exitCode != null
      ? `Execution failed with exit code ${r.exitCode}.`
      : "Execution failed; inspect the recorded error and available process result.";
  if (x.status === "terminated")
    return "Execution was stopped externally; inspect the recorded termination information.";
  if (x.status === "blocked")
    return "The execution request was blocked before normal completion.";
  if (x.status === "completed")
    return `Execution completed${r?.durationMs != null ? ` in ${r.durationMs.toLocaleString()} ms` : ""}.`;
  return (
    (
      {
        queued: "Request accepted; waiting to start.",
        validating: "Checking the execution request.",
        running: r
          ? "Collecting the returned execution result."
          : "Script running; waiting for its result.",
        analysing: "Assessing the recorded execution evidence.",
      } as Record<string, string>
    )[x.status] ?? "Waiting for execution status."
  );
}
export type JourneyStage = {
  name: string;
  state: string;
  provenance: keyof typeof provenanceHelp;
  detail: string;
  active?: boolean;
};
/** Node state describes this dimension only; it never propagates failure forward. */
export function stageVisual(s: JourneyStage) {
  if (s.active) return { kind: "active", icon: "↻", meaning: "Active" };
  if (
    s.state === "Failed" ||
    s.state === "failed" ||
    s.state === "Blocked" ||
    s.state === "blocked"
  )
    return { kind: "failed", icon: "×", meaning: "Failed or blocked" };
  if (
    (s.name === "Result" && s.state === "Terminated") ||
    s.state === "Partial"
  )
    return { kind: "warning", icon: "!", meaning: "Stopped or limited" };
  if (
    [
      "Unavailable",
      "Legacy status unknown",
      "Not recorded",
      "Unclassified",
    ].includes(s.state)
  )
    return {
      kind: "unknown",
      icon: "?",
      meaning: "Unavailable or not recorded",
    };
  if (
    ["Pending", "Waiting", "Not applicable", "Checking request"].includes(
      s.state,
    )
  )
    return {
      kind: "pending",
      icon: "○",
      meaning: s.state === "Not applicable" ? "Not applicable" : "Not reached",
    };
  if (s.provenance === "Inferred")
    return {
      kind: "inferred",
      icon: "≈",
      meaning: "Inferred from correlated records",
    };
  return {
    kind: "reached",
    icon: "✓",
    meaning: "Record or stage reached; not a security verdict",
  };
}
export function executionJourney(
  x: Execution | null,
  risk: RiskAssessment | null,
): JourneyStage[] {
  if (!x)
    return [
      {
        name: "Request",
        state: "Sending",
        provenance: "Not recorded",
        detail: "Submitting to the API; acceptance not recorded yet.",
        active: true,
      },
      ...["Process", "Result", "Evidence", "Assessment"].map((name) => ({
        name,
        state: "Pending",
        provenance: "Not recorded" as const,
        detail: "Waiting for the execution request.",
      })),
    ];
  const r = x.result,
    active = !isTerminal(x),
    audit = collectionState(x),
    assessment = assessmentLabel(risk);
  return [
    {
      name: "Request",
      state: "Accepted",
      provenance: "Observed",
      detail: "Execution persisted by the API.",
    },
    {
      name: "Process",
      state:
        x.status === "validating"
          ? "Checking request"
          : r
            ? x.status === "terminated"
              ? "Stopped"
              : "Returned"
            : x.status === "running"
              ? "Running"
              : x.status === "queued"
                ? "Waiting"
                : isTerminal(x)
                  ? x.status
                  : "Not recorded",
      provenance: r
        ? "Observed"
        : x.status === "running"
          ? "Inferred"
          : "Not recorded",
      detail: r
        ? "Stored process result, not independent container attestation."
        : "Coarse application status; separate container-start events are not exposed.",
      active: active && !r,
    },
    {
      name: "Result",
      state: r
        ? isTerminal(x)
          ? ((
              {
                completed: "Completed",
                failed: "Failed",
                terminated: "Terminated",
                blocked: "Blocked",
              } as Record<string, string>
            )[x.status] ?? "Available")
          : "Available"
        : active
          ? "Pending"
          : "Not recorded",
      provenance: r ? "Observed" : "Not recorded",
      detail: r
        ? "The provider result was persisted."
        : "Output will appear when the current execution returns.",
    },
    {
      name: "Evidence",
      state: collectionHelp[audit]?.label ?? "Not recorded",
      provenance: r?.auditCollection ? "Observed" : "Not recorded",
      detail: collectionHelp[audit]?.text ?? collectionHelp.not_recorded!.text,
    },
    {
      name: "Assessment",
      state: risk
        ? assessment
        : x.status === "analysing"
          ? "Assessing"
          : active
            ? "Pending"
            : x.status === "blocked"
              ? "Not applicable"
              : "Not recorded",
      provenance: risk
        ? "Observed"
        : x.status === "blocked"
          ? "Not applicable"
          : "Not recorded",
      detail: risk
        ? "Stored advisory result; separate from process outcome."
        : "Assessment completion is shown only when a linked record exists.",
      active: x.status === "analysing",
    },
  ];
}
export function preferNewerExecution(
  previous: Execution | null,
  next: Execution,
) {
  if (previous?.id !== next.id) return next;
  if (isTerminal(previous) && !isTerminal(next)) return previous;
  return Date.parse(previous.updatedAt) > Date.parse(next.updatedAt)
    ? previous
    : next;
}
