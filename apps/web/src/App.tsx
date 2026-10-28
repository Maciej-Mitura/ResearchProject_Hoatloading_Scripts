import { useCallback, useEffect, useRef, useState } from "react";
import { newestFirst } from "./workbench";
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

  const [saving, setSaving] = useState(false);
  const [savedSources, setSavedSources] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const selection = useRef({ conversationId: selectedConversationId, scriptId: selectedScriptId, executionId: selectedExecutionId });
  selection.current = { conversationId: selectedConversationId, scriptId: selectedScriptId, executionId: selectedExecutionId };
  const stream = useRef<EventSource | null>(null);
  useEffect(() => () => stream.current?.close(), []);

  function selectExecution(id: string | null) {
    if (selection.current.executionId === id) return;
    selection.current.executionId = id;
    setSelectedExecutionId(id);
    setExecution(null);
    setExecutionEvents([]);
    setRisk(null);
    setSecurityEvents([]);
  }

  function selectScript(id: string | null, conversationId?: string | null) {
    const script = scripts.find((item) => item.id === id);
    const scriptChanged = selection.current.scriptId !== id;
    selection.current.scriptId = id;
    selection.current.conversationId = conversationId === undefined ? script?.conversationId ?? null : conversationId;
    setSelectedScriptId(id);
    if (scriptChanged) {
      setScriptDetail(null);
      setScriptVersion(null);
      setPermissionProfile("none");
    }
    setSelectedConversationId(conversationId === undefined ? script?.conversationId ?? null : conversationId);
    selectExecution(newestFirst(executions.filter((item) => item.scriptId === id))[0]?.id ?? null);
  }

  function selectConversation(id: string) {
    const script = newestFirst(scripts.filter((item) => item.conversationId === id))[0];
    if (selection.current.conversationId !== id) setMessages([]);
    setLatestProposal(null);
    selectScript(script?.id ?? null, id);
  }

  const refreshLists = useCallback(async () => {
    const [conv, scr, exec, hostStatus, health, publicConfig] = await Promise.all([
      api.listConversations(), api.listScripts(), api.listExecutions(),
      api.hostStatus(), api.health().then(() => true).catch(() => false),
      api.publicConfig().catch(() => null),
    ]);
    setConversations(conv);
    setScripts(newestFirst(scr));
    setExecutions(newestFirst(exec));
    setHost(hostStatus);
    setApiOk(health);
    if (publicConfig) setConfig(publicConfig);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    refreshLists().catch((err) => setError(String(err)));
    const t = setInterval(() => {
      api.hostStatus().then(setHost).catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [refreshLists]);

  useEffect(() => {
    let active = true;
    setMessages([]);
    setLatestProposal(null);
    if (selectedConversationId) {
      api.listMessages(selectedConversationId).then((items) => {
        if (active) setMessages(items);
      }).catch((err) => { if (active) setError(String(err)); });
    }
    return () => { active = false; };
  }, [selectedConversationId]);

  useEffect(() => {
    let active = true;
    setScriptDetail(null);
    setScriptVersion(null);
    if (selectedScriptId) {
      api.getScript(selectedScriptId).then((detail) => {
        if (!active) return;
        setScriptDetail(detail.script);
        setScriptVersion(detail.currentVersion);
      }).catch((err) => { if (active) setError(String(err)); });
    }
    return () => { active = false; };
  }, [selectedScriptId]);

  useEffect(() => {
    let active = true;
    if (!selectedExecutionId) return;
    Promise.all([
      api.getExecution(selectedExecutionId),
      api.securityEvents(selectedExecutionId),
      api.riskAssessments(),
    ]).then(([detail, events, assessments]) => {
      if (!active) return;
      setExecution(detail.execution);
      setExecutionEvents(detail.events);
      setSecurityEvents(events.filter((event) => event.executionId === selectedExecutionId));
      setRisk(assessments.find((item) => item.executionId === selectedExecutionId) ?? null);
      const profile = detail.execution.result?.manifest?.permissionProfile;
      if (profile && ["none", "read-fixture", "env-demo", "host-chat"].includes(profile)) {
        setPermissionProfile(profile as PermissionProfileId);
      }
    }).catch((err) => { if (active) setError(String(err)); });
    return () => { active = false; };
  }, [selectedExecutionId, revision]);

  useEffect(() => {
    let active = true;
    setSavedSources([]);
    const linked = scripts.filter((script) => script.conversationId === selectedConversationId && script.sourceMessageId);
    Promise.all(linked.map(async (script) => {
      const detail = await api.getScript(script.id);
      return `${script.sourceMessageId}:${detail.currentVersion?.source ?? ""}`;
    })).then((keys) => { if (active) setSavedSources(keys); })
      .catch((err) => { if (active) setError(String(err)); });
    return () => { active = false; };
  }, [scripts, selectedConversationId]);

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
    selectScript(null, conv.id);
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
      if (selection.current.conversationId !== conversationId) return;
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        result.userMessage,
        result.assistantMessage,
      ]);
      setLatestProposal(result.proposal);
      await refreshLists();
    } catch (err) {
      if (selection.current.conversationId !== conversationId) return;
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

  async function onSaveProposal(proposal: ScriptProposal, messageId?: string) {
    if (saving || !selectedConversationId) return;
    const conversationId = selectedConversationId;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createScript({
        conversationId,
        sourceMessageId: messageId,
        name: proposal.name,
        description: proposal.description,
        language: proposal.language,
        source: proposal.source,
        status: "draft",
      });
      setLatestProposal(null);
      await refreshLists();
      if (selection.current.conversationId === conversationId) {
        setSelectedScriptId(created.script.id);
        selectExecution(null);
        setPermissionProfile("none");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onRun() {
    if (!selectedScriptId) return;
    const scriptId = selectedScriptId;
    setRunning(true);
    setError(null);
    try {
      const exec = await api.startExecution(selectedScriptId, {
        permissionProfile,
      });
      if (selection.current.scriptId === scriptId) {
        selectExecution(exec.id);
        setExecution(exec);
        setExecutionEvents([]);
      }

      stream.current?.close();
      const es = api.executionEventSource(exec.id);
      stream.current = es;
      es.addEventListener("execution", (ev) => {
        const data = JSON.parse((ev as MessageEvent).data) as Execution;
        if (selection.current.executionId === exec.id) setExecution(data);
        setExecutions((prev) => {
          const others = prev.filter((e) => e.id !== data.id);
          return newestFirst([data, ...others]);
        });
      });
      es.addEventListener("execution_event", (ev) => {
        const data = JSON.parse((ev as MessageEvent).data) as ExecutionEvent;
        if (selection.current.executionId === exec.id) setExecutionEvents((prev) => [...prev, data]);
      });
      es.addEventListener("done", () => {
        es.close();
        setRunning(false);
        void refreshLists();
        void api.getExecution(exec.id).then((detail) => {
          if (selection.current.executionId !== exec.id) return;
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
        onSelectConversation={selectConversation}
        onSelectScript={(id) => selectScript(id)}
        onSelectExecution={(id) => {
          const item = executions.find((entry) => entry.id === id);
          if (item) {
            selectScript(item.scriptId);
            selectExecution(id);
          }
        }}
        onNewConversation={() => void onNewConversation()}
      />

      <ChatPanel
        messages={messages}
        busy={busy}
        config={config}
        onSend={onSend}
        latestProposal={latestProposal}
        onSaveProposal={onSaveProposal}
        saving={saving}
        savedSources={savedSources}
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
