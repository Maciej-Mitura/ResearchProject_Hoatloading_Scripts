import { ExecutionCapabilities } from "./ExecutionCapabilities";
import { useState } from "react";
import type {
  Execution,
  ExecutionEvent,
  RiskAssessment,
  SecurityEvent,
} from "../types";
import {
  assessmentLabel,
  dateLabel,
  durationLabel,
  hostCapabilityChain,
  permissionObservations,
} from "../insights";
import { buildExecutionTimeline, formatTimelineClock } from "../timeline";
import { Badge } from "./StatusBadge";
import { InfoTip } from "./InfoTip";
import {
  CollectionBadge,
  ExecutionActivity,
  ExecutionJourney,
  ExecutionStageFlow,
  ResultDiagnostics,
} from "./ExecutionFeedback";
import { collectionState, explainReason, isTerminal } from "../execution-ux";
import { hostInteraction } from "../host-evidence";
import { displayOutput, failureLabel } from "../execution-errors";
import {
  ExecutionErrorCard,
  TechnicalErrorDetails,
  TerminalOutput,
} from "./ExecutionError";

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
function CopyValue({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const [state, setState] = useState("");
  return (
    <div className="copy-value">
      <span>{label}</span>
      <code>{value || "Not recorded"}</code>
      {value && (
        <button
          type="button"
          className="btn btn-small"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setState("Copied");
            } catch {
              setState("Copy unavailable");
            }
          }}
          aria-label={`Copy ${label}`}
        >
          Copy
        </button>
      )}
      <small role="status">{state}</small>
    </div>
  );
}
export function ExecutionDetail({
  execution,
  events = [],
  risk,
  securityEvents = [],
  requestedProfile,
  submittedAt,
  updateError,
  updatedAt,
}: {
  execution: Execution | null;
  events?: ExecutionEvent[];
  risk: RiskAssessment | null;
  securityEvents?: SecurityEvent[];
  requestedProfile?: string;
  submittedAt?: number;
  updateError?: string | null;
  updatedAt?: number;
}) {
  const [tab, setTab] = useState("Output");
  if (!execution)
    return (
      <EmptyState title="No execution selected.">
        Run a stored script to collect execution evidence, or select a run in
        Execution Insights.
      </EmptyState>
    );
  const x = execution.result,
    manifest = x?.manifest;
  const audit = collectionState(execution),
    observations = permissionObservations(execution, securityEvents);
  const chain = hostCapabilityChain(execution, securityEvents);
  const host = hostInteraction(execution, securityEvents);
  const counts = new Map<string, number>();
  for (const row of observations) {
    const category =
      (
        {
          read: "Filesystem",
          write: "Filesystem",
          env: "Environment",
          net: "Network",
          run: "Subprocess",
          ffi: "FFI",
        } as Record<string, string>
      )[row.permission] ?? "Other";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const timeline = buildExecutionTimeline({
    execution,
    executionEvents: events,
    securityEvents,
  });
  const grants = manifest?.denoPermissions;
  return (
    <section className="execution-detail" aria-label="Selected execution">
      <div className="section-heading">
        <div>

          <h2>Execution evidence</h2>
          <p>
            {dateLabel(execution.createdAt)}
          </p>
        </div>
        <span className="explained-badge">
          <Badge label={execution.status} />
          <InfoTip label="Execution outcome">
            Completed means the process finished. Failed records an error.
            Terminated means the process was stopped externally.
          </InfoTip>
        </span>
      </div>
      <ExecutionActivity
        execution={execution}
        requestedProfile={requestedProfile}
        submittedAt={submittedAt}
      />
      {updateError && (
        <p className="notice" role="status">
          {updateError}{" "}
          {updatedAt
            ? `Last successful refresh: ${new Date(updatedAt).toLocaleTimeString()}.`
            : "No successful refresh recorded yet."}
        </p>
      )}
      <ExecutionCapabilities execution={execution} events={securityEvents} />
      <dl className="execution-summary">
        <div>
          <dt>
            Duration{" "}
            <InfoTip label="Execution duration">
              Provider time includes setup and cleanup. It can exceed the
              script time limit.
            </InfoTip>
          </dt>
          <dd>{durationLabel(x?.durationMs)}</dd>
        </div>
        <div>
          <dt>Recorded profile</dt>
          <dd>{manifest?.permissionProfile ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>
            Advisory assessment{" "}
            <InfoTip label="Advisory assessment">
              LOW means no predefined high-risk indicators were found in the
              available structured evidence; it does not mean the script
              succeeded. Advisory risk, process outcome and collection quality
              are independent. HIGH does not establish maliciousness.
            </InfoTip>
          </dt>
          <dd>
            <Badge label={assessmentLabel(risk)} />
          </dd>
        </div>
        <div>
          <dt>Evidence collection</dt>
          <dd>
            <CollectionBadge status={audit} />
          </dd>
        </div>
      </dl>
      <ExecutionJourney execution={execution} risk={risk} />
      <ExecutionErrorCard execution={execution} risk={risk} />
      <ResultDiagnostics execution={execution} risk={risk} />
      <div
        className="detail-tabs"
        role="tablist"
        aria-label="Execution details"
      >
        {["Output", "Evidence", "Runtime", "Timeline"].map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            tabIndex={tab === name ? 0 : -1}
            onKeyDown={(e) => {
              const names = ["Output", "Evidence", "Runtime", "Timeline"];
              let i = names.indexOf(name);
              if (e.key === "ArrowRight") i = (i + 1) % 4;
              else if (e.key === "ArrowLeft") i = (i + 3) % 4;
              else if (e.key === "Home") i = 0;
              else if (e.key === "End") i = 3;
              else return;
              e.preventDefault();
              setTab(names[i]!);
              (
                e.currentTarget.parentElement?.children[i] as HTMLElement
              )?.focus();
            }}
            id={`detail-tab-${name}`}
            aria-controls="execution-tabpanel"
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="execution-tabpanel"
        aria-labelledby={`detail-tab-${tab}`}
        className="detail-body"
      >
        {tab === "Output" && (
          <>
            <p className="hint">Untrusted script output</p>
            {!isTerminal(execution) && !x?.stdout ? (
              <p className="context-note">
                Output will appear when the current execution returns.
              </p>
            ) : (
              <TerminalOutput label="STDOUT" value={x?.stdout ?? ""} />
            )}
            <TechnicalErrorDetails execution={execution} />
            {!x?.stderr && !execution.errorMessage && (
              <p className="hint">STDERR · empty</p>
            )}
            {x?.outputTruncated && (
              <p className="notice">
                Output was truncated at the configured limit; evidence may be
                incomplete.
              </p>
            )}
          </>
        )}
        {tab === "Evidence" && (
          <>
            <div className="section-heading">
              <div>
                <h3>
                  Permission observations{" "}
                  <InfoTip label="Permission observations">
                    Native audit entries describe access/check observations, not
                    reliable allow/deny outcomes or exhaustive behavior
                    detection. Zero observations are inconclusive when
                    collection is incomplete.
                  </InfoTip>
                </h3>
                <p>
                  {observations.length} observations recorded · collection{" "}
                  {audit.replaceAll("_", " ")}
                </p>
              </div>
              <CollectionBadge status={audit} />
            </div>
            {audit !== "complete" && (
              <p className="notice">
                {audit === "pending"
                  ? "Permission evidence is pending while the current execution runs."
                  : `Evidence collection was ${audit.replaceAll("_", " ")}. Absence of observations cannot be interpreted as absence of activity.`}
              </p>
            )}
            {!!x?.auditCollection?.reasons?.length && (
              <ul className="collection-reasons">
                {x.auditCollection.reasons.map((code) => (
                  <li key={code}>
                    <strong>{explainReason(code).title}</strong>
                    <p>{explainReason(code).text}</p>
                  </li>
                ))}
              </ul>
            )}
            {!observations.length ? (
              <EmptyState
                title={
                  audit === "pending"
                    ? "Permission evidence is pending."
                    : audit === "complete"
                      ? "No permission observations were recorded for this execution."
                      : "No observations are available; collection was incomplete or unknown."
                }
              >
                {audit === "complete"
                  ? "Complete collection does not imply exhaustive native instrumentation."
                  : audit === "pending"
                    ? "A final collection result has not been returned yet."
                    : "This cannot be interpreted as absence of activity."}
              </EmptyState>
            ) : (
              <>
                <div
                  className="observation-bars"
                  aria-label="Recorded permission observations by category"
                >
                  {Array.from(counts).map(([name, n]) => (
                    <div key={name}>
                      <span>{name}</span>
                      <div className="observation-track">
                        <span
                          style={{
                            width: `${(n / observations.length) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{n}</strong>
                    </div>
                  ))}
                </div>
                <details className="detail-disclosure">
                  <summary>
                    Inspect {observations.length} recorded observations
                  </summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Permission</th>
                          <th>Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {observations.map((r, i) => (
                          <tr key={i}>
                            <td>{r.permission}</td>
                            <td>
                              <code>{r.target ?? "Not recorded"}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
            <p className="hint">
              Native audit records access/check observations, not allow/deny
              outcomes or malicious intent.
            </p>
            {chain.length ? (
              <section className="host-evidence">
                <h3>
                  Host capability path{" "}
                  <InfoTip label="Host capability and confirmation">
                    The selected profile permits requests; actual usage requires
                    recorded host events. Accepted means queued. Paper
                    acknowledgement confirms a correlated command, while
                    delivery itself is inferred.
                  </InfoTip>
                </h3>
                <p className="scope-caption">
                  {host.capabilities.join(", ") || "Capability not recorded"} ·{" "}
                  {host.requested} requests · {host.authorized} authorized ·{" "}
                  {host.denied} denied · {host.queued.length} queued ·{" "}
                  {host.confirmed} confirmed · {host.failed} failed ·{" "}
                  {host.pending} pending/not recorded. Counts apply to loaded
                  correlated records.
                </p>
                {!!host.reasons.length && (
                  <p className="notice">
                    Recorded host reasons: {host.reasons.join(" · ")}
                  </p>
                )}
                <ExecutionStageFlow
                  label="Host capability flow"
                  stages={chain.map((s) => ({
                    name: s.name,
                    state: s.state === "Observed" ? "Recorded" : s.state,
                    detail: s.detail,
                    provenance:
                      s.state === "Inferred"
                        ? "Inferred"
                        : s.state === "Not recorded"
                          ? "Not recorded"
                          : "Observed",
                  }))}
                />
              </section>
            ) : (
              <p className="context-note">
                No host capability request was recorded for this execution. A
                host-chat profile alone does not establish host activity.
              </p>
            )}
            <details className="detail-disclosure">
              <summary>Stored security events · PostgreSQL</summary>
              <p className="hint">
                Up to 500 stored security records are loaded by the detail API.
                These records do not independently prove OpenTelemetry collector
                receipt.
              </p>
              <ul className="event-list">
                {securityEvents
                  .filter((e) => e.executionId === execution.id)
                  .map((e) => (
                    <li key={e.id}>
                      <strong>{e.eventType}</strong>
                      <span>{displayOutput(e.message)}</span>
                    </li>
                  ))}
              </ul>
            </details>
          </>
        )}
        {tab === "Runtime" && (
          <>
            <p className="context-note">
              Configured runtime controls from this execution's stored manifest.
              Presence is not a claim that every attack was prevented.
            </p>
            <InfoTip label="Configured runtime controls">
              These are stored configuration limits, not proof that all attacks
              were prevented. Missing historical fields are not inferred.
            </InfoTip>
            <dl className="runtime-grid">
              {[
                ["Process exit code", x?.exitCode],
                ["Failure reason", failureLabel(x?.failureCategory)],
                [
                  "Wall deadline reached",
                  x?.timedOut == null ? null : String(x.timedOut),
                ],
                ["Provider", x?.provider],
                ["Runtime", manifest?.dockerRuntime],
                ["Deno", x?.runtimeVersion ?? manifest?.runtimeVersion],
                ["Profile", manifest?.permissionProfile],
                [
                  "Filesystem grant",
                  grants
                    ? grants.read?.join(", ") || "No explicit grant"
                    : null,
                ],
                [
                  "Environment grant",
                  grants ? grants.env?.join(", ") || "No explicit grant" : null,
                ],
                [
                  "Network grant",
                  grants ? grants.net?.join(", ") || "No explicit grant" : null,
                ],
                [
                  "Host capabilities",
                  manifest?.hostCapabilities?.join(", ") ||
                    (manifest?.hostCapabilities ? "None" : null),
                ],
                [
                  "Memory ceiling",
                  manifest?.memoryLimitMb != null
                    ? `${manifest.memoryLimitMb} MiB`
                    : null,
                ],
                ["CPU quota", manifest?.cpuLimit],
                ["PID limit", manifest?.pidsLimit],
                [
                  "Wall deadline",
                  manifest?.timeoutMs != null
                    ? `${manifest.timeoutMs} ms`
                    : null,
                ],
                [
                  "Output bound",
                  manifest?.outputLimitBytes != null
                    ? `${manifest.outputLimitBytes.toLocaleString()} bytes`
                    : null,
                ],
                [
                  "Read-only root",
                  manifest?.rootFilesystemReadOnly == null
                    ? null
                    : String(manifest.rootFilesystemReadOnly),
                ],
                [
                  "Subprocess grant",
                  grants ? grants.run?.join(", ") || "No explicit grant" : null,
                ],
                [
                  "FFI grant",
                  grants ? grants.ffi?.join(", ") || "No explicit grant" : null,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value == null ? "Not recorded" : String(value)}</dd>
                </div>
              ))}
            </dl>
            <details className="detail-disclosure">
              <summary>Technical details &amp; identifiers</summary>
              <CopyValue label="Execution ID" value={execution.id} />
              <CopyValue
                label="Script version ID"
                value={execution.scriptVersionId}
              />
              <CopyValue label="Trace ID" value={x?.traceId} />
              <InfoTip label="Correlation identifiers">
                IDs connect stored records; they are not authorization tokens. A
                matching trusted acknowledgement is required for confirmation.
              </InfoTip>
              <CopyValue
                label="Created timestamp"
                value={execution.createdAt}
              />
              <CopyValue
                label="Started timestamp"
                value={execution.startedAt}
              />
              <CopyValue
                label="Finished timestamp"
                value={execution.finishedAt}
              />
              {host.callIds.map((id) => (
                <CopyValue key={id} label="Call ID" value={id} />
              ))}
              {host.queued.map((id) => (
                <CopyValue key={id} label="Command ID" value={id} />
              ))}
              <h4>Raw collection reason codes</h4>
              <pre className="code">
                {x?.auditCollection?.reasons?.join("\n") || "Not recorded"}
              </pre>

              <p className="hint">
                Trace IDs are correlation, not authorization. Missing
                container/user/capability-mask metadata is not inferred.
              </p>
            </details>
          </>
        )}
        {tab === "Timeline" && (
          <>
            <p className="context-note">
              Reconstructed from PostgreSQL execution/security records. Script
              output is untrusted; this is not an independently exported
              distributed trace.
            </p>
            <ol className="execution-timeline">
              {timeline.map((r, i) => (
                <li key={i}>
                  <time dateTime={r.at} title={r.at}>
                    {formatTimelineClock(r.at)}
                  </time>
                  <div>
                    <strong>{r.label}</strong>
                    <p>{displayOutput(r.detail)}</p>
                    <small>
                      {r.source} · {r.kind}
                      {r.reconstructed
                        ? " · reconstructed placement"
                        : " · stored event time"}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
      <details className="detail-disclosure assessment-details">
        <summary>Advisory assessment details · {assessmentLabel(risk)}</summary>
        {!risk ? (
          <p className="empty">No advisory assessment is available.</p>
        ) : (
          <>
            <dl className="kv">
              <dt>Analyzer</dt>
              <dd>
                {risk.provider}
                {risk.analyzerVersion ? ` v${risk.analyzerVersion}` : ""}
              </dd>
              <dt>Assessment status</dt>
              <dd>{risk.assessmentStatus ?? "Not recorded"}</dd>
              <dt>Classification</dt>
              <dd>{assessmentLabel(risk)}</dd>
              {risk.failureKind && (
                <>
                  <dt>Failure</dt>
                  <dd>{risk.failureKind}</dd>
                </>
              )}
              {risk.provider === "jev" && risk.confidence != null && (
                <>
                  <dt>Model confidence</dt>
                  <dd>{risk.confidence} · not probability of maliciousness</dd>
                </>
              )}
            </dl>
            <ul>
              {risk.reasons?.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        )}
        <p className="hint">
          LOW / REVIEW / HIGH are advisory research categories. They do not
          grant authority or block execution. A completed execution can have
          failed analysis.
        </p>
      </details>
    </section>
  );
}
