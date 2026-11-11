import { useEffect, useState } from "react";
import { api } from "./api/client";
import type {
  Execution,
  ExecutionEvent,
  RiskAssessment,
  SecurityEvent,
} from "./types";
import { isTerminal } from "./execution-ux";
import { hostInteraction } from "./host-evidence";
export interface MonitoredExecution {
  execution: Execution;
  events: ExecutionEvent[];
  securityEvents: SecurityEvent[];
  risk: RiskAssessment | null;
  updatedAt: number;
}
/** Serial reads; cancel obsolete selections, stop terminal reads and bound late-ack grace. */
export function useExecutionMonitor(id: string | null, revision: number) {
  const [data, setData] = useState<MonitoredExecution | null>(null),
    [error, setError] = useState<string | null>(null),
    [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    let cancelled = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      terminalSince: number | undefined,
      failures = 0;
    setData(null);
    setError(null);
    if (!id) {
      setRefreshing(false);
      return;
    }
    const load = async () => {
      setRefreshing(true);
      try {
        const [detail, assessments] = await Promise.all([
          api.getExecution(id),
          api.riskAssessments(id),
        ]);
        const security =
          detail.securityEvents ?? (await api.securityEvents(id));
        if (cancelled) return;
        failures = 0;
        const execution = detail.execution;
        if (execution.id !== id)
          throw new Error("Execution identity did not match the request");
        const risk =
          assessments.find(
            (r) => r.id === execution.riskAssessmentId && r.executionId === id,
          ) ?? null;
        setData({
          execution,
          events: detail.events,
          securityEvents: security.filter((e) => e.executionId === id),
          risk,
          updatedAt: Date.now(),
        });
        setError(null);
        if (!isTerminal(execution)) {
          terminalSince = undefined;
          timer = setTimeout(load, 3000);
        } else {
          terminalSince ??= Date.now();
          const h = hostInteraction(execution, security);
          const assessmentSettled =
            !!risk ||
            execution.status === "blocked" ||
            (execution.status === "failed" && !execution.riskAssessmentId);
          // A bounded follow-up window resolves late Paper acknowledgements and missing analysis records.
          if (
            (!assessmentSettled || h.pending > 0) &&
            Date.now() - terminalSince < 30000
          )
            timer = setTimeout(load, 3000);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          `Updates unavailable: ${String(err)}. Last loaded data is retained; this does not establish execution failure.`,
        );
        failures++;
        timer = setTimeout(load, Math.min(10000, 3000 * failures));
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, revision]);
  return { data, error, refreshing };
}
