import type { Execution, SecurityEvent } from "../types";
import { isTerminal, outcomeSummary } from "../execution-ux";
import { executionError } from "../execution-errors";
import { ExecutionActivity } from "./ExecutionFeedback";
import { Badge } from "./StatusBadge";

/** Workbench stays focused on running; full evidence belongs in Insights. */
export function WorkbenchExecution({
  execution,
  events = [],
  submitting,
  loading,
  requestedProfile,
  submittedAt,
  updateError,
  onView,
  onRefresh,
}: {
  execution: Execution | null;
  events?: SecurityEvent[];
  submitting: boolean;
  loading: boolean;
  requestedProfile?: string;
  submittedAt?: number;
  updateError?: string | null;
  onView: () => void;
  onRefresh: () => void;
}) {
  const active = submitting || (!!execution && !isTerminal(execution));
  const diagnostic = execution ? executionError(execution) : null;
  return (
    <section className="workbench-execution" aria-label="Execution status">
      <div className="section-heading">
        <h2>Execution status</h2>
        {execution && <Badge label={execution.status} />}
      </div>
      {active ? (
        <ExecutionActivity
          execution={submitting ? null : execution}
          requestedProfile={requestedProfile}
          submittedAt={submittedAt}
        />
      ) : loading ? (
        <p role="status">Loading selected execution status…</p>
      ) : execution ? (
        <div className="compact-run-result">
          <span
            className={`run-result-icon run-${execution.status}`}
            aria-hidden="true"
          >
            {execution.status === "completed"
              ? "✓"
              : execution.status === "terminated"
                ? "!"
                : "×"}
          </span>
          <div>
            <h3>{diagnostic?.title ?? outcomeSummary(execution)}</h3>
            {diagnostic && <p>{outcomeSummary(execution)}</p>}
            <button type="button" className="btn btn-primary" onClick={onView}>
              View in Execution Insights →
            </button>
          </div>
        </div>
      ) : (
        <p className="hint">
          Run a saved script to see its status here.
        </p>
      )}
      {active && events.some(e=>e.executionId===execution?.id && e.eventType.startsWith("host_api.")) && <p role="status">Host capability activity: {events.filter(e=>e.executionId===execution?.id && e.eventType==="host_api.requested").length} requested · {events.filter(e=>e.executionId===execution?.id && e.eventType==="host_api.allowed").length} authorized · {events.filter(e=>e.executionId===execution?.id && e.eventType==="host.command.result").length} Paper results received</p>}
      {updateError && (
        <div className="notice" role="status">
          <p>
            Execution updates are unavailable. Retrying automatically; this does
            not indicate script failure.
          </p>
          <button type="button" className="btn btn-small" onClick={onRefresh}>
            Retry status update
          </button>
        </div>
      )}
    </section>
  );
}
