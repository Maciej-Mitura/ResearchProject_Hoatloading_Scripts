import { useEffect, useRef, useState } from "react";
import type { ChatMessage, PublicConfig, ScriptProposal } from "../types";
import { messageProposals } from "../workbench";
import { MarkdownMessage } from "./MarkdownMessage";
import {
  ChatCapabilityReview,
  type SaveChatProposal,
} from "./ChatCapabilityReview";

interface Props {
  messages: ChatMessage[];
  busy: boolean;
  config: PublicConfig | null;
  onSend: (content: string) => Promise<void>;
  latestProposal: ScriptProposal | null;
  onSaveProposal: SaveChatProposal;
  savedSources?: string[];
  saving?: boolean;
}

function providerLabel(config: PublicConfig | null): string {
  if (!config) return "…";
  if (config.chatProvider === "gemini") return "Gemini";
  if (config.chatProvider === "openai") return "OpenAI";
  if (config.chatProvider === "mock") return "Mock";
  return "Unavailable";
}

export function ChatPanel({
  messages,
  busy,
  config,
  onSend,
  onSaveProposal,
  savedSources = [],
  saving = false,
}: Props) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "auto", block: "nearest" });
  }, [messages, busy]);

  async function submit() {
    const content = text.trim();
    if (!content || disabled) return;
    setText("");
    await onSend(content);
  }

  const label = providerLabel(config);
  const unavailable = !!config &&
    (config.chatStatus === "unavailable" ||
      !["gemini", "openai", "mock"].includes(config.chatProvider));
  const disabled = busy || !config || unavailable;

  return (
    <section className="center assistant-panel" aria-label="Assistant">
      <header className="chat-header">
        <h2 className="chat-title">
          Assistant <span className="chat-provider">· {label}</span>
          {config?.chatModel
            ? <span className="chat-model">{config.chatModel}</span>
            : null}
        </h2>
      </header>

      {unavailable && (
        <p className="notice" role="status">
          Assistant unavailable.{" "}
          {config?.chatUnavailableReason ?? "no AI provider configured"}.
        </p>
      )}
      <div className="messages" ref={listRef}>
        {messages.length === 0 && !busy && (
          <div className="empty-chat">
            <p className="empty-chat-title">No messages yet</p>
            <p className="empty">
              Ask for a one-shot script or help with your code.
            </p>
          </div>
        )}

        {messages.map((m) => {
          const proposal =
            (m.metadata?.proposal as ScriptProposal | null | undefined) ?? null;
          const isUser = m.role === "user";
          const isAssistant = m.role === "assistant";
          return (
            <article
              key={m.id}
              className={`msg msg-${m.role}${
                m.metadata?.pending ? " msg-pending" : ""
              }`}
              data-role={m.role}
              data-testid={`msg-${m.role}`}
            >
              <div className="msg-bubble">
                <div className="role">
                  {isUser ? "You" : isAssistant ? "Assistant" : m.role}
                </div>
                {isAssistant
                  ? <MarkdownMessage content={m.content} />
                  : <div className="body">{m.content}</div>}
                {messageProposals(m).map((candidate, index) => (
                  <ChatCapabilityReview
                    key={`${m.id}:${index}:${candidate.source}`}
                    proposal={candidate}
                    messageId={m.id}
                    saved={savedSources.includes(`${m.id}:${candidate.source}`)}
                    saving={saving}
                    onSave={onSaveProposal}
                    index={index}
                  />
                ))}
                {proposal && (
                  <div className="proposal">
                    <h3>Proposed script: {proposal.name}</h3>
                    <p className="hint">{proposal.description}</p>
                    <p>
                      {proposal.requestedCapabilities?.length ?? 0}{" "}
                      requested capabilities.
                    </p>
                    {proposal.project
                      ? proposal.project.files.map((f) => (
                        <details key={f.path}>
                          <summary>
                            {f.path}
                            {f.path === proposal.project!.entrypoint
                              ? " · entrypoint"
                              : ""}
                          </summary>
                          <pre className="code">{f.content}</pre>
                        </details>
                      ))
                      : <pre className="code">{proposal.source}</pre>}
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {busy && (
          <div
            className="msg msg-assistant"
            aria-live="polite"
            data-testid="msg-loading"
          >
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
          placeholder="Ask about a script…"
          disabled={disabled}
          rows={3}
        />
        <div className="composer-actions">
          <span className="hint">
            Enter to send · Shift+Enter for a new line
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={disabled || !text.trim()}
            onClick={() => void submit()}
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </section>
  );
}
