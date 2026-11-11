import { useState } from "react";
import type { Execution, RiskAssessment } from "../types";
import { assessmentLabel } from "../insights";
import { outcomeSummary } from "../execution-ux";
import { displayOutput, executionError } from "../execution-errors";

export function ExecutionErrorCard({
  execution,
  risk,
}: {
  execution: Execution;
  risk: RiskAssessment | null;
}) {
  const error = executionError(execution);
  if (!error) return null;
  return (
    <section
      className={`execution-error-card${
        execution.status === "terminated" ? " error-warning" : ""
      }`}
      aria-label="Execution error"
    >
      <span className="error-symbol" aria-hidden="true">
        {execution.status === "terminated" ? "!" : "×"}
      </span>
      <div>

        <h3>
          {error.kind === "timeout" ? outcomeSummary(execution) : error.title}
        </h3>
        <p>{error.explanation}</p>
        {error.location && (
          <p>
            <strong>Location:</strong> {error.location.label}{" "}
            <button
              className="btn btn-small"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("project-error-location", {
                    detail: {
                      versionId: execution.scriptVersionId,
                      path: error.location!.path,
                      line: error.location!.line,
                      column: error.location!.column,
                    },
                  }),
                )}
            >
              Open in editor (matching version only)
            </button>
          </p>
        )}
        <p>
          <strong>Suggested action:</strong> {error.action}
        </p>
        <p className="hint">
          Execution outcome, evidence collection and advisory risk are separate.
          {assessmentLabel(risk) === "LOW"
            ? "LOW does not mean the script succeeded."
            : ""}
        </p>
      </div>
    </section>
  );
}

export function TerminalOutput({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [feedback, setFeedback] = useState("");
  const normalized = displayOutput(value);
  return (
    <>
      <div className="console-title">
        <span>{label}</span>
        <button
          className="btn btn-small"
          type="button"
          disabled={!normalized}
          aria-label={`Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(normalized);
              setFeedback("Copied");
            } catch {
              setFeedback("Copy unavailable");
            }
          }}
        >
          Copy
        </button>
        <small role="status">{feedback}</small>
      </div>
      <pre className="output-console terminal-output">
        {normalized || `No ${label.toLowerCase()} recorded.`}
      </pre>
    </>
  );
}

export function TechnicalErrorDetails({
  execution: x,
}: {
  execution: Execution;
}) {
  const error = executionError(x),
    r = x.result;
  if (!error && !r?.stderr && !x.errorMessage) return null;
  const location = error?.location;
  return (
    <details className="detail-disclosure technical-error-details">
      <summary>
        Technical error details · STDERR{r?.stderr ? " recorded" : " empty"}
      </summary>
      <p className="hint">
        Original diagnostic content with terminal formatting removed. Runtime
        suggestions below are raw tool output, not application recommendations.
      </p>
      <dl className="runtime-grid">
        {[
          ["Exit code", r?.exitCode ?? "Not recorded"],
          ["Failure category code", r?.failureCategory ?? "Not recorded"],
          [
            "Recorded profile",
            r?.manifest?.permissionProfile ?? "Not recorded",
          ],
          ["Source URI", location?.uri ?? "Not recorded"],
          [
            "Line / column",
            location ? `${location.line} / ${location.column}` : "Not recorded",
          ],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <TerminalOutput label="STDERR" value={r?.stderr ?? ""} />
      {x.errorMessage &&
        displayOutput(x.errorMessage).trim() !==
          displayOutput(r?.stderr).trim() &&
        (
          <>
            <h4>Stored error message</h4>
            <pre className="output-console terminal-output">
              {displayOutput(x.errorMessage)}
            </pre>
          </>
        )}
      <details className="detail-disclosure">
        <summary>Raw terminal evidence · escaped control characters</summary>
        <p className="hint">
          Stored values are unchanged. JSON escaping preserves control
          characters for inspection without executing terminal sequences.
        </p>
        <pre className="output-console terminal-output">
          {JSON.stringify(
            { stderr: r?.stderr ?? null, errorMessage: x.errorMessage },
            null,
            2,
          )}
        </pre>
      </details>
    </details>
  );
}
