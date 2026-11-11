import { useState } from "react";
import type { Conversation, Execution, Script } from "../types";

const PREVIEW_COUNT = 4;

interface Props {
  conversations: Conversation[];
  scripts: Script[];
  executions: Execution[];
  selectedConversationId: string | null;
  selectedScriptId: string | null;
  selectedExecutionId: string | null;
  onSelectConversation: (id: string) => void;
  onSelectScript: (id: string) => void;
  onSelectExecution: (id: string) => void;
  onNewConversation: () => void;
}

export function Sidebar(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const visible = props.scripts.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <aside className="script-library" aria-label="Navigation">
      <div className="library-heading">
        <h2>Script library</h2>
        <span>{props.scripts.length}</span>
      </div>
      <label className="sr-only" htmlFor="script-search">
        Find a script
      </label>
      <input
        id="script-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a script…"
      />
      <div className="library-list">
        {(expanded || query ? visible : visible.slice(0, 8)).map((s) => (
          <button
            type="button"
            key={s.id}
            className={`list-item ${props.selectedScriptId === s.id ? "active" : ""}`}
            aria-pressed={props.selectedScriptId === s.id}
            onClick={() => props.onSelectScript(s.id)}
          >
            <span className="title">{s.name}</span>
            <span className="meta">
              {s.language === "typescript" ? "TS" : "JS"} · {s.status}
            </span>
          </button>
        ))}
        {!visible.length && (
          <p className="empty">
            {query ? "No matching scripts." : "No stored scripts yet."}
          </p>
        )}
        {visible.length > 8 && !query && (
          <button
            type="button"
            className="btn-see-more"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? "Show fewer scripts"
              : `See more (${visible.length - 8} more)`}
          </button>
        )}
      </div>
      <details className="library-secondary">
        <summary>
          Assistant conversations <span>{props.conversations.length}</span>
        </summary>
        <button
          type="button"
          className="btn btn-small"
          onClick={props.onNewConversation}
        >
          New conversation
        </button>
        {props.conversations.map((c) => (
          <button
            type="button"
            key={c.id}
            className={`list-item ${props.selectedConversationId === c.id ? "active" : ""}`}
            onClick={() => props.onSelectConversation(c.id)}
          >
            <span className="title">{c.title}</span>
            <span className="meta">
              {new Date(c.updatedAt).toLocaleDateString()}
            </span>
          </button>
        ))}
      </details>
      {!!props.executions.length && (
        <details className="library-secondary" open>
          <summary>
            Selected script runs <span>{props.executions.length}</span>
          </summary>
          {(historyExpanded
            ? props.executions
            : props.executions.slice(0, PREVIEW_COUNT)
          ).map((e) => (
            <button
              type="button"
              key={e.id}
              data-testid={`history-${e.id}`}
              className={`list-item ${props.selectedExecutionId === e.id ? "active" : ""}`}
              onClick={() => props.onSelectExecution(e.id)}
            >
              <span className="title">{e.status}</span>
              <span className="meta">
                {new Date(e.createdAt).toLocaleString()}
              </span>
            </button>
          ))}
          {props.executions.length > PREVIEW_COUNT && (
            <button
              type="button"
              className="btn-see-more"
              onClick={() => setHistoryExpanded((v) => !v)}
            >
              {historyExpanded ? "Show fewer runs" : "See more runs"}
            </button>
          )}
          <p className="hint">
            Latest loaded runs. Full per-script window in Insights.
          </p>
        </details>
      )}
    </aside>
  );
}
