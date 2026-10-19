import { useState, type ReactNode } from "react";
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
  const [convExpanded, setConvExpanded] = useState(false);
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [execExpanded, setExecExpanded] = useState(false);

  return (
    <aside className="panel sidebar" aria-label="Navigation">
      <div className="panel-section sidebar-section">
        <div className="section-head">
          <h2>Conversations</h2>
          <button type="button" className="btn btn-compact" onClick={props.onNewConversation}>
            New
          </button>
        </div>
        <ClippedList
          expanded={convExpanded}
          onToggle={() => setConvExpanded((v) => !v)}
          total={props.conversations.length}
          empty={<p className="empty">No conversations yet.</p>}
        >
          {(convExpanded
            ? props.conversations
            : props.conversations.slice(0, PREVIEW_COUNT)
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              className={`list-item ${props.selectedConversationId === c.id ? "active" : ""}`}
              onClick={() => props.onSelectConversation(c.id)}
            >
              <span className="title">{c.title}</span>
              <span className="meta">{new Date(c.updatedAt).toLocaleString()}</span>
            </button>
          ))}
        </ClippedList>
      </div>

      <div className="panel-section sidebar-section">
        <h2>Scripts / extensions</h2>
        <ClippedList
          expanded={scriptExpanded}
          onToggle={() => setScriptExpanded((v) => !v)}
          total={props.scripts.length}
          empty={<p className="empty">No scripts.</p>}
        >
          {(scriptExpanded ? props.scripts : props.scripts.slice(0, PREVIEW_COUNT)).map((s) => (
            <button
              key={s.id}
              type="button"
              className={`list-item ${props.selectedScriptId === s.id ? "active" : ""}`}
              onClick={() => props.onSelectScript(s.id)}
            >
              <span className="title">{s.name}</span>
              <span className="meta">
                {s.language} · {s.status}
              </span>
            </button>
          ))}
        </ClippedList>
      </div>

      <div className="panel-section sidebar-section">
        <h2>Execution history</h2>
        <ClippedList
          expanded={execExpanded}
          onToggle={() => setExecExpanded((v) => !v)}
          total={props.executions.length}
          empty={<p className="empty">No executions.</p>}
        >
          {(execExpanded
            ? props.executions
            : props.executions.slice(0, PREVIEW_COUNT)
          ).map((e) => (
            <button
              key={e.id}
              type="button"
              className={`list-item ${props.selectedExecutionId === e.id ? "active" : ""}`}
              onClick={() => props.onSelectExecution(e.id)}
            >
              <span className="title">{e.status}</span>
              <span className="meta">{e.id.slice(0, 8)}…</span>
            </button>
          ))}
        </ClippedList>
      </div>
    </aside>
  );
}

function ClippedList({
  children,
  expanded,
  onToggle,
  total,
  empty,
}: {
  children: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  total: number;
  empty: ReactNode;
}) {
  const hasMore = total > PREVIEW_COUNT;

  return (
    <div className={`clipped-list ${expanded ? "is-expanded" : ""}`}>
      <div className="clipped-list-scroll">
        {total === 0 ? empty : children}
      </div>
      {hasMore && (
        <button type="button" className="btn-see-more" onClick={onToggle}>
          {expanded ? "Show less" : `See more (${total - PREVIEW_COUNT} more)`}
        </button>
      )}
    </div>
  );
}
