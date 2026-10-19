import { useEffect, useRef, useState } from "react";
import type { ChatMessage, PublicConfig, ScriptProposal } from "../types";
import { MarkdownMessage } from "./MarkdownMessage";

interface Props {
  messages: ChatMessage[];
  busy: boolean;
  config: PublicConfig | null;
  onSend: (content: string) => Promise<void>;
  latestProposal: ScriptProposal | null;
  onSaveProposal: (proposal: ScriptProposal) => Promise<void>;
}

function providerLabel(config: PublicConfig | null): string {
  if (!config) return "…";
  if (config.chatProvider === "gemini") return "Gemini";
  if (config.chatProvider === "openai") return "OpenAI";
  if (config.chatProvider === "mock") return "Mock";
  return config.chatProvider;
}

export function ChatPanel({
  messages,
  busy,
  config,
  onSend,
  latestProposal,
  onSaveProposal,
}: Props) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, busy]);

  async function submit() {
    const content = text.trim();
    if (!content || busy) return;
    setText("");
    await onSend(content);
  }

  const label = providerLabel(config);

  return (
    <main className="center" aria-label="Chat">
      <header className="chat-header">
        <h1 className="chat-title">
          Assistant <span className="chat-provider">· {label}</span>
          {config?.chatModel ? (
            <span className="chat-model">{config.chatModel}</span>
          ) : null}
        </h1>
      </header>

      <div className="messages" ref={listRef}>
        {messages.length === 0 && !busy && (
          <div className="empty-chat">
            <p className="empty-chat-title">No messages yet</p>
            <p className="empty">
              Describe the extension behavior you want. For example: “When a player joins the
              server, send them a welcome message.”
            </p>
          </div>
        )}

        {messages.map((m) => {
          const proposal = (m.metadata?.proposal as ScriptProposal | null | undefined) ?? null;
          const isUser = m.role === "user";
          const isAssistant = m.role === "assistant";
          return (
            <article
              key={m.id}
              className={`msg msg-${m.role}${m.metadata?.pending ? " msg-pending" : ""}`}
              data-role={m.role}
              data-testid={`msg-${m.role}`}
            >
              <div className="msg-bubble">
                <div className="role">{isUser ? "You" : isAssistant ? "Assistant" : m.role}</div>
                {isAssistant ? (
                  <MarkdownMessage content={m.content} />
                ) : (
                  <div className="body">{m.content}</div>
                )}
                {proposal && (
                  <div className="proposal">
                    <h3>Proposed script: {proposal.name}</h3>
                    <p className="hint">{proposal.description}</p>
                    <pre className="code">{proposal.source}</pre>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {busy && (
          <div className="msg msg-assistant" aria-live="polite" data-testid="msg-loading">
            <div className="msg-bubble msg-loading">
              <div className="role">Assistant</div>
              <div className="typing-indicator">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        {latestProposal && (
          <div className="proposal proposal-save" aria-live="polite">
            <h3>Save proposal as draft?</h3>
            <p className="hint">
              {latestProposal.name} ({latestProposal.language})
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onSaveProposal(latestProposal)}
              >
                Save as draft
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="composer">
        <label className="hint" htmlFor="composer-input">
          Message
        </label>
        <textarea
          id="composer-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Describe the behavior you want…"
          disabled={busy}
          rows={3}
        />
        <div className="composer-actions">
          <span className="hint">Enter to send · Shift+Enter for a new line</span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !text.trim()}
            onClick={() => void submit()}
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}
