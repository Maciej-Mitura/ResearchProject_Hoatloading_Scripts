import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { HostEvent, HostStatusResponse } from "../types";

type FilterId = "all" | "players" | "chat" | "commands" | "system";

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "players", label: "Players" },
  { id: "chat", label: "Chat" },
  { id: "commands", label: "Commands" },
  { id: "system", label: "System" },
];

interface Props {
  host: HostStatusResponse | null;
}

export function ServerInfoPanel({ host }: Props) {
  const [events, setEvents] = useState<HostEvent[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [limit, setLimit] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const items = await api.hostEvents(limit, filter);
      if (version !== requestVersion.current) return;
      setEvents(items);
      setError(null);
    } catch (err) {
      if (version === requestVersion.current) setError(String(err));
    }
  }, [limit, filter]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => { clearInterval(t); requestVersion.current++; };
  }, [load]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !stickBottomRef.current) return;
    // Newest-first list: stick to top when following live updates
    el.scrollTop = 0;
  }, [events]);

  const visible = useMemo(
    () => events.filter((e) => matchesFilter(e.eventType, filter)),
    [events, filter],
  );

  const connected = !!host?.connected;

  return (
    <div className="server-info">
      <h2>Server Info</h2>
      <p className="hint server-info-note">
        Live player activity and confirmed SecureBridge broadcasts. Updates every 3 seconds. Script console output is in the Inspector.
      </p>

      <div className="inspector-block">
        <h3>Server status</h3>
        {!host && <p className="empty">Loading…</p>}
        {host && (
          <dl className="kv">
            <dt>Status</dt>
            <dd>{connected ? "Connected" : "Disconnected"}</dd>
            <dt>Server version</dt>
            <dd>{host.connection?.serverVersion ?? "—"}</dd>
            <dt>Plugin</dt>
            <dd>{host.connection?.pluginVersion ?? "—"}</dd>
            <dt>Players</dt>
            <dd>
              {host.connection?.onlinePlayers ?? "—"}
              {typeof host.connection?.metadata?.maxPlayers === "number"
                ? ` / ${host.connection.metadata.maxPlayers}`
                : ""}
            </dd>
            <dt>Last heartbeat</dt>
            <dd>
              {host.connection
                ? new Date(host.connection.lastHeartbeatAt).toLocaleString()
                : "—"}
            </dd>
          </dl>
        )}
        {!connected && (
          <p className="settings-alert settings-alert-warn" style={{ marginTop: "0.5rem" }}>
            SecureBridge is currently disconnected.
          </p>
        )}
      </div>

      <div className="inspector-block">
        <div className="server-log-toolbar">
          <h3 style={{ margin: 0 }}>Activity log</h3>
          <button type="button" className="btn" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        <div className="server-log-filters" role="group" aria-label="Event filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-chip${filter === f.id ? " active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="server-log-limit hint">
          Recent events
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </label>

        <p className="hint">{visible.length} events · newest first · Click a row for details. Broadcasts appear after Paper confirms execution.</p>
        {error && <p className="error-banner">{error}</p>}

        <div
          className="server-log"
          ref={listRef}
          onScroll={(e) => {
            stickBottomRef.current = e.currentTarget.scrollTop < 24;
          }}
        >
          {visible.length === 0 && (
            <p className="empty">No server activity recorded yet.</p>
          )}
          {visible.map((ev) => {
            const view = formatEvent(ev);
            const open = expandedId === ev.id;
            return (
              <div key={ev.id} className={`server-log-row type-${view.label.toLowerCase()}`}>
                <button
                  type="button"
                  className="server-log-main"
                  onClick={() => setExpandedId(open ? null : ev.id)}
                  aria-expanded={open}
                >
                  <span className="server-log-time">{view.time}</span>
                  <span className={`server-log-badge badge-${view.label.toLowerCase()}`}>
                    {view.label}
                  </span>
                  <span className="server-log-text">{view.summary}</span>
                </button>
                {open && (
                  <dl className="kv server-log-details">
                    <dt>Event type</dt>
                    <dd>{ev.eventType}</dd>
                    <dt>Event ID</dt>
                    <dd className="mono-tiny">{ev.id}</dd>
                    <dt>Received</dt>
                    <dd>{new Date(ev.createdAt).toLocaleString()}</dd>
                    {typeof ev.payload.playerId === "string" && (
                      <>
                        <dt>Player UUID</dt>
                        <dd className="mono-tiny">{String(ev.payload.playerId)}</dd>
                      </>
                    )}
                    {typeof ev.payload.timestamp === "string" && (
                      <>
                        <dt>Host timestamp</dt>
                        <dd>{String(ev.payload.timestamp)}</dd>
                      </>
                    )}
                    {(ev.eventType === "command_result" || ev.eventType === "server_broadcast") && (
                      <>
                        <dt>Result</dt>
                        <dd>
                          {ev.payload.success === true
                            ? "success"
                            : ev.payload.success === false
                            ? "failed"
                            : "—"}
                          {typeof ev.payload.message === "string"
                            ? ` — ${ev.payload.message}`
                            : ""}
                        </dd>
                      </>
                    )}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function matchesFilter(eventType: string, filter: FilterId): boolean {
  switch (filter) {
    case "all":
      // Heartbeats every ~5s drown the log; show them under System only.
      return eventType !== "heartbeat";
    case "players":
      return eventType === "player_join" || eventType === "player_leave";
    case "chat":
      return eventType === "player_chat" || eventType === "server_broadcast";
    case "commands":
      return eventType === "player_command" || eventType === "command_result" || eventType === "server_broadcast";
    case "system":
      return (
        eventType === "plugin_started" ||
        eventType === "heartbeat" ||
        eventType === "command_result"
      );
    default:
      return true;
  }
}

function formatEvent(ev: HostEvent): {
  time: string;
  label: string;
  summary: string;
} {
  const time = new Date(ev.createdAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const name = String(ev.payload.playerName ?? "player");

  switch (ev.eventType) {
    case "player_join":
      return { time, label: "JOIN", summary: `${name} joined the server` };
    case "player_leave":
      return { time, label: "LEAVE", summary: `${name} left the server` };
    case "player_chat":
      return {
        time,
        label: "CHAT",
        summary: `${name}: ${String(ev.payload.message ?? "")}`,
      };
    case "server_broadcast":
      return {
        time,
        label: "BROADCAST",
        summary: `[SecureBridge] ${String(ev.payload.broadcastMessage ?? "")}`,
      };
    case "player_command":
      return {
        time,
        label: "COMMAND",
        summary: `${name} ran ${String(ev.payload.command ?? "")}`,
      };
    case "command_result":
      return {
        time,
        label: "RESULT",
        summary: `Host command ${
          ev.payload.success === true ? "ok" : "failed"
        }: ${String(ev.payload.message ?? ev.payload.commandId ?? "")}`,
      };
    case "plugin_started":
      return {
        time,
        label: "BRIDGE",
        summary: `SecureBridge started (${String(ev.payload.pluginVersion ?? "")})`,
      };
    case "heartbeat":
      return {
        time,
        label: "BRIDGE",
        summary: `Heartbeat · ${String(ev.payload.onlinePlayers ?? "?")} players`,
      };
    default:
      return { time, label: "BRIDGE", summary: ev.eventType };
  }
}
