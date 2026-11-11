import { InfoTip } from "./InfoTip";
import { profileLabel } from "../permission-workflow";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { ExecutionHistoryItem, Script } from "../types";
import { assessmentLabel, dateLabel, durationLabel } from "../insights";
import { CollectionBadge } from "./ExecutionFeedback";
import { Badge } from "./StatusBadge";
import { EmptyState } from "./ExecutionDetail";

export function filterHistory(
  items: ExecutionHistoryItem[],
  runs: string,
  days: string,
  provider: string,
  order: string,
  now = Date.now(),
) {
  const newest = [...items].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
  const candidates = runs === "latest" ? newest.slice(0, 1) : newest;
  return candidates
    .filter(
      (r) =>
        (provider === "all" || r.provider === provider) &&
        (days === "all" ||
          Date.parse(r.createdAt) >= now - Number(days) * 86400000),
    )
    .sort((a, b) => {
      if (order === "oldest") {
        return (
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
        );
      }
      if (order === "longest" || order === "shortest") {
        if (a.durationMs == null) return b.durationMs == null ? 0 : 1;
        if (b.durationMs == null) return -1;
        const delta = order === "longest"
          ? b.durationMs - a.durationMs
          : a.durationMs - b.durationMs;
        if (delta) return delta;
      }
      return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
    });
}

export function dateRange(
  preset: string,
  from: string,
  to: string,
  now = Date.now(),
) {
  const end = new Date(now);
  let start = new Date(now);
  if (preset === "custom") {
    return {
      start: new Date(from).toISOString(),
      end: new Date(to).toISOString(),
    };
  }
  if (preset === "today") start.setHours(0, 0, 0, 0);
  else start = new Date(now - Number(preset) * 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}
export function ExecutionInsights(
  {
    scripts,
    selectedExecutionId,
    initialExecutionId,
    revision,
    onSelectExecution,
    detail,
  }: {
    scripts: Script[];
    scriptId: string | null;
    selectedExecutionId: string | null;
    initialExecutionId?: string | null;
    revision: number;
    onSelectScript: (id: string) => void;
    onSelectExecution: (id: string) => void;
    detail: React.ReactNode;
  },
) {
  const [preset, setPreset] = useState("30"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [provider, setProvider] = useState("all"),
    [order, setOrder] = useState("newest"),
    [offset, setOffset] = useState(0),
    [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<
      Awaited<ReturnType<typeof api.executionPeriod>> | null
    >(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null),
    [opened, setOpened] = useState<string | null>(initialExecutionId ?? null);
  const detailRef = useRef<HTMLElement | null>(null);
  useEffect(() => setOpened(initialExecutionId ?? null), [initialExecutionId]);
  const range = useMemo(() => {
    try {
      return dateRange(preset, from, to);
    } catch {
      return null;
    }
  }, [preset, from, to, refresh, revision]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    if (!range) {
      setLoading(false);
      setError("Choose both a valid From and To date/time.");
      return;
    }
    api.executionPeriod({
      ...range,
      provider,
      order,
      offset: String(offset),
      limit: "50",
    }, controller.signal).then((x) => {
      if (!controller.signal.aborted) {
        setData(x);
        setLoading(false);
      }
    }).catch((e) => {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [range, provider, order, offset]);
  const row = data?.items.find((r) => r.id === opened);
  const showDetail = !!opened && (!!row || opened === initialExecutionId);
  useEffect(() => {
    if (showDetail) {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView?.({ block: "start" });
    }
  }, [opened, showDetail]);
  function change(setter: (v: string) => void, value: string) {
    setter(value);
    setOffset(0);
  }
  function open(id: string) {
    setOpened(id);
    onSelectExecution(id);
  }
  return (
    <div className="insights-page">
      <header className="page-heading">
        <div>

          <h1>Execution Insights</h1>
          <p>
            Filter recorded runs by date.
          </p>
        </div>
        <button
          className="btn"
          disabled={loading}
          onClick={() => setRefresh((n) => n + 1)}
        >
          ↻ Refresh history
        </button>
      </header>
      <div className="filter-toolbar">
        <label>
          Period<select
            value={preset}
            onChange={(e) => change(setPreset, e.target.value)}
          >
            <option value="today">Today</option>
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {preset === "custom" && (
          <>
            <label>
              From date/time<input
                type="datetime-local"
                value={from}
                onChange={(e) => change(setFrom, e.target.value)}
              />
            </label>
            <label>
              To date/time<input
                type="datetime-local"
                value={to}
                onChange={(e) => change(setTo, e.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Provider<select
            value={provider}
            onChange={(e) => change(setProvider, e.target.value)}
          >
            <option value="all">All providers</option>
            <option value="docker">Docker</option>
            <option value="mock">Mock · simulated</option>
          </select>
        </label>
        <label>
          Sort history<select
            value={order}
            onChange={(e) => change(setOrder, e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="longest">Longest duration first</option>
            <option value="shortest">Shortest duration first</option>
          </select>
        </label>
      </div>
      <p className="scope-caption">
        Times use{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}. 50 runs per page.
        {preset === "custom" && " From is inclusive. To is exclusive. Maximum range: 366 days."}
      </p>
      {error && (
        <p role="alert" className="error-banner">
          History could not be loaded: {error}
        </p>
      )}
      {loading && (
        <p role="status" className="loading-skeleton">
          Loading execution history…
        </p>
      )}
      {data && (
        <>
          <p className="scope-caption">
            {data.total} executions in selected period ·{" "}
            {data.items.length ? offset + 1 : 0}–{offset + data.items.length}
            {" "}
            shown.
          </p>
          {!!data.total && (
            <details className="detail-disclosure">
              <summary>
                Statistics for selected period · all {data.total} executions
              </summary>
              <dl className="runtime-grid">
                {Object.entries({
                  Completed: data.summary.completed,
                  "Advisory LOW": data.summary.low ?? 0,
                  "Advisory REVIEW": data.summary.review ?? 0,
                  "Advisory HIGH": data.summary.high ?? 0,
                  Failed: data.summary.failed,
                  Terminated: data.summary.terminated,
                  "Complete evidence": data.summary.completeEvidence,
                  "Average duration": durationLabel(
                    data.summary.averageDurationMs,
                  ),
                }).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          <section className="history-section">
            <div className="section-heading">
              <h2>Execution history</h2>
              <span className="small-label">Select a run to inspect it</span>
            </div>
            {!data.items.length
              ? (
                <EmptyState title="No executions were recorded during this period.">
                  Choose another date range or provider.
                </EmptyState>
              )
              : (
                <div className="table-scroll">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Time / Script</th>
                        <th>Outcome</th>
                        <th>Profile</th>
                        <th>Duration</th>
                        <th>Advisory assessment</th>
                        <th>
                          Collection{" "}
                          <InfoTip label="Evidence collection">
                            Collection describes the quality of the permission audit.
                            Open a run for its recorded status and reasons.
                          </InfoTip>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((r, i) => (
                        <tr
                          key={r.id}
                          className={r.id === opened ? "selected-row" : ""}
                          onClick={(e) => {
                            if (!(e.target as Element).closest("button")) {
                              open(r.id);
                            }
                          }}
                        >
                          <td>
                            <button
                              className="table-select"
                              aria-label={`Select execution ${i + 1}, ${
                                dateLabel(r.createdAt)
                              }, ${r.status}`}
                              aria-pressed={opened === r.id}
                              onClick={() => open(r.id)}
                            >
                              {dateLabel(r.createdAt)}
                            </button>
                            <small>
                              {r.scriptName ?? scripts.find((s) =>
                                s.id === r.scriptId
                              )?.name ?? "Stored script"} ·{" "}
                              {r.provider ?? "Not recorded"}
                            </small>
                          </td>
                          <td>
                            <Badge label={r.status} />
                          </td>
                          <td>{profileLabel(r.profile)}</td>
                          <td>{durationLabel(r.durationMs)}</td>
                          <td>
                            <Badge label={assessmentLabel(r)} />
                          </td>
                          <td>
                            <CollectionBadge status={r.auditStatus} showHelp={false} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            <div className="history-pagination">
              <button
                className="btn"
                disabled={loading || offset === 0}
                onClick={() =>
                  setOffset((n) => Math.max(0, n - 50))}
              >
                Previous page
              </button>
              <button
                className="btn"
                disabled={loading || offset + data.items.length >= data.total ||
                  offset + 50 > 100000}
                onClick={() => setOffset((n) => n + 50)}
              >
                Next page
              </button>
            </div>
          </section>
        </>
      )}
      {showDetail && (
        <section
          className="selected-run"
          ref={detailRef}
          tabIndex={-1}
          aria-label="Selected run"
        >
          <div className="section-heading">
            <div>
              <h2>Selected run</h2>
              <p>
                {row
                  ? dateLabel(row.createdAt)
                  : "Opened directly from Workbench; this run may be outside the current page or date range."}
                {" "}
                · Details describe this execution only.
              </p>
            </div>
            <button className="btn btn-small" onClick={() => setOpened(null)}>
              Close run details
            </button>
          </div>
          {selectedExecutionId === opened
            ? detail
            : <p role="status">Loading selected execution…</p>}
        </section>
      )}
      {!showDetail && !!data?.total && (
        <p className="history-selection-hint">
          Select a history row to open its execution details and statistics.
        </p>
      )}
    </div>
  );
}
