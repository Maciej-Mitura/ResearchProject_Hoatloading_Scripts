import { profileLabel } from "../permission-workflow";
import { useEffect, useState } from "react";
import type { Execution, RiskAssessment } from "../types";
import {
  collectionHelp,
  executionJourney,
  stageVisual,
  type JourneyStage,
  provenanceHelp,
  outcomeSummary,
  isTerminal,
  explainReason,
} from "../execution-ux";
import { assessmentLabel } from "../insights";
import { Badge } from "./StatusBadge";
import { InfoTip } from "./InfoTip";
import {
  displayOutput,
  executionError,
  failureLabel,
} from "../execution-errors";
export function CollectionBadge({
  status,
  showHelp = true,
}: { status: string; showHelp?: boolean }) {
  const info = collectionHelp[status] ?? collectionHelp.not_recorded!;
  return (
    <span className="explained-badge">
      <Badge
        label={info.label}
        tone={
          status === "complete"
            ? "success"
            : status === "partial"
              ? "warning"
              : "neutral"
        }
      />
      {showHelp && (
        <InfoTip label={`Evidence collection: ${info.label}`}>
          {info.text}
        </InfoTip>
      )}
    </span>
  );
}
export function ExecutionJourney({
  execution,
  risk,
}: {
  execution: Execution | null;
  risk: RiskAssessment | null;
}) {
  return (
    <>
      <div className="journey-heading">
        <span className="small-label">Execution path</span>
        <InfoTip label="Execution stages and provenance">
          <p>Lifecycle state and provenance answer different questions.</p>
          {Object.entries(provenanceHelp).map(([name, text]) => (
            <p key={name}>
              <b>{name}:</b> {text}
            </p>
          ))}
          <p>
            Collection can be unavailable even though its status was recorded.
          </p>
        </InfoTip>
      </div>
      <ExecutionStageFlow
        stages={executionJourney(execution, risk)}
        label="Recorded execution path"
      />
    </>
  );
}
export function ExecutionStageFlow({
  stages,
  label,
}: {
  stages: JourneyStage[];
  label: string;
}) {
  return (
    <ol className="execution-lifecycle" aria-label={label}>
      {stages.map((s) => {
        const visual = stageVisual(s);
        const assessmentRecorded = s.name === "Assessment" && visual.kind === "reached";
        return (
          <li
            key={s.name}
            className={`lifecycle-step lifecycle-${assessmentRecorded ? "recorded" : visual.kind}`}
            aria-current={s.active ? "step" : undefined}
          >
            <span
              className="lifecycle-node"
              role="img"
              aria-label={`${s.name}: ${assessmentRecorded ? "Record returned" : visual.meaning}`}
            >
              {assessmentRecorded ? "•" : visual.icon}
            </span>
            <div className="lifecycle-content">
              <strong>{s.name}</strong>
              <div className="lifecycle-state">
                <span>{s.state}</span>
                <InfoTip label={`${s.name} stage: ${s.state}`}>
                  <p>{s.detail}</p>
                  <p>
                    <b>
                      {s.provenance}
                      {s.name === "Evidence" && s.provenance === "Observed"
                        ? " status record"
                        : ""}
                      :
                    </b>{" "}
                    {provenanceHelp[s.provenance]}
                  </p>
                  {s.name === "Assessment" && (
                    <p>
                      This node marks the return of an advisory assessment.
                      Check the result stage for the script outcome.
                    </p>
                  )}
                </InfoTip>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
export function ExecutionActivity({
  execution,
  requestedProfile,
  submittedAt,
}: {
  execution: Execution | null;
  requestedProfile?: string;
  submittedAt?: number;
}) {
  const [now, setNow] = useState(Date.now());
  const active = !execution || !isTerminal(execution);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active, execution?.id]);
  if (!active) return null;
  const since =
    submittedAt ?? (execution ? Date.parse(execution.createdAt) : now);
  return (
    <section
      className="execution-activity"
      aria-label="Current execution activity"
    >
      <span className="activity-spinner" aria-hidden="true" />
      <div>
        <h3 role="status" aria-live="polite">
          {execution ? outcomeSummary(execution) : "Sending execution request…"}
        </h3>
        <p>
          Elapsed since request{" "}
          <span role="timer" aria-live="off">
            {(Math.max(0, now - since) / 1000).toFixed(1)} s
          </span>{" "}
          ·{" "}
          {execution?.result?.manifest?.permissionProfile
            ? "Recorded"
            : "Requested"}{" "}
          mode:{" "}
          <strong>
            {profileLabel(execution?.result?.manifest?.permissionProfile ?? requestedProfile)}
          </strong>
        </p>
        <small>
          Output will be available in Execution Insights when the current
          execution returns. Elapsed time is not a percentage or final process
          duration.
        </small>
      </div>
    </section>
  );
}
export function ResultDiagnostics({
  execution: x,
  risk,
}: {
  execution: Execution;
  risk: RiskAssessment | null;
}) {
  if (!isTerminal(x)) return null;
  const r = x.result;
  const nonSuccess = x.status !== "completed",
    attention =
      nonSuccess ||
      ["HIGH", "REVIEW", "Failed", "Unavailable"].includes(
        assessmentLabel(risk),
      );
  const audit =
    r?.auditCollection?.status ?? (r ? "legacy_unknown" : "not_recorded");
  const timing = (v: string | null) =>
    v && Number.isFinite(Date.parse(v))
      ? new Date(v).toLocaleString(undefined, {
          hour12: false,
          timeZoneName: "short",
        })
      : "Not recorded";
  return (
    <>
      {!executionError(x) && (
        <div
          className={`result-summary ${nonSuccess ? "result-attention" : ""}`}
          role="status"
        >
          <strong>{outcomeSummary(x)}</strong>
          <p>
            {audit === "complete"
              ? "Permission-evidence collection finished normally; observations are not exhaustive behavior detection."
              : audit === "unavailable"
                ? "Final permission-audit evidence was not available. Process outcome, captured output and separate host records may still be available."
                : `Evidence collection: ${collectionHelp[audit]?.label ?? "Not recorded"}.`}
          </p>
          <small>
            Captured stdout is untrusted script text; it is not proof of a host
            effect. {r?.outputTruncated ? "Output capture was truncated." : ""}
          </small>
        </div>
      )}
      <details
        className="detail-disclosure result-diagnostics"
      >
        <summary>
          {attention
            ? "Why this result? · Execution diagnostics"
            : "Execution diagnostics"}
        </summary>
        <dl className="runtime-grid">
          {[
            ["Outcome", x.status],
            ["Requested at", timing(x.createdAt)],
            ["Processing started", timing(x.startedAt)],
            ["Finished at", timing(x.finishedAt)],
            ["Exit code", r?.exitCode ?? "Not recorded"],
            ["Reason", failureLabel(r?.failureCategory)],
            [
              "Recorded profile",
              r?.manifest?.permissionProfile ?? "Not recorded",
            ],
            ...(executionError(x)?.suggestedProfile
              ? [["Suggested profile", "host-chat"]]
              : []),
            [
              "Configured deadline",
              r?.manifest?.timeoutMs != null
                ? `${r.manifest.timeoutMs} ms`
                : "Not recorded",
            ],
            [
              "OOM killed",
              r?.oomKilled == null ? "Not recorded" : String(r.oomKilled),
            ],
            [
              "Output truncated",
              r?.outputTruncated == null
                ? "Not recorded"
                : String(r.outputTruncated),
            ],
            [
              "Cleanup",
              Array.isArray(r?.cleanupErrors)
                ? r.cleanupErrors.length
                  ? r.cleanupErrors.join(" · ")
                  : "No cleanup errors reported"
                : "Not recorded",
            ],
          ].map(([name, value]) => (
            <div key={String(name)}>
              <dt>{name}</dt>
              <dd>
                {typeof value === "string" ? displayOutput(value) : value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="diagnostic-reasons">
          <section>
            <h3>Evidence collection</h3>
            {r?.auditCollection?.reasons?.length ? (
              <ul>
                {r.auditCollection.reasons.map((code) => (
                  <li key={code}>
                    <strong>{explainReason(code).title}</strong>
                    <p>{explainReason(code).text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">{collectionHelp[audit]?.text}</p>
            )}
          </section>
          <section>
            <h3>
              Advisory assessment · {assessmentLabel(risk)}{" "}
              <InfoTip label="Advisory assessment">
                Classification comes from the stored analyzer result. It is
                separate from process success and evidence quality, and does not
                establish maliciousness or grant permissions.
              </InfoTip>
            </h3>
            {risk?.reasons?.length ? (
              <ul>
                {risk.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="hint">No advisory reason record is available.</p>
            )}
            <p className="hint">
              {risk
                ? `Analyzer: ${risk.provider}; status: ${risk.assessmentStatus ?? "Not recorded"}${risk.failureKind ? `; failure: ${risk.failureKind}` : ""}.`
                : "No advisory assessment is available."}
            </p>
          </section>
        </div>
      </details>
    </>
  );
}
