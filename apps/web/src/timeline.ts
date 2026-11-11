/**
 * Execution reconstruction timeline from durable DB evidence.
 * Uses human-readable UI labels; UI does not query the Collector.
 */

import type { Execution, ExecutionEvent, SecurityEvent } from "./types";
import { displayOutput, executionError } from "./execution-errors";

export interface TimelineEntry {
  at: string;
  kind: string;
  label: string;
  detail?: string;
  source: string;
  reconstructed?: boolean;
}

function sourceOf(
  meta: Record<string, unknown> | undefined,
  fallback: string,
): string {
  const s = meta?.source;
  return typeof s === "string" && s ? s : fallback;
}

export function buildExecutionTimeline(input: {
  execution: Execution;
  executionEvents: ExecutionEvent[];
  securityEvents: SecurityEvent[];
}): TimelineEntry[] {
  const { execution, executionEvents, securityEvents } = input;
  const entries: TimelineEntry[] = [];

  entries.push({
    at: execution.createdAt,
    kind: "CREATED",
    label: "Execution request accepted",
    detail: `status=${execution.status === "queued" ? "queued" : "created"}`,
    source: "application",
  });

  for (const ev of executionEvents) {
    if (ev.status === "queued") continue;
    const kind = ev.status.toUpperCase();
    entries.push({
      at: ev.createdAt,
      kind,
      label:
        (
          {
            validating: "Request validation",
            running: "Execution reported running",
            analysing: "Advisory assessment started",
            completed: "Execution completed",
            failed: "Execution failed",
            terminated: "Execution terminated",
            blocked: "Execution blocked",
          } as Record<string, string>
        )[ev.status] ?? kind,
      detail:
        ev.status === "failed"
          ? `Process failure recorded${execution.result?.exitCode != null ? `; exit code ${execution.result.exitCode}` : ""}. Inspect Technical error details.`
          : displayOutput(ev.message) || undefined,
      source: "application",
    });
  }

  for (const ev of securityEvents) {
    if (ev.executionId !== execution.id) continue;
    if (ev.eventType.startsWith("risk.assessment.")) {
      const provider = ev.eventType.replace(/^risk\.assessment\./, "");
      entries.push({
        at: ev.createdAt,
        kind: "RISK",
        label: "Advisory assessment record",
        detail: ev.message,
        source: sourceOf(
          ev.metadata,
          provider === "mock" ? "mock" : "application",
        ),
      });
      continue;
    }
    if (ev.eventType === "permission.accessed") {
      const perm = String(ev.metadata?.permission ?? "");
      const target =
        ev.metadata?.target != null ? String(ev.metadata.target) : "";
      entries.push({
        at: ev.createdAt,
        kind: "PERMISSION",
        label: "Permission observation",
        detail: [perm, target].filter(Boolean).join(" "),
        source: sourceOf(ev.metadata, "deno_permission_audit"),
      });
      continue;
    }
    if (ev.eventType.startsWith("host_api.")) {
      const phase = ev.eventType.replace(/^host_api\./, "").toUpperCase();
      const capability = String(ev.metadata?.capability ?? "");
      const commandId = ev.metadata?.commandId
        ? String(ev.metadata.commandId)
        : "";
      const reason = ev.metadata?.reason ? String(ev.metadata.reason) : "";
      let detail = capability;
      if (commandId) detail += ` command ${commandId.slice(0, 8)}…`;
      if (reason) detail += ` (${reason})`;
      entries.push({
        at: ev.createdAt,
        kind: "HOST_API",
        label: `HOST API ${phase}`,
        detail,
        source: sourceOf(ev.metadata, "host_gateway"),
      });
      continue;
    }
    if (ev.eventType === "host.command.result") {
      const commandId = ev.metadata?.commandId
        ? String(ev.metadata.commandId)
        : "";
      const success = ev.metadata?.success;
      entries.push({
        at: ev.createdAt,
        kind: "HOST",
        label: "Paper command acknowledgement",
        detail: [
          commandId ? `command ${commandId.slice(0, 8)}…` : "",
          success === false ? "failed" : success === true ? "ok" : "",
        ]
          .filter(Boolean)
          .join(" "),
        source: sourceOf(ev.metadata, "secure_bridge"),
      });
      continue;
    }
    if (ev.eventType === "execution.failure.deno_permission") {
      entries.push({
        at: ev.createdAt,
        kind: "FAILURE",
        label: "FAILURE deno_permission",
        detail: "NotCapable / missing allow flag (supervisor classification)",
        source: sourceOf(ev.metadata, "supervisor"),
      });
      continue;
    }
    if (ev.eventType === "execution.started") {
      entries.push({
        at: ev.createdAt,
        kind: "STARTED",
        label: "STARTED",
        detail: ev.message,
        source: sourceOf(ev.metadata, "application"),
      });
      continue;
    }
    if (
      ev.eventType === "execution.created" ||
      ev.eventType === "execution.completed" ||
      ev.eventType === "execution.failed" ||
      ev.eventType === "execution.terminated"
    ) {
      continue;
    }
  }

  for (const ev of securityEvents.filter(
    (e) =>
      e.executionId === execution.id &&
      !entries.some((r) => r.at === e.createdAt && r.detail === e.message),
  )) {
    if (
      ev.eventType.startsWith("audit.") ||
      ev.eventType.includes("collection") ||
      ev.eventType === "execution.failure.timeout"
    )
      entries.push({
        at: ev.createdAt,
        kind: ev.eventType,
        label: ev.eventType.replaceAll("_", " "),
        detail: ev.message,
        source: sourceOf(ev.metadata, "application"),
      });
  }
  const diagnostic = executionError(execution);
  if (diagnostic && execution.result?.stderr)
    entries.push({
      at: execution.finishedAt ?? execution.updatedAt,
      kind: "DERIVED_ERROR",
      label: diagnostic.title,
      detail:
        "Derived from captured process stderr; placed at result time, not a separately timed runtime event.",
      source: "process_output",
      reconstructed: true,
    });
  const stdout = displayOutput(execution.result?.stdout).trim();
  if (stdout) {
    const preview = stdout.length > 80 ? `${stdout.slice(0, 80)}…` : stdout;
    const at = execution.finishedAt ?? execution.updatedAt;
    entries.push({
      at,
      kind: "SCRIPT_OUTPUT",
      label: "Captured script output (placed at result time)",
      detail: preview.replace(/\s+/g, " "),
      source: "script_output",
      reconstructed: true,
    });
  }

  entries.sort((a, b) => a.at.localeCompare(b.at));
  return entries;
}

export function formatTimelineClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}
