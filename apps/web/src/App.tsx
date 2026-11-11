import { LimitsPanel } from "./components/LimitsPanel";
import { runGuidance, workflowError } from "./permission-workflow";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useExecutionMonitor } from "./useExecutionMonitor";
import { isTerminal, preferNewerExecution } from "./execution-ux";
import {
  ExecutionActivity,
  ExecutionJourney,
} from "./components/ExecutionFeedback";
import { newestFirst } from "./workbench";
import { api, ApiError } from "./api/client";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import { ScriptEditor } from "./components/ScriptEditor";
import { ExecutionDetail } from "./components/ExecutionDetail";
import { WorkbenchExecution } from "./components/WorkbenchExecution";
import { ProjectSettingsPanel } from "./components/ProjectSettingsPanel";
import { ServerInfoPanel } from "./components/ServerInfoPanel";
const ExecutionInsights = lazy(() =>
  import("./components/ExecutionInsights").then((m) => ({
    default: m.ExecutionInsights,
  }))
);
type Page = "workbench" | "insights" | "host" | "settings";
const pageFromHash = (): Page =>
  (["workbench", "insights", "host", "settings"].includes(
      location.hash.slice(1),
    )
    ? location.hash.slice(1)
    : "workbench") as Page;
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
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [page]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [scriptVersions, setScriptVersions] = useState<ScriptVersion[]>([]);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("workbench-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("workbench-theme", theme);
    } catch {
      /* optional preference storage */
    }
  }, [theme]);
  useEffect(() => {
    const changed = () => {
      if (
        ["workbench", "insights", "host", "settings"].includes(
          location.hash.slice(1),
        )
      ) {
        setPage(pageFromHash());
      }
    };
    addEventListener("hashchange", changed);
    return () => removeEventListener("hashchange", changed);
  }, []);
  const [insightTarget, setInsightTarget] = useState<string | null>(null);
  function navigate(next: Page, executionId?: string) {
    setInsightTarget(next === "insights" ? (executionId ?? null) : null);
    setPage(next);
    location.hash = next;
  }
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(
    null,
  );
  const [scriptDetail, setScriptDetail] = useState<Script | null>(null);
  const [scriptVersion, setScriptVersion] = useState<ScriptVersion | null>(
    null,
  );
  const [execution, setExecution] = useState<Execution | null>(null);
  const [executionEvents, setExecutionEvents] = useState<ExecutionEvent[]>([]);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [host, setHost] = useState<HostStatusResponse | null>(null);
  const [latestProposal, setLatestProposal] = useState<ScriptProposal | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [runContext, setRunContext] = useState<
    {
      scriptId: string;
      profile: string;
      submittedAt: number;
      executionId?: string;
    } | null
  >(null);

  const [error, setError] = useState<string | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [permissionProfile, setPermissionProfile] = useState<
    PermissionProfileId
  >("none");

  const [saving, setSaving] = useState(false);
  const [savedSources, setSavedSources] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const selection = useRef({
    conversationId: selectedConversationId,
    scriptId: selectedScriptId,
    executionId: selectedExecutionId,
  });
  selection.current = {
    conversationId: selectedConversationId,
    scriptId: selectedScriptId,
    executionId: selectedExecutionId,
  };
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<
    {
      versionId: string;
      path: string;
      line: number;
      column: number;
      serial: number;
    } | null
  >(null);
  useEffect(() => {
    const jump = (event: Event) => {
      const target = (event as CustomEvent).detail;
      if (target?.versionId === scriptVersion?.id) {
        setEditorTarget({ ...target, serial: Date.now() });
        navigate("workbench");
      } else {setError(
          "Select this execution’s exact saved script version in Workbench before opening its error location.",
        );}
    };
    window.addEventListener("project-error-location", jump);
    return () => window.removeEventListener("project-error-location", jump);
  }, [scriptVersion?.id]);
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
    selection.current.conversationId = conversationId === undefined
      ? (script?.conversationId ?? null)
      : conversationId;
    setSelectedScriptId(id);
    if (scriptChanged) {
      setScriptDetail(null);
      setScriptVersion(null);
      setPermissionProfile("none");
    }
    setSelectedConversationId(
      conversationId === undefined
        ? (script?.conversationId ?? null)
        : conversationId,
    );
    selectExecution(
      newestFirst(executions.filter((item) => item.scriptId === id))[0]?.id ??
        null,
    );
  }

  function selectConversation(id: string) {
    setAssistantOpen(true);
    const script = newestFirst(
      scripts.filter((item) => item.conversationId === id),
    )[0];
    if (selection.current.conversationId !== id) setMessages([]);
    setLatestProposal(null);
    selectScript(script?.id ?? null, id);
  }

  const refreshLists = useCallback(async () => {
    const [conv, scr, exec, hostStatus, health, publicConfig] = await Promise
      .all([
        api.listConversations(),
        api.listScripts(),
        api.listExecutions(),
        api.hostStatus(),
        api
          .health()
          .then(() => true)
          .catch(() => false),
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
      api
        .hostStatus()
        .then(setHost)
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [refreshLists]);

  useEffect(() => {
    let active = true;
    setMessages([]);
    setLatestProposal(null);
    if (selectedConversationId) {
      api
        .listMessages(selectedConversationId)
        .then((items) => {
          if (active) setMessages(items);
        })
        .catch((err) => {
          if (active) setError(String(err));
        });
    }
    return () => {
      active = false;
    };
  }, [selectedConversationId]);

  useEffect(() => {
    let active = true;
    setScriptDetail(null);
    setScriptVersion(null);
    if (selectedScriptId) {
      api
        .getScript(selectedScriptId)
        .then((detail) => {
          if (!active) return;
          setScriptDetail(detail.script);
          setScriptVersion(detail.currentVersion);
          setScriptVersions(
            detail.versions?.length
              ? detail.versions
              : detail.currentVersion
              ? [detail.currentVersion]
              : [],
          );
        })
        .catch((err) => {
          if (active) setError(String(err));
        });
    }
    return () => {
      active = false;
    };
  }, [selectedScriptId]);

  const monitored = useExecutionMonitor(selectedExecutionId, revision);
  const backgroundRun = useExecutionMonitor(
    running &&
      runContext?.executionId &&
      runContext.executionId !== selectedExecutionId
      ? runContext.executionId
      : null,
    revision,
  );
  useEffect(() => {
    const d = monitored.data;
    if (!d || selection.current.executionId !== d.execution.id) return;
    setExecution((p) => preferNewerExecution(p, d.execution));
    setExecutionEvents(d.events);
    setRisk(d.risk);
    setSecurityEvents(d.securityEvents);
    if (runContext?.executionId === d.execution.id && isTerminal(d.execution)) {
      setRunning(false);
    }
  }, [monitored.data, runContext?.executionId]);
  useEffect(() => {
    if (backgroundRun.data && isTerminal(backgroundRun.data.execution)) {
      setRunning(false);
    }
  }, [backgroundRun.data]);

  useEffect(() => {
    let active = true;
    setSavedSources([]);
    const linked = scripts.filter(
      (script) =>
        script.conversationId === selectedConversationId &&
        script.sourceMessageId,
    );
    Promise.all(
      linked.map(async (script) => {
        const detail = await api.getScript(script.id);
        return `${script.sourceMessageId}:${
          detail.currentVersion?.source ?? ""
        }`;
      }),
    )
      .then((keys) => {
        if (active) setSavedSources(keys);
      })
      .catch((err) => {
        if (active) setError(String(err));
      });
    return () => {
      active = false;
    };
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
    setAssistantOpen(true);
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
          typeof (err.body.error as { message?: string } | undefined)
              ?.message === "string"
            ? (err.body.error as { message: string }).message
            : "The assistant could not respond. Please try again.",
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                ...m,
                metadata: {
                  ...(m.metadata ?? {}),
                  pending: false,
                  failed: true,
                },
              }
              : m
          )
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
        project: proposal.project,
        requestedCapabilities: proposal.requestedCapabilities,
        status: "draft",
      });
      setLatestProposal(null);
      await refreshLists();
      if (selection.current.conversationId === conversationId) {
        setSelectedScriptId(created.script.id);
        selectExecution(null);
        setPermissionProfile("none");
      }
      return { scriptId: created.script.id, versionId: created.version.id };
    } catch (err) {
      setError(String(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function onRun(
    requestedProfile: PermissionProfileId = permissionProfile,
  ) {
    if (!selectedScriptId || !scriptVersion) return;
    const scriptId = selectedScriptId, versionId = scriptVersion.id;
    setError(null);
    const guide = (notice: NonNullable<ReturnType<typeof runGuidance>>) =>
      window.dispatchEvent(
        new CustomEvent("capability-workflow", {
          detail: { ...notice, versionId },
        }),
      );
    try {
      const { manifest } = await api.getManifest(scriptId, versionId);
      if (selection.current.scriptId !== scriptId) return;
      const notice = runGuidance(manifest, requestedProfile);
      if (notice) {
        guide(notice);
        return;
      }
    } catch (err) {
      const notice = workflowError(err);
      if (notice) guide(notice);
      else {setError(
          "Permission details could not be checked. Retry before running.",
        );}
      return;
    }
    setRunning(true);
    setRunContext({
      scriptId,
      profile: requestedProfile,
      submittedAt: Date.now(),
    });
    selectExecution(null);
    setError(null);
    try {
      const exec = await api.startExecution(selectedScriptId, {
        permissionProfile: requestedProfile,
        scriptVersionId: versionId,
      });
      setRunContext((p) =>
        p?.scriptId === scriptId ? { ...p, executionId: exec.id } : p
      );
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
        if (selection.current.executionId === exec.id) {
          setExecution((p) => preferNewerExecution(p, data));
        }
        setExecutions((prev) => {
          const others = prev.filter((e) => e.id !== data.id);
          return newestFirst([data, ...others]);
        });
      });
      es.addEventListener("execution_event", (ev) => {
        const data = JSON.parse((ev as MessageEvent).data) as ExecutionEvent;
        if (selection.current.executionId === exec.id) {
          setExecutionEvents((prev) => [...prev, data]);
        }
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
        es.close(); // Serial polling remains active; transport loss is not process completion.
      };
    } catch (err) {
      const notice = workflowError(err);
      if (notice) guide(notice);
      else {setError(
          err instanceof Error
            ? err.message.replace(/^Error:\s*/, "")
            : "The execution could not be started. Retry or check the service status.",
        );}
      setRunning(false);
      setRunContext(null);
    }
  }

  const selectedDetail = runContext && !runContext.executionId && running
    ? (
      <section className="execution-detail">
        <ExecutionActivity
          execution={null}
          requestedProfile={runContext.profile}
          submittedAt={runContext.submittedAt}
        />
        <ExecutionJourney execution={null} risk={null} />
      </section>
    )
    : selectedExecutionId && !execution
    ? (
      <div
        className={monitored.error ? "notice warn" : "loading-skeleton"}
        role="status"
      >
        {monitored.error
          ? "Execution updates are unavailable. Retrying automatically; this does not indicate script failure."
          : "Loading selected execution…"}
      </div>
    )
    : (
      <ExecutionDetail
        key={execution?.id ?? "empty"}
        execution={execution}
        events={executionEvents}
        risk={risk}
        securityEvents={securityEvents}
        requestedProfile={runContext?.executionId === execution?.id
          ? runContext?.profile
          : undefined}
        submittedAt={runContext?.executionId === execution?.id
          ? runContext?.submittedAt
          : undefined}
        updateError={monitored.error}
        updatedAt={monitored.data?.execution.id === execution?.id
          ? monitored.data?.updatedAt
          : undefined}
      />
    );
  async function savedVersion(version: ScriptVersion) {
    const scriptId = version.scriptId;
    if (selection.current.scriptId !== scriptId) return;
    const detail = await api.getScript(scriptId);
    if (selection.current.scriptId !== scriptId) return;
    setScriptDetail(detail.script);
    setScriptVersions(detail.versions);
    setScriptVersion(
      detail.versions.find((v) => v.id === version.id) ?? detail.currentVersion,
    );
    await refreshLists();
  }
  return (
    <div className="app-shell">
      {limitsOpen && <LimitsPanel onClose={() => setLimitsOpen(false)} />}
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="#workbench"
          onClick={() => setPage("workbench")}
        >
          <img
            className="brand-logo"
            src="/runlattice-mark.svg"
            alt=""
            width="36"
            height="36"
          />
          <span>
            <strong>Runlattice</strong>
            <small>Restricted execution workbench</small>
          </span>
        </a>
        <div className="header-meta">
          <StatusBadge
            connected={apiOk === true}
            label={apiOk === null
              ? "Checking API"
              : apiOk
              ? "API online"
              : "API offline"}
          />
          <StatusBadge
            connected={!!host?.connected}
            label={!host
              ? "Checking host"
              : host.connected
              ? "Paper connected"
              : "Host disconnected"}
          />
          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? "◐" : "◑"}
          </button>
          <button
            type="button"
            className="btn btn-help"
            onClick={() => setHelpOpen(true)}
          >
            How to use
          </button>
        </div>
      </header>
      <div className="navigation-rail">
        <nav className="primary-navigation" aria-label="Main navigation">
          {(
            [
              ["workbench", "⌘", "Workbench"],
              ["insights", "▥", "Execution Insights"],
              ["host", "↗", "Host Activity"],
              ["settings", "⚙", "Settings"],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              className={page === id ? "nav-link active" : "nav-link"}
              aria-current={page === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        {page === "workbench" && (
          <Sidebar
            conversations={conversations}
            scripts={scripts}
            executions={executions.filter(
              (e) => e.scriptId === selectedScriptId,
            )}
            selectedConversationId={selectedConversationId}
            selectedScriptId={selectedScriptId}
            selectedExecutionId={selectedExecutionId}
            onSelectConversation={selectConversation}
            onSelectScript={(id) => {
              setInsightTarget(null);
              selectScript(id);
            }}
            onSelectExecution={selectExecution}
            onNewConversation={() => void onNewConversation()}
          />
        )}
        <div className="rail-footer">

          <p>
            Runtime authority comes from the selected profile, not assistant
            preferences.
          </p>
        </div>
      </div>
      <main className="workspace-main" id="main-content" tabIndex={-1}>
        {page === "workbench" && (
          <>
            <div className="workspace-toolbar">
              <div>
                <h1 className="workbench-title">Workbench</h1>
              </div>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    selectScript(null, null);
                    setScriptVersions([]);
                  }}
                >
                  ＋ New script
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-expanded={assistantOpen}
                  onClick={() => setAssistantOpen((v) => !v)}
                >
                  {assistantOpen ? "Hide assistant" : "Open assistant"}
                </button>
              </div>
            </div>
            <button
              className="btn limits-launch"
              onClick={() => setLimitsOpen(true)}
            >
              What are the limits?
            </button>
            <div
              className={`workbench-grid${
                assistantOpen ? " with-assistant" : ""
              }`}
            >
              <div className="editor-column">
                {selectedScriptId && !scriptDetail
                  ? (
                    <div role="status" className="loading-skeleton">
                      Loading script…
                    </div>
                  )
                  : (
                    <ScriptEditor
                      script={scriptDetail}
                      version={scriptVersion}
                      versions={scriptVersions}
                      profile={permissionProfile}
                      options={config?.permissionProfiles}
                      provider={config?.executionProvider}
                      running={running}
                      execution={execution}
                      errorTarget={editorTarget}
                      onProfile={setPermissionProfile}
                      onRun={(profile) => onRun(profile)}
                      onSaved={(v) =>
                        void savedVersion(v).catch((e) => setError(String(e)))}
                      onVersion={setScriptVersion}
                      onCreated={(script, version) => {
                        setScripts((p) => newestFirst([script, ...p]));
                        selectScript(script.id, null);
                        setScriptDetail(script);
                        setScriptVersion(version);
                        setScriptVersions([version]);
                        void refreshLists();
                      }}
                    />
                  )}
              </div>
              {assistantOpen && (
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
              )}
            </div>
            <WorkbenchExecution
              execution={execution}
              events={securityEvents}
              submitting={!!runContext && !runContext.executionId && running}
              loading={!!selectedExecutionId && !execution}
              requestedProfile={runContext?.executionId === execution?.id ||
                  !runContext?.executionId
                ? runContext?.profile
                : undefined}
              submittedAt={runContext?.executionId === execution?.id ||
                  !runContext?.executionId
                ? runContext?.submittedAt
                : undefined}
              updateError={monitored.error}
              onRefresh={() => void refreshLists()}
              onView={() => navigate("insights", execution?.id)}
            />
          </>
        )}
        {page === "insights" && (
          <Suspense
            fallback={
              <div className="loading-skeleton" role="status">
                Loading Insights…
              </div>
            }
          >
            <ExecutionInsights
              scripts={scripts}
              scriptId={selectedScriptId}
              selectedExecutionId={selectedExecutionId}
              initialExecutionId={insightTarget}
              revision={revision}
              onSelectScript={(id) => {
                setInsightTarget(null);
                selectScript(id);
              }}
              onSelectExecution={selectExecution}
              detail={selectedDetail}
            />
          </Suspense>
        )}
        {page === "host" && (
          <div className="standalone-page">
            <header className="page-heading">
              <div>

                <h1>Host Activity</h1>
                <p>
                  Observed host state and confirmed effects. Scripts use the
                  narrow Host Gateway capability path.
                </p>
              </div>
            </header>
            <ServerInfoPanel host={host} />
          </div>
        )}
        {page === "settings" && (
          <div className="standalone-page">
            <header className="page-heading">
              <div>

                <h1>Settings</h1>
                <p>
                  Guide assistant proposals. These preferences do not change
                  runtime permissions.
                </p>
              </div>
            </header>
            <ProjectSettingsPanel />
          </div>
        )}
      </main>
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
      {error && (
        <div className="error-banner global-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-small"
            aria-label="Dismiss error"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
