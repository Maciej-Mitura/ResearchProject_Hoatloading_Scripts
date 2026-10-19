import { useState } from "react";
import type {
  Execution,
  ExecutionEvent,
  HostStatusResponse,
  RiskAssessment,
  Script,
  ScriptVersion,
  SecurityEvent,
} from "../types";
import { ProjectSettingsPanel } from "./ProjectSettingsPanel";
import { ServerInfoPanel } from "./ServerInfoPanel";

const PIPELINE: Execution["status"][] = [
  "queued",
  "validating",
  "analysing",
  "running",
  "completed",
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
  onRunMock: () => void;
  onBroadcast: () => void;
  running: boolean;
}

function stepClass(
  step: Execution["status"],
  current: Execution["status"] | undefined,
): string {
  if (!current) return "";
  const terminalFail = ["blocked", "failed", "terminated"];
  if (terminalFail.includes(current) && step === "completed") return "fail";
  const order = PIPELINE.indexOf(step);
  const cur = PIPELINE.indexOf(current);
  if (current === step) return "active";
  if (cur > order || (terminalFail.includes(current) && order < 3)) return "done";
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
    onRunMock,
    onBroadcast,
    running,
  } = props;

  const [tab, setTab] = useState<RightTab>("inspector");

  return (
    <aside className="panel inspector" aria-label="Right panel">
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

      <div className="panel-section">
        {tab === "server" && <ServerInfoPanel host={host} />}
        {tab === "project" && <ProjectSettingsPanel />}

        {tab === "security" && (
          <>
            <h2>Security</h2>
            <div className="inspector-block">
              <h3>Requested permissions</h3>
              <p className="empty">Placeholder — RESEARCH TODO</p>
            </div>
            <div className="inspector-block">
              <h3>Risk analysis</h3>
              {!risk && <p className="empty">Advisory mock results appear after analysis.</p>}
              {risk && (
                <dl className="kv">
                  <dt>Class</dt>
                  <dd>{risk.classification}</dd>
                  <dt>Score</dt>
                  <dd>{risk.score.toFixed(2)}</dd>
                  <dt>Confidence</dt>
                  <dd>{risk.confidence.toFixed(2)}</dd>
                  <dt>Provider</dt>
                  <dd>{risk.provider} (advisory only)</dd>
                  <dt>Reasons</dt>
                  <dd>{risk.reasons.join("; ")}</dd>
                </dl>
              )}
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
              <h3>Selected script</h3>
              {!script && <p className="empty">Select a script.</p>}
              {script && (
                <>
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
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!script || running}
                      onClick={onRunMock}
                    >
                      {running ? "Running mock…" : "Run mock execution"}
                    </button>
                  </div>
                  <p className="hint">
                    Does not execute untrusted code. Simulates pipeline states only.
                  </p>
                </>
              )}
            </div>

            <div className="inspector-block">
              <h3>Execution state</h3>
              {!execution && <p className="empty">No execution selected.</p>}
              {execution && (
                <>
                  <dl className="kv">
                    <dt>ID</dt>
                    <dd>{execution.id}</dd>
                    <dt>Status</dt>
                    <dd>{execution.status}</dd>
                  </dl>
                  <div className="pipeline" aria-label="Mock pipeline">
                    {PIPELINE.map((step) => (
                      <div
                        key={step}
                        className={`pipeline-step ${stepClass(step, execution.status)}`}
                      >
                        <span
                          className={`status-dot ${
                            stepClass(step, execution.status) === "fail"
                              ? "err"
                              : stepClass(step, execution.status)
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
                  {executionEvents.length > 0 && (
                    <ul className="hint" style={{ paddingLeft: "1.1rem" }}>
                      {executionEvents.map((ev) => (
                        <li key={ev.id}>
                          {ev.status}: {ev.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="inspector-block">
              <h3>Connected host</h3>
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
