import { useState } from "react";
import type {
  DenoPermissionsGrant,
  Execution,
  ExecutionEvent,
  HostStatusResponse,
  PermissionProfileId,
  PermissionProfileOption,
  RiskAssessment,
  Script,
  ScriptVersion,
  SecurityEvent,
} from "../types";
import {
  buildExecutionTimeline,
  formatTimelineClock,
} from "../timeline";
import { ProjectSettingsPanel } from "./ProjectSettingsPanel";
import { ServerInfoPanel } from "./ServerInfoPanel";

const PIPELINE: Execution["status"][] = [
  "queued",
  "validating",
  "running",
  "analysing",
  "completed",
];

const DEFAULT_PROFILES: PermissionProfileOption[] = [
  {
    id: "none",
    label: "No permissions",
    description:
      "Deno receives no filesystem, network, environment, subprocess or FFI permissions.",
  },
  {
    id: "read-fixture",
    label: "Read test fixture",
    description:
      "Configured Deno permissions: read /fixtures only (baked-in test file). Not general filesystem access.",
  },
  {
    id: "env-demo",
    label: "Demo environment variable",
    description:
      "Configured Deno permissions: env SANDBOX_DEMO_VALUE only. Application secrets are not injected.",
  },
  {
    id: "host-chat",
    label: "Chat broadcast",
    description:
      "Host capability chat.broadcast via Host Gateway. Network reachability to the gateway is not the same as authority to perform host actions.",
  },
];

type RightTab = "inspector" | "server" | "project" | "security";

interface Props {
  script: Script | null;
  version: ScriptVersion | null;
  execution: Execution | null;
  executionEvents: ExecutionEvent[];
  risk: RiskAssessment | null;
  securityEvents: SecurityEvent[];
  host: HostStatusResponse | null;
  executionProvider?: string;
  permissionProfiles?: PermissionProfileOption[];
  permissionProfile?: PermissionProfileId;
  onPermissionProfileChange?: (id: PermissionProfileId) => void;
  onRun: () => void;
  onBroadcast: () => void;
  running: boolean;
}

function profileLabel(
  id: string | undefined,
  options: PermissionProfileOption[],
): string {
  if (!id) return "—";
  return options.find((p) => p.id === id)?.label ?? id;
}

function formatDenoPermissions(grants: DenoPermissionsGrant): string {
  const parts: string[] = [];
  if (grants.read?.length) parts.push(`read: ${grants.read.join(", ")}`);
  if (grants.env?.length) parts.push(`env: ${grants.env.join(", ")}`);
  if (grants.net?.length) parts.push(`net: ${grants.net.join(", ")}`);
  if (grants.run?.length) parts.push(`run: ${grants.run.join(", ")}`);
  if (grants.write?.length) parts.push(`write: ${grants.write.join(", ")}`);
  if (grants.ffi?.length) parts.push(`ffi: ${grants.ffi.join(", ")}`);
  return parts.length ? parts.join("; ") : "none";
}

function ExecutionTimeline(props: {
  execution: Execution | null;
  executionEvents: ExecutionEvent[];
  securityEvents: SecurityEvent[];
}) {
  const { execution, executionEvents, securityEvents } = props;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!execution) {
    return <p className="empty">Select an execution to see its timeline.</p>;
  }

  const entries = buildExecutionTimeline({
    execution,
    executionEvents,
    securityEvents,
  });

  const traceId =
    execution.result?.traceId ??
    (() => {
      const hit = securityEvents.find(
        (e) =>
          e.executionId === execution.id &&
          typeof e.metadata?.traceId === "string",
      );
      return hit ? String(hit.metadata.traceId) : null;
    })();

  return (
    <div className={`execution-timeline${expanded ? " timeline-expanded" : ""}`}>
      <div className="console-toolbar"><span>{entries.length} recorded events · chronological</span>
        <button type="button" className="btn" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Collapse timeline" : "Expand timeline"}</button>
      </div>
      <ul className="timeline-list" aria-label="Execution timeline events">
        {entries.map((entry, i) => (
          <li key={`${entry.at}-${entry.kind}-${i}`} className="timeline-row">
            <span className="timeline-clock">
              {formatTimelineClock(entry.at)}
            </span>
            <span className="timeline-label">{entry.label}</span>
            {entry.detail && (
              <span className="timeline-detail">{entry.detail}</span>
            )}
            <span className="timeline-source" title="Evidence provenance">
              {entry.source}
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">
        Built from PostgreSQL execution/security evidence. SCRIPT_OUTPUT is
        untrusted. OpenTelemetry shares identifiers for correlation only.
      </p>
      <button
        type="button"
        className="linkish"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? "Hide advanced" : "Advanced details"}
      </button>
      {showAdvanced && (
        <dl className="kv compact">
          <dt>executionId</dt>
          <dd>
            <code>{execution.id}</code>
          </dd>
          <dt>traceId</dt>
          <dd>
            <code>{traceId ?? "(not recorded)"}</code>
            <span className="hint"> — correlation only, not authorization</span>
          </dd>
        </dl>
      )}
    </div>
  );
}

function HostApiActivity(props: {
  execution: Execution | null;
  securityEvents: SecurityEvent[];
}) {
  const { execution, securityEvents } = props;
  if (!execution) {
    return <p className="empty">Select an execution to inspect Host API activity.</p>;
  }

  type Row = { label: string; detail: string };
  const rows: Row[] = [];
  const fromResult = execution.result?.hostApiEvents ?? [];
  if (fromResult.length > 0) {
    for (const ev of fromResult) {
      const kind = ev.eventType.replace(/^host_api\./, "").toUpperCase();
      let detail = ev.capability;
      if (ev.commandId) detail += ` · command ${ev.commandId.slice(0, 8)}…`;
      if (ev.reason) detail += ` · ${ev.reason}`;
      rows.push({ label: kind, detail });
    }
  } else {
    for (const ev of securityEvents) {
      if (ev.executionId !== execution.id) continue;
      if (!ev.eventType.startsWith("host_api.")) continue;
      const kind = ev.eventType.replace(/^host_api\./, "").toUpperCase();
      const capability = String(ev.metadata?.capability ?? "");
      const commandId = ev.metadata?.commandId
        ? String(ev.metadata.commandId)
        : "";
      const reason = ev.metadata?.reason ? String(ev.metadata.reason) : "";
      let detail = capability;
      if (commandId) detail += ` · command ${commandId.slice(0, 8)}…`;
      if (reason) detail += ` · ${reason}`;
      rows.push({ label: kind, detail });
    }
  }

  if (rows.length === 0) {
    return (
      <p className="empty">No Host API activity observed.</p>
    );
  }

  return (
    <ul className="permission-list">
      {rows.map((row, i) => (
        <li key={`${row.label}-${row.detail}-${i}`}>
          <span className="permission-name">{row.label}</span>
          <span className="permission-target">{row.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function PermissionActivity(props: {
  execution: Execution | null;
  securityEvents: SecurityEvent[];
}) {
  const { execution, securityEvents } = props;
  if (!execution) {
    return <p className="empty">Select an execution to inspect permission activity.</p>;
  }

  const fromResult = execution.result?.permissionEvents ?? [];
  const fromDb = securityEvents.filter(
    (ev) =>
      ev.executionId === execution.id &&
      ev.eventType === "permission.accessed",
  );
  const truncated =
    Boolean(execution.result?.permissionAuditTruncated) ||
    securityEvents.some(
      (ev) =>
        ev.executionId === execution.id &&
        ev.eventType === "permission.audit_truncated",
    );

  type Row = { permission: string; target: string | null };
  const rows: Row[] = [];
  if (fromResult.length > 0) {
    for (const ev of fromResult) {
      rows.push({ permission: ev.permission, target: ev.target });
    }
  } else {
    for (const ev of fromDb) {
      const permission = String(ev.metadata?.permission ?? "");
      const target = (ev.metadata?.target as string | null | undefined) ?? null;
      if (permission) rows.push({ permission, target });
    }
  }

  if (rows.length === 0) {
    return (
      <>
        <p className="empty">No permission activity observed.</p>
        {truncated && <p className="hint">Permission audit truncated.</p>}
        <p className="hint">
          Observations are access/check events from Deno&apos;s permission audit —
          not allow/deny labels or malice judgments.
        </p>
      </>
    );
  }

  return (
    <>
      <ul className="permission-list">
        {rows.map((row, i) => (
          <li key={`${row.permission}-${row.target ?? ""}-${i}`}>
            <span className="permission-name">{row.permission.toUpperCase()}</span>
            <span className="permission-target">{row.target ?? "(no target)"}</span>
          </li>
        ))}
      </ul>
      {truncated && <p className="hint">Permission audit truncated.</p>}
      <p className="hint">
        Access/check observations only. A caught Deno error can still leave an
        audit entry even when the script prints success.
      </p>
    </>
  );
}

function stepClass(
  step: Execution["status"],
  current: Execution["status"] | undefined,
  events: ExecutionEvent[] = [],
): string {
  if (!current) return "";
  const terminalFail = ["blocked", "failed", "terminated"];
  if (terminalFail.includes(current) && step === "completed") return "fail";
  const order = PIPELINE.indexOf(step);
  const cur = PIPELINE.indexOf(current);
  if (current === step) return "active";
  if (cur > order || (terminalFail.includes(current) && events.some((event) => PIPELINE.indexOf(event.status) > order))) return "done";
  if (["completed"].includes(current) && order <= 4) return "done";
  return "";
}

export function Inspector(props: Props) {
  const {
    script,
    version,
    execution,
    executionEvents,
    risk,
    securityEvents,
    host,
    executionProvider = "mock",
    permissionProfiles,
    permissionProfile = "none",
    onPermissionProfileChange,
    onRun,
    onBroadcast,
    running,
  } = props;

  const profiles = permissionProfiles?.length
    ? permissionProfiles
    : DEFAULT_PROFILES;
  const selectedMeta =
    profiles.find((p) => p.id === permissionProfile) ??
    DEFAULT_PROFILES[0] ??
    {
      id: "none" as PermissionProfileId,
      label: "No permissions",
      description:
        "Deno receives no filesystem, network, environment, subprocess or FFI permissions.",
    };

  const providerLabel =
    executionProvider === "docker" ? "Docker/Deno" : "Mock";
  const isDocker = executionProvider === "docker";

  const [tab, setTab] = useState<RightTab>("inspector");
  const [wide, setWide] = useState(false);

  return (
    <aside className={`panel inspector${wide ? " inspector-wide" : ""}`} aria-label="Right panel">
      <div className="inspector-heading"><div><span className="eyebrow">WORKSPACE DETAILS</span><strong>{script?.name ?? "Your project"}</strong></div>
        <button type="button" className="btn" aria-pressed={wide} onClick={() => setWide(!wide)}>{wide ? "Compact panel" : "Widen panel"}</button>
      </div>
      <div className="panel-tabs" role="tablist" aria-label="Right panel sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "inspector"}
          className={`panel-tab${tab === "inspector" ? " active" : ""}`}
          onClick={() => setTab("inspector")}
        >
          Inspector
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "server"}
          className={`panel-tab${tab === "server" ? " active" : ""}`}
          onClick={() => setTab("server")}
        >
          Server Info
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "project"}
          className={`panel-tab${tab === "project" ? " active" : ""}`}
          onClick={() => setTab("project")}
        >
          Project Settings
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "security"}
          className={`panel-tab${tab === "security" ? " active" : ""}`}
          onClick={() => setTab("security")}
        >
          Security
        </button>
      </div>

      <div className="panel-section" key={tab}>
        <p className="panel-context">{tab === "server" || tab === "project" ? "Project-wide view · shared across conversations" : "Following your selected script and execution"}</p>
        {tab === "server" && <ServerInfoPanel host={host} />}
        {tab === "project" && <ProjectSettingsPanel />}

        {tab === "security" && (
          <>
            <h2>Security</h2>
            <div className="inspector-block">
              <h3>Permission activity</h3>
              <PermissionActivity
                execution={execution}
                securityEvents={securityEvents}
              />
            </div>
            <div className="inspector-block">
              <h3>Risk assessment</h3>
              {!risk && (
                <p className="empty">
                  Advisory classification appears after execution evidence is
                  analysed.
                </p>
              )}
              {risk && (
                <dl className="kv">
                  <dt>Analyzer</dt>
                  <dd>
                    {risk.provider === "deterministic"
                      ? "Deterministic v1"
                      : risk.provider === "jev"
                      ? "Jev"
                      : risk.provider}
                    {" "}
                    — Advisory assessment
                  </dd>
                  {(risk.assessmentStatus === "failed" ||
                    risk.assessmentStatus === "unavailable" ||
                    risk.classification == null) && (
                    <>
                      <dt>Status</dt>
                      <dd>
                        {risk.provider === "jev"
                          ? "Jev unavailable"
                          : "Provider unavailable"}
                        {risk.failureKind ? ` (${risk.failureKind})` : ""}
                        <span className="hint">
                          {" "}
                          — Deterministic result shown separately when present
                        </span>
                      </dd>
                    </>
                  )}
                  {risk.classification != null && (
                    <>
                      <dt>Classification</dt>
                      <dd>
                        {(risk.classification === "medium"
                          ? "review"
                          : risk.classification).toUpperCase()}
                      </dd>
                    </>
                  )}
                  {risk.provider === "jev" && risk.confidence != null && (
                    <>
                      <dt>Confidence</dt>
                      <dd>
                        {risk.confidence.toFixed(2)}
                        <span className="hint">
                          {" "}
                          — Jev confidence (distribution-derived; not a
                          probability of malice)
                        </span>
                      </dd>
                    </>
                  )}
                  {risk.provider !== "jev" && (
                    <>
                      <dt>Score</dt>
                      <dd>
                        {risk.score.toFixed(2)}
                        <span className="hint">
                          {" "}
                          — not a probability of malice
                        </span>
                      </dd>
                    </>
                  )}
                  <dt>Reasons</dt>
                  <dd>
                    <ul className="hint" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                      {risk.reasons.map((reason, i) => (
                        <li key={`${reason}-${i}`}>{reason}</li>
                      ))}
                    </ul>
                  </dd>
                </dl>
              )}
              <p className="hint">
                LOW / REVIEW / HIGH are research categories — not
                &quot;safe&quot; / &quot;malicious&quot;. Risk does not authorize
                or block host actions. Jev never grants Deno, Docker, or Host
                Gateway authority.
              </p>
            </div>
            <div className="inspector-block">
              <h3>Telemetry / security events</h3>
              {securityEvents.length === 0 && <p className="empty">No events.</p>}
              <ul className="hint" style={{ paddingLeft: "1.1rem", margin: 0 }}>
                {securityEvents.slice(0, 8).map((ev) => (
                  <li key={ev.id}>
                    [{ev.severity}] {ev.eventType}: {ev.message}
                  </li>
                ))}
              </ul>
            </div>
            <p className="hint">
              Configured security policy in Project Settings is research intent.
              Execution enforcement may still be mocked.
            </p>
          </>
        )}

        {tab === "inspector" && (
          <>
            <h2>Inspector</h2>

            <div className="inspector-block">
              <h3><span className="section-number">01</span> Prepare your script</h3>
              {!script && <p className="empty">Select a script.</p>}
              {script && (
                <>
                  <details className="detail-disclosure"><summary>Review source &amp; script details</summary>
                  <dl className="kv">
                    <dt>Name</dt>
                    <dd>{script.name}</dd>
                    <dt>Status</dt>
                    <dd>{script.status}</dd>
                    <dt>Language</dt>
                    <dd>{script.language}</dd>
                    <dt>Version</dt>
                    <dd>{version ? `v${version.versionNumber}` : "—"}</dd>
                  </dl>
                  {version && <pre className="code">{version.source}</pre>}
                  </details>
                  <div className="permission-profile-picker">
                    <label htmlFor="permission-profile">
                      Permission profile
                    </label>
                    <select
                      id="permission-profile"
                      value={permissionProfile}
                      disabled={running}
                      onChange={(e) =>
                        onPermissionProfileChange?.(
                          e.target.value as PermissionProfileId,
                        )
                      }
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <p className="hint">{selectedMeta.description}</p>
                  </div>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!script || running}
                      onClick={onRun}
                    >
                      {running ? "Running…" : "Run"}
                    </button>
                  </div>
                  <p className="hint">
                    Execution provider: {providerLabel}
                    {isDocker
                      ? " — runs the stored script in a fresh restricted Docker/Deno container. Profile is one defense-in-depth layer."
                      : " — simulates pipeline states; does not execute script source."}
                  </p>
                </>
              )}
            </div>

            <div className="inspector-block">
              <h3><span className="section-number">02</span> Follow the execution</h3>
              {!execution && <p className="empty">No execution selected.</p>}
              {execution && (
                <>
                  <div className={`run-summary state-${execution.status}`} role="status">
                    <span className="eyebrow">CURRENT STATE</span><strong>{execution.status}</strong>
                    <p>{execution.status === "completed" ? "Execution finished. Review the output and recorded activity below." : execution.status === "analysing" ? "Source has finished running. Assessing its recorded behavior." : execution.status === "running" ? "Your script is running inside the execution environment." : execution.status === "terminated" ? "The run was stopped. Check the timeout and failure details." : execution.status === "failed" || execution.status === "blocked" ? "The run could not complete. Check the error output and recorded evidence." : "Preparing the execution request."}</p>
                    <div className="run-facts"><span>{execution.result?.provider === "docker" ? "Docker / Deno" : execution.result?.provider === "mock" ? "Mock" : providerLabel}</span><span>{execution.result ? `${execution.result.durationMs} ms` : "In progress"}</span><span>{execution.result?.timedOut ? "Timed out" : execution.result?.exitCode != null ? `Exit ${execution.result.exitCode}` : execution.result ? "No exit code" : "Exit pending"}</span></div>
                  </div>
                  <div className="pipeline" aria-label="Execution pipeline">
                    {PIPELINE.map((step) => (
                      <div
                        key={step}
                        className={`pipeline-step ${stepClass(step, execution.status, executionEvents)}`}
                      >
                        <span
                          className={`status-dot ${
                            stepClass(step, execution.status, executionEvents) === "fail"
                              ? "err"
                              : stepClass(step, execution.status, executionEvents)
                              ? "ok"
                              : ""
                          }`}
                        />
                        {step}
                        {execution.status === step ||
                        (["blocked", "failed", "terminated"].includes(execution.status) &&
                          step === "completed")
                          ? ` ← ${execution.status}`
                          : ""}
                      </div>
                    ))}
                  </div>
                  {execution && (
                    <div className="inspector-block" style={{ marginTop: "0.75rem" }}>
                      <h3>Execution timeline</h3>
                      <ExecutionTimeline
                        execution={execution}
                        executionEvents={executionEvents}
                        securityEvents={securityEvents}
                      />
                    </div>
                  )}
                  {execution.result && (
                    <div className="exec-output">
                      <div className="console-toolbar"><strong>Execution console</strong><span>STDOUT · script output</span></div>
                      <pre className="code output">
                        {execution.result.stdout || "(empty)"}
                      </pre>
                      <h4>STDERR · errors</h4>
                      <pre className="code output">
                        {execution.result.stderr || "(empty)"}
                      </pre>
                      {execution.result.outputTruncated && (
                        <p className="hint">
                          Output truncated at configured limit.
                        </p>
                      )}
                    </div>
                  )}
                  <details className="detail-disclosure"><summary>Runtime, permissions &amp; identifiers</summary>
                  <dl className="kv">
                    <dt>ID</dt>
                    <dd>{execution.id}</dd>
                    <dt>Status</dt>
                    <dd>{execution.status}</dd>
                    <dt>Provider</dt>
                    <dd>
                      {execution.result?.provider === "docker"
                        ? "Docker/Deno"
                        : execution.result?.provider === "mock"
                        ? "Mock"
                        : providerLabel}
                    </dd>
                    {execution.result && (
                      <>
                        <dt>Duration</dt>
                        <dd>{execution.result.durationMs} ms</dd>
                        <dt>Exit code</dt>
                        <dd>
                          {execution.result.timedOut
                            ? "—"
                            : execution.result.exitCode ?? "—"}
                        </dd>
                        {execution.result.runtimeVersion && (
                          <>
                            <dt>Deno</dt>
                            <dd>{execution.result.runtimeVersion}</dd>
                          </>
                        )}
                        {execution.result.manifest?.permissionProfile && (
                          <>
                            <dt>Permission profile</dt>
                            <dd>
                              {profileLabel(
                                execution.result.manifest.permissionProfile,
                                profiles,
                              )}
                              <span className="hint">
                                {" "}
                                ({execution.result.manifest.permissionProfile})
                              </span>
                            </dd>
                          </>
                        )}
                        {execution.result.manifest?.denoPermissions && (
                          <>
                            <dt>Configured Deno permissions</dt>
                            <dd>
                              {formatDenoPermissions(
                                execution.result.manifest.denoPermissions,
                              )}
                            </dd>
                          </>
                        )}
                        {execution.result.manifest?.hostCapabilities &&
                          execution.result.manifest.hostCapabilities.length >
                            0 && (
                          <>
                            <dt>Host capabilities</dt>
                            <dd>
                              {execution.result.manifest.hostCapabilities.join(
                                ", ",
                              )}
                            </dd>
                          </>
                        )}
                        {execution.result.manifest?.dockerNetwork && (
                          <>
                            <dt>Docker network</dt>
                            <dd>{execution.result.manifest.dockerNetwork}</dd>
                          </>
                        )}
                        {execution.result.failureCategory && (
                          <>
                            <dt>Failure</dt>
                            <dd>{execution.result.failureCategory}</dd>
                          </>
                        )}
                      </>
                    )}
                  </dl>
                  </details>
                  <details className="detail-disclosure"><summary>Permission checks &amp; host API activity</summary>
                  {execution && (
                    <div className="inspector-block" style={{ marginTop: "0.75rem" }}>
                      <h3>Permission activity</h3>
                      <PermissionActivity
                        execution={execution}
                        securityEvents={securityEvents}
                      />
                    </div>
                  )}
                  {execution && (
                    <div className="inspector-block" style={{ marginTop: "0.75rem" }}>
                      <h3>Host API activity</h3>
                      <HostApiActivity
                        execution={execution}
                        securityEvents={securityEvents}
                      />
                    </div>
                  )}
                  </details>
                </>
              )}
            </div>

            <div className="inspector-block">
              <h3><span className="section-number">03</span> Check the host</h3>
              {!host && <p className="empty">Loading…</p>}
              {host && (
                <>
                  <dl className="kv">
                    <dt>Connected</dt>
                    <dd>{host.connected ? "yes" : "no"}</dd>
                    <dt>Players</dt>
                    <dd>{host.connection?.onlinePlayers ?? "—"}</dd>
                    <dt>Plugin</dt>
                    <dd>{host.connection?.pluginVersion ?? "—"}</dd>
                    <dt>Server</dt>
                    <dd>{host.connection?.serverVersion ?? "—"}</dd>
                    <dt>Heartbeat</dt>
                    <dd>
                      {host.connection
                        ? new Date(host.connection.lastHeartbeatAt).toLocaleString()
                        : "—"}
                    </dd>
                    <dt>Pending cmds</dt>
                    <dd>{host.pendingCommands}</dd>
                  </dl>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn"
                      onClick={onBroadcast}
                      disabled={!host.connected}
                    >
                      Queue broadcast
                    </button>
                  </div>
                  <p className="hint">
                    Observed runtime state (separate from Project Settings). Allowlisted host
                    command only.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
