import { hostInteraction } from "./host-evidence";
import type { Execution, ExecutionHistoryItem, SecurityEvent } from "./types";

export function dateLabel(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not recorded";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
export function durationLabel(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? `${value.toLocaleString()} ms`
    : "Not recorded";
}
export function assessmentLabel(
  risk:
    | { classification?: string | null; assessmentStatus?: string | null }
    | null
    | undefined,
) {
  if (!risk) return "Not recorded";
  if (risk.assessmentStatus === "failed") return "Failed";
  if (risk.assessmentStatus === "unavailable") return "Unavailable";
  if (risk.classification === "medium") return "REVIEW";
  if (["low", "review", "high"].includes(risk.classification ?? ""))
    return risk.classification!.toUpperCase();
  return risk.assessmentStatus === "ok" ? "Unclassified" : "Not recorded";
}
export function evidenceStatus(execution: Execution | null) {
  const status = execution?.result?.auditCollection?.status;
  return ["complete", "partial", "unavailable", "legacy_unknown"].includes(
    status ?? "",
  )
    ? status!
    : execution?.result
      ? "legacy_unknown"
      : "not_recorded";
}
export function permissionObservations(
  execution: Execution,
  events: SecurityEvent[],
) {
  const native = execution.result?.permissionEvents;
  if (Array.isArray(native) && native.length)
    return native.filter((e) => e && typeof e.permission === "string");
  return events
    .filter(
      (e) =>
        e.executionId === execution.id &&
        e.eventType === "permission.accessed" &&
        typeof e.metadata?.permission === "string",
    )
    .map((e) => ({
      permission: String(e.metadata.permission),
      target: e.metadata.target == null ? null : String(e.metadata.target),
    }));
}
export function summarizeHistory(rows: ExecutionHistoryItem[]) {
  const durations = rows
    .map((r) => r.durationMs)
    .filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0,
    )
    .sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  const median = durations.length
    ? durations.length % 2
      ? durations[mid]!
      : (durations[mid - 1]! + durations[mid]!) / 2
    : null;
  const count = (values: string[]) =>
    Array.from(new Set(values)).map((name) => ({
      name,
      value: values.filter((v) => v === name).length,
    }));
  return {
    count: rows.length,
    completed: rows.filter((r) => r.status === "completed").length,
    complete: rows.filter((r) => r.auditStatus === "complete").length,
    median,
    durationCount: durations.length,
    outcomes: count(rows.map((r) => r.status)),
    assessments: count(rows.map(assessmentLabel)),
    durations: [...rows].reverse().map((r, i) => ({
      ...r,
      sequence: i + 1,
      durationMs:
        typeof r.durationMs === "number" &&
        Number.isFinite(r.durationMs) &&
        r.durationMs >= 0
          ? r.durationMs
          : null,
    })),
  };
}
export type ChainStage = {
  name: string;
  state: "Observed" | "Inferred" | "Not recorded" | "Failed" | "Partial";
  detail: string;
};
export function hostCapabilityChain(
  execution: Execution,
  events: SecurityEvent[],
): ChainStage[] {
  const h = hostInteraction(execution, events);
  if (!h.hasEvidence) return [];
  return [
    {
      name: "Requested",
      state: h.requested ? "Observed" : "Not recorded",
      detail: `${h.requested} request records`,
    },
    {
      name: "Authorized",
      state:
        h.denied && h.authorized
          ? "Partial"
          : h.authorized
            ? "Observed"
            : h.denied
              ? "Failed"
              : "Not recorded",
      detail: `${h.authorized} authorized; ${h.denied} denied`,
    },
    {
      name: "Queued",
      state: h.queued.length ? "Observed" : "Not recorded",
      detail: `${h.queued.length} distinct queued commands; acceptance is not delivery`,
    },
    {
      name: "Delivered",
      state:
        h.queued.length && h.confirmed === h.queued.length
          ? "Inferred"
          : h.confirmed
            ? "Partial"
            : "Not recorded",
      detail:
        "Inferred only for successful correlated acknowledgements; no independent delivery timestamp",
    },
    {
      name: "Confirmed",
      state:
        h.queued.length && h.confirmed === h.queued.length
          ? "Observed"
          : h.confirmed
            ? "Partial"
            : h.failed
              ? "Failed"
              : "Not recorded",
      detail: h.confirmed
        ? `Paper acknowledged ${h.confirmed} of ${h.queued.length} queued commands; ${h.failed} failed; ${h.pending} pending/not recorded`
        : "Successful Paper acknowledgement required",
    },
  ];
}
