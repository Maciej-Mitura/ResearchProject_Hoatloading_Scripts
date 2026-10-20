import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "./api/client";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import { Inspector } from "./components/Inspector";
import { StatusBadge } from "./components/StatusBadge";
import { HelpPanel } from "./components/HelpPanel";
import type {
  ChatMessage,
  Conversation,
  Execution,
  ExecutionEvent,
  HostStatusResponse,
  PermissionProfileId,
  PublicConfig,
  RiskAssessment,
  Script,
  ScriptProposal,
  ScriptVersion,
  SecurityEvent,
} from "./types";

export function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [scriptDetail, setScriptDetail] = useState<Script | null>(null);
  const [scriptVersion, setScriptVersion] = useState<ScriptVersion | null>(null);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [executionEvents, setExecutionEvents] = useState<ExecutionEvent[]>([]);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [host, setHost] = useState<HostStatusResponse | null>(null);
  const [latestProposal, setLatestProposal] = useState<ScriptProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiOk, setApiOk] = useState(false);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [permissionProfile, setPermissionProfile] = useState<PermissionProfileId>(
    "none",
  );

  const refreshLists = useCallback(async () => {
    const [conv, scr, exec, sec, risks, hostStatus, health, publicConfig] = await Promise.all([
      api.listConversations(),
      api.listScripts(),
      api.listExecutions(),
      api.securityEvents(selectedExecutionId ?? undefined),
      api.riskAssessments(),
      api.hostStatus(),
      api.health().then(() => true).catch(() => false),
      api.publicConfig().catch(() => null),
    ]);
    setConversations(conv);
    setScripts(scr);
    setExecutions(exec);
    setSecurityEvents(sec);
    setHost(hostStatus);
    setApiOk(health);
    if (publicConfig) setConfig(publicConfig);
    if (selectedExecutionId) {
      const match = risks.find((r) => r.executionId === selectedExecutionId);
      setRisk(match ?? risks[0] ?? null);
    } else {
      setRisk(risks[0] ?? null);
    }
  }, [selectedExecutionId]);

  useEffect(() => {
    refreshLists().catch((err) => setError(String(err)));
    const t = setInterval(() => {
      api.hostStatus().then(setHost).catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [refreshLists]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    api.listMessages(selectedConversationId)
      .then(setMessages)
      .catch((err) => setError(String(err)));
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedScriptId) {
      setScriptDetail(null);
      setScriptVersion(null);
      return;
    }
    api.getScript(selectedScriptId)
      .then((detail) => {
        setScriptDetail(detail.script);
        setScriptVersion(detail.currentVersion);
      })
      .catch((err) => setError(String(err)));
  }, [selectedScriptId]);

  useEffect(() => {
    if (!selectedExecutionId) {
      setExecution(null);
      setExecutionEvents([]);
      return;
    }
    api.getExecution(selectedExecutionId)
      .then((detail) => {
        setExecution(detail.execution);
        setExecutionEvents(detail.events);
      })
      .catch((err) => setError(String(err)));
  }, [selectedExecutionId]);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  async function onNewConversation() {
    setError(null);
    const conv = await api.createConversation();
    setConversations((prev) => [conv, ...prev]);
    setSelectedConversationId(conv.id);
    setMessages([]);
    setLatestProposal(null);
  }

  async function onSend(content: string) {
    if (busy) return;
    if (!selectedConversationId) {
      const conv = await api.createConversation();
      setConversations((prev) => [conv, ...prev]);
      setSelectedConversationId(conv.id);
      await sendTo(conv.id, content);
      return;
    }
    await sendTo(selectedConversationId, content);
  }

  async function sendTo(conversationId: string, content: string) {
    const tempId = `local-${crypto.randomUUID()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId,
      role: "user",
      content,
      metadata: { pending: true },
      createdAt: new Date().toISOString(),
    };
    // Show the user message immediately; assistant loading indicator follows via `busy`.
    setMessages((prev) => [...prev, optimistic]);
    setBusy(true);
    setError(null);
    try {
      const result = await api.sendMessage(conversationId, content, false);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        result.userMessage,
        result.assistantMessage,
      ]);
      setLatestProposal(result.proposal);
      await refreshLists();
    } catch (err) {
      if (err instanceof ApiError && err.body.userMessage) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          err.body.userMessage as ChatMessage,
        ]);
        setError(
          typeof (err.body.error as { message?: string } | undefined)?.message === "string"
            ? (err.body.error as { message: string }).message
            : "The assistant could not respond. Please try again.",
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, metadata: { ...(m.metadata ?? {}), pending: false, failed: true } }
              : m,
          ),
        );
        setError(
          err instanceof Error
            ? err.message
            : "The assistant could not respond. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSaveProposal(proposal: ScriptProposal) {
    setError(null);
    try {
      const created = await api.createScript({
        name: proposal.name,
        description: proposal.description,
        language: proposal.language,
        source: proposal.source,
        status: "draft",
      });
      setLatestProposal(null);
      await refreshLists();
      setSelectedScriptId(created.script.id);
    } catch (err) {
      setError(String(err));
    }
  }

  async function onRun() {
    if (!selectedScriptId) return;
    setRunning(true);
    setError(null);
    try {
      const exec = await api.startExecution(selectedScriptId, {
        permissionProfile,
      });
      setSelectedExecutionId(exec.id);
      setExecution(exec);
      setExecutionEvents([]);

      const es = api.executionEventSource(exec.id);
      es.addEventListener("execution", (ev) => {
        const data = JSON.parse((ev as MessageEvent).data) as Execution;
        setExecution(data);
        setExecutions((prev) => {
          const others = prev.filter((e) => e.id !== data.id);
          return [data, ...others];
        });
      });
      es.addEventListener("execution_event", (ev) => {
        const data = JSON.parse((ev as MessageEvent).data) as ExecutionEvent;
        setExecutionEvents((prev) => [...prev, data]);
      });
      es.addEventListener("done", () => {
        es.close();
        setRunning(false);
        void refreshLists();
        void api.getExecution(exec.id).then((detail) => {
          setExecution(detail.execution);
          setExecutionEvents(detail.events);
        });
      });
      es.onerror = () => {
        es.close();
        setRunning(false);
        void refreshLists();
      };
    } catch (err) {
      setError(String(err));
      setRunning(false);
    }
  }

  async function onBroadcast() {
    setError(null);
    try {
      await api.enqueueHostCommand("broadcast_message", {
        message: "Hello from the research workbench (allowlisted command).",
      });
      await refreshLists();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          Research Workbench
          <span>defense-in-depth PoC foundation</span>
        </div>
        <div className="header-meta">
          <button
            type="button"
            className="btn btn-help"
            onClick={() => setHelpOpen(true)}
            title="How to use this application"
          >
            How to use
          </button>
          <StatusBadge connected={apiOk} label={apiOk ? "API online" : "API offline"} />
          <StatusBadge
            connected={!!host?.connected}
            label={host?.connected ? "Paper bridge" : "Host disconnected"}
          />
        </div>
      </header>

      <Sidebar
        conversations={conversations}
        scripts={scripts}
        executions={executions}
        selectedConversationId={selectedConversationId}
        selectedScriptId={selectedScriptId}
        selectedExecutionId={selectedExecutionId}
        onSelectConversation={(id) => {
          setSelectedConversationId(id);
          setLatestProposal(null);
        }}
        onSelectScript={setSelectedScriptId}
        onSelectExecution={setSelectedExecutionId}
        onNewConversation={() => void onNewConversation()}
      />

      <ChatPanel
        messages={messages}
        busy={busy}
        config={config}
        onSend={onSend}
        latestProposal={latestProposal}
        onSaveProposal={(p) => onSaveProposal(p)}
      />

      <Inspector
        script={scriptDetail}
        version={scriptVersion}
        execution={execution}
        executionEvents={executionEvents}
        risk={risk}
        securityEvents={securityEvents}
        host={host}
        executionProvider={config?.executionProvider}
        permissionProfiles={config?.permissionProfiles}
        permissionProfile={permissionProfile}
        onPermissionProfileChange={setPermissionProfile}
        onRun={() => void onRun()}
        onBroadcast={() => void onBroadcast()}
        running={running}
      />

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />

      {error && (
        <div
          className="error-banner"
          style={{
            position: "fixed",
            bottom: 12,
            left: 12,
            right: 12,
            maxWidth: 480,
            zIndex: 20,
          }}
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
