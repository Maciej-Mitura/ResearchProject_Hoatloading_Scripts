import {
  bindingSource,
  parseProject,
  projectPath,
  projectText,
  type ScriptProject,
  singleProject,
} from "../../../../packages/contracts/src/script-project";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Execution,
  PermissionProfileId,
  PermissionProfileOption,
  Script,
  ScriptVersion,
} from "../types";
import { api } from "../api/client";
import { InfoTip } from "./InfoTip";
import { Badge } from "./StatusBadge";
import { CodeEditor } from "./CodeEditor";
import { detectedCapabilities } from "../../../../packages/contracts/src/capabilities";
import {
  PER_SCRIPT_DESCRIPTION,
  type PermissionLoad,
  PROFILE_LABELS,
  type RunGuidance,
  runGuidance,
} from "../permission-workflow";
import { CapabilityPermissions } from "./CapabilityPermissions";
import { importsHost } from "../execution-errors";

const drafts = new Map<
  string,
  {
    source: string;
    name: string;
    language: string;
    project?: ScriptProject | null;
  }
>();
const profiles: PermissionProfileOption[] = [
  {
    id: "host-capabilities",
    label: "Per-script permissions",
    description: PER_SCRIPT_DESCRIPTION,
  },
  {
    id: "none",
    label: "No permissions",
    description: "No explicit Deno grants; no job network.",
  },
  {
    id: "read-fixture",
    label: "Read test fixture",
    description: "Read /fixtures only; no general filesystem grant.",
  },
  {
    id: "env-demo",
    label: "Demo environment",
    description: "Read SANDBOX_DEMO_VALUE only.",
  },
  {
    id: "host-chat",
    label: "Host chat",
    description:
      "Gateway SDK/transport plus scoped chat.broadcast authorization.",
  },
];
const profileScopes: Record<PermissionProfileId, string> = {
  "host-capabilities": PER_SCRIPT_DESCRIPTION,
  none:
    "No filesystem, environment, network, subprocess, FFI or host capability grants.",
  "read-fixture": "Read access to predefined /fixtures data only.",
  "env-demo":
    "Access to the predefined SANDBOX_DEMO_VALUE environment variable only.",
  "host-chat":
    "Historical versions only: restricted SDK/Gateway for chat.broadcast. New saved versions use reviewed Per-script permissions.",
};
export function ScriptEditor({
  script,
  version,
  versions,
  profile,
  options,
  provider,
  running,
  execution,
  onProfile,
  onRun,
  onSaved,
  onCreated,
  onVersion,
  errorTarget,
}: {
  script: Script | null;
  version: ScriptVersion | null;
  versions: ScriptVersion[];
  profile: PermissionProfileId;
  options?: PermissionProfileOption[];
  provider?: string;
  running: boolean;
  execution: Execution | null;
  onProfile: (x: PermissionProfileId) => void;
  onRun: (profile?: PermissionProfileId) => void | Promise<void>;
  onSaved: (x: ScriptVersion) => void;
  onCreated: (script: Script, version: ScriptVersion) => void;
  onVersion: (x: ScriptVersion) => void;
  errorTarget?: {
    versionId: string;
    path: string;
    line: number;
    column: number;
    serial: number;
  } | null;
}) {
  const [source, setSource] = useState(
      version?.source ?? 'console.log("Hello from the restricted sandbox");\n',
    ),
    [name, setName] = useState(script?.name ?? "Untitled script"),
    [language, setLanguage] = useState(version?.language ?? "typescript"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState("");
  const [project, setProject] = useState<ScriptProject | null>(
    version?.project ?? null,
  );
  const [activeFile, setActiveFile] = useState(
    version?.project?.entrypoint ?? "",
  );
  const [filePath, setFilePath] = useState("");
  const draftKey = `${script?.id ?? "new"}/${version?.id ?? "new"}`;
  const currentDraft = useRef({ source, name, language, project });
  currentDraft.current = { source, name, language, project };
  useEffect(() => {
    const cached = drafts.get(draftKey);
    setSource(
      cached?.source ??
        version?.source ??
        'console.log("Hello from the restricted sandbox");\n',
    );
    setName(cached?.name ?? script?.name ?? "Untitled script");
    setLanguage(cached?.language ?? version?.language ?? "typescript");
    setProject(cached?.project ?? version?.project ?? null);
    setActiveFile((cached?.project ?? version?.project)?.entrypoint ?? "");
    setError(null);
    setMessage("");
    return () => {
      drafts.set(draftKey, currentDraft.current);
    };
  }, [draftKey]);
  const sourceDirty = !!script &&
    (bindingSource(source, project) !==
        bindingSource(version?.source ?? "", version?.project) ||
      language !== version?.language);
  const dirty = sourceDirty || (!!script && name.trim() !== script.name);
  const [permissionRecord, setPermissionRecord] = useState<
    (PermissionLoad & { versionId: string }) | null
  >(null);
  const permissions = permissionRecord?.versionId === version?.id
    ? permissionRecord
    : null;
  const manualChoice = useRef<
    { versionId: string; reviewId: string | null } | null
  >(null);
  const currentProfile = useRef(profile);
  currentProfile.current = profile;
  const [guidance, setGuidance] = useState<
    (RunGuidance & { versionId: string }) | null
  >(null);
  const [reviewRequest, setReviewRequest] = useState<
    { versionId: string; serial: number } | null
  >(null);
  const completeSource = project ? projectText(project) : source;
  const knownCalls = detectedCapabilities(completeSource);
  const shownFile = project?.files.find((f) => f.path === activeFile) ?? null;
  const shownSource = shownFile?.content ?? source;
  function changeSource(value: string) {
    if (project && shownFile) {
      setProject({
        ...project,
        files: project.files.map((f) =>
          f.path === activeFile ? { ...f, content: value } : f
        ),
      });
      if (activeFile === project.entrypoint) setSource(value);
    } else setSource(value);
  }
  function manageFile(action: "add" | "rename" | "delete") {
    try {
      const next = project ?? singleProject(source, language);
      if (action === "add") {
        const path = projectPath(filePath);
        if (next.files.some((f) => f.path === path)) {
          throw new Error("File already exists");
        }
        setProject(
          parseProject({
            ...next,
            files: [...next.files, { path, content: "" }],
          }),
        );
        setActiveFile(path);
      }
      if (action === "rename") {
        const path = projectPath(filePath),
          from = shownFile?.path ?? next.entrypoint;
        const updated = parseProject({
          ...next,
          entrypoint: next.entrypoint === from ? path : next.entrypoint,
          files: next.files.map((f) => f.path === from ? { ...f, path } : f),
        });
        setProject(updated);
        setActiveFile(path);
      }
      if (action === "delete") {
        if (activeFile === next.entrypoint || next.files.length === 1) {
          throw new Error(
            "The entrypoint cannot be deleted; choose another entrypoint first",
          );
        }
        setProject(
          parseProject({
            ...next,
            files: next.files.filter((f) => f.path !== activeFile),
          }),
        );
        setActiveFile(next.entrypoint);
      }
      setFilePath("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => {
    if (
      errorTarget && errorTarget.versionId === version?.id && !sourceDirty &&
      project?.files.some((f) => f.path === errorTarget.path)
    ) setActiveFile(errorTarget.path);
  }, [errorTarget, version?.id]);
  const [preparing, setPreparing] = useState(false);
  const openReview = () => {
    if (version) {
      setReviewRequest((previous) => ({
        versionId: version.id,
        serial: (previous?.serial ?? 0) + 1,
      }));
    }
  };
  const permissionsChanged = useCallback((state: PermissionLoad) => {
    if (!version) return;
    setPermissionRecord({ ...state, versionId: version.id });
    const m = state.manifest;
    if (m?.review && m.requested.length) {
      const choice = manualChoice.current;
      const manualForThisVersion = choice?.versionId === version.id;
      const explicitReview = state.reason === "reviewed" ||
        state.reason === "external-review";
      const respectManual = manualForThisVersion &&
        (!explicitReview || choice.reviewId === m.review.id);
      if (
        !respectManual &&
        bindingSource(
            currentDraft.current.source,
            currentDraft.current.project,
          ) === bindingSource(version.source, version.project) &&
        currentProfile.current !== "host-capabilities"
      ) onProfile("host-capabilities");
    }
    if (state.reason === "reviewed" || state.reason === "external-review") {
      setGuidance(null);
    }
  }, [version?.id, version?.source, onProfile]);
  function chooseProfile(next: PermissionProfileId) {
    if (version) {
      manualChoice.current = {
        versionId: version.id,
        reviewId: permissions?.manifest?.review?.id ?? null,
      };
    }
    setGuidance(null);
    onProfile(next);
  }
  useEffect(() => {
    const requested = (event: Event) => {
      const detail =
        (event as CustomEvent<RunGuidance & { versionId: string }>).detail;
      if (detail?.versionId !== version?.id) return;
      setGuidance(detail);
      if (detail.action === "review") {
        setReviewRequest((previous) => ({
          versionId: detail.versionId,
          serial: (previous?.serial ?? 0) + 1,
        }));
      }
    };
    window.addEventListener("capability-workflow", requested);
    return () => window.removeEventListener("capability-workflow", requested);
  }, [version?.id]);
  async function run() {
    if (
      !version || !permissions?.loaded || dirty || running || busy || preparing
    ) return;
    const next = runGuidance(permissions.manifest, profile);
    if (next) {
      setGuidance({ ...next, versionId: version.id });
      if (next.action === "review") openReview();
      return;
    }
    setGuidance(null);
    setPreparing(true);
    try {
      await onRun(profile);
    } finally {
      setPreparing(false);
    }
  }
  const runHelp = !script || !version
    ? "Create or select a saved script before running."
    : dirty
    ? "Save this version before running."
    : running
    ? "Wait for the current execution to finish."
    : preparing
    ? "Checking this version’s permissions…"
    : busy
    ? "Saving this version…"
    : script.status === "disabled"
    ? "Enable this script before running."
    : !permissions?.loaded
    ? permissions?.error
      ? "Permission details are unavailable. Retry permissions before running."
      : "Loading this version’s permission details…"
    : permissions.manifest?.requested.length && !permissions.manifest.review
    ? "Review requested host permissions before running."
    : permissions.manifest?.review?.denied.length
    ? "Denied calls remain blocked. Run intentionally to observe the result, or revise the source."
    : "";
  async function save() {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      if (!script) {
        const x = await api.createScript({
          name: name.trim(),
          source,
          project: project ?? undefined,
          language,
          status: "draft",
        });
        onCreated(x.script, x.version);
        drafts.delete(draftKey);
        setMessage("Script created.");
      } else {
        if (name.trim() !== script.name) {
          await api.patchScript(script.id, { name: name.trim() });
        }
        if (sourceDirty) {
          const x = await (project
            ? api.saveScriptVersion(script.id, source, language, project)
            : api.saveScriptVersion(script.id, source, language));
          onSaved(x);
          setMessage("New stored version saved.");
        } else {
          if (version) onSaved(version);
          setMessage("Script details saved.");
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const all = (options?.length ? options : profiles).map((p) => ({
    ...p,
    label: PROFILE_LABELS[p.id],
    description: p.id === "host-capabilities"
      ? PER_SCRIPT_DESCRIPTION
      : p.description,
  }));
  return (
    <section className="editor-workspace" aria-label="Script editor workspace">
      <div className="editor-title">
        <div className="script-identity">

          <label className="sr-only" htmlFor="script-name">
            Script name
          </label>
          <input
            id="script-name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)}
            disabled={running || preparing}
            aria-label="Script name"
          />
          <p>
            {script
              ? `Stored ${
                version ? `version ${version.versionNumber}` : "source loading"
              }`
              : "Create a stored script to begin"}
            {dirty ? " · unsaved changes" : ""}
          </p>
        </div>
        {running || script?.status === "disabled"
          ? <Badge label={running ? "running" : "disabled"} />
          : <small>{script?.status ?? "New script"}</small>}
      </div>
      <div className="editor-toolbar">
        <label>
          Language
          <select
            value={language}
            disabled={running || preparing}
            onChange={(e) =>
              setLanguage(e.target.value)}
          >
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
          </select>
        </label>
        <div className="profile-control">
          <div className="label-row">
            <label htmlFor="execution-profile">Execution profile</label>
            <InfoTip label="Execution profile">
              <p>
                Deno/Docker grants for this run. Assistant settings do not grant
                permissions.
              </p>
              <p>
                <strong>Fixed profiles</strong> provide predefined grants.{" "}
                <strong>Per-script permissions</strong>{" "}
                use only this version’s explicit review.
              </p>
              {all.map((p) => (
                <p key={p.id}>
                  <strong>{p.label}:</strong> {profileScopes[p.id]}
                </p>
              ))}
              <p>These scoped grants are not a general security guarantee.</p>
            </InfoTip>
          </div>
          <select
            id="execution-profile"
            aria-label="Permission profile"
            value={profile}
            disabled={running || preparing}
            onChange={(e) =>
              chooseProfile(e.target.value as PermissionProfileId)}
          >
            {all.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="btn"
            disabled={running || busy || preparing || !name.trim() ||
              !source.trim()}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : script ? "Save changes" : "Create script"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!script ||
              !version ||
              dirty ||
              preparing ||
              running ||
              busy ||
              script.status === "disabled" || !permissions?.loaded}
            aria-describedby="run-help"
            title={runHelp}
            onClick={() => void run()}
          >
            {running
              ? "Running…"
              : preparing
              ? "Checking permissions…"
              : "▶ Run"}
          </button>
        </div>
      </div>
      <p id="run-help" className="run-help" role="status" hidden={!runHelp}>
        {runHelp}
      </p>
      {script && version && (
        <CapabilityPermissions
          key={version.id}
          scriptId={script.id}
          versionId={version.id}
          dirty={sourceDirty &&
            (knownCalls.length > 0 ||
              !!permissions?.manifest?.requested.length)}
          running={running}
          onStateChange={permissionsChanged}
          reviewRequest={reviewRequest?.versionId === version.id
            ? reviewRequest.serial
            : 0}
        />
      )}
      {guidance && guidance.versionId === version?.id && (
        <div className="profile-compatibility" role="status">
          <strong>{guidance.title}</strong>
          <p>{guidance.message}</p>
          <button
            type="button"
            className="btn btn-small"
            disabled={running || busy || preparing || sourceDirty}
            onClick={() => {
              if (guidance.action === "review") {
                openReview();
              } else if (guidance.profile) {
                chooseProfile(guidance.profile);
              }
            }}
          >
            {guidance.action === "review"
              ? "Review permissions"
              : `Use ${PROFILE_LABELS[guidance.profile ?? "none"]}`}
          </button>
        </div>
      )}
      {importsHost(completeSource) && profile !== "host-chat" &&
        profile !== "host-capabilities" && (
        <div className="profile-compatibility" role="status">
          <strong>This script imports the Host SDK.</strong>
          <p>
            {!script || permissions?.manifest
              ? "Save and review this version’s requested permissions, then use Per-script permissions for its host calls."
              : "This historical version can use the predefined Chat broadcast (fixed) profile. Newly saved versions can request per-script permissions."}
            {" "}
            Changing a mode does not approve permissions or run the script.
          </p>
          <button
            className="btn btn-small"
            disabled={running || busy || preparing ||
              (!!script && !permissions?.loaded) || sourceDirty}
            onClick={() => {
              if (
                permissions?.manifest?.requested.length &&
                !permissions.manifest.review
              ) {
                openReview();
              } else {chooseProfile(
                  !script || permissions?.manifest
                    ? "host-capabilities"
                    : "host-chat",
                );}
            }}
          >
            {permissions?.manifest?.requested.length &&
                !permissions.manifest.review
              ? "Review requested permissions"
              : `Use ${
                !script || permissions?.manifest
                  ? "Per-script permissions"
                  : "Chat broadcast (fixed)"
              }`}
          </button>
        </div>
      )}
      {permissions?.manifest &&
        knownCalls.filter((id) =>
          !permissions.manifest?.review?.approved.some((r) =>
            r.capability === id
          )
        ).map((id) => (
          <p className="editor-capability-warning" key={id}>
            This script uses{" "}
            <code>{id}</code>, but that capability is not approved for this
            version.{sourceDirty
              ? " Save a new version and review its permissions."
              : " The Gateway will reject unapproved calls."}
          </p>
        ))}
      <div className="editor-filebar">
        <span>
          {name.replace(/\.(?:js|ts)$/i, "")}.
          {language === "typescript" ? "ts" : "js"}
        </span>
        <span>
          {provider === "docker"
            ? "Docker / Deno · restricted execution"
            : provider === "mock"
            ? "Mock · source is not executed"
            : "Provider not loaded"}
        </span>
      </div>
      {project && (
        <div className="project-tabs" role="tablist" aria-label="Project files">
          {project.files.map((f, i) => (
            <button
              key={f.path}
              id={`project-tab-${i}`}
              role="tab"
              type="button"
              aria-selected={activeFile === f.path}
              aria-controls="project-editor-panel"
              title={f.path}
              tabIndex={activeFile === f.path ? 0 : -1}
              onClick={() => setActiveFile(f.path)}
              onKeyDown={(e) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                ) {
                  e.preventDefault();
                  const next = e.key === "Home"
                    ? 0
                    : e.key === "End"
                    ? project.files.length - 1
                    : (i + (e.key === "ArrowRight" ? 1 : -1) +
                      project.files.length) % project.files.length;
                  setActiveFile(project.files[next]!.path);
                  document.getElementById(`project-tab-${next}`)?.focus();
                }
              }}
            >
              {f.path}
              {f.path === project.entrypoint ? " · entry" : ""}
              {f.content !==
                  (version?.project?.files.find((v) =>
                    v.path === f.path
                  )
                    ?.content ??
                    (f.path === singleProject(source, language).entrypoint
                      ? version?.source
                      : undefined))
                ? " •"
                : ""}
            </button>
          ))}
        </div>
      )}
      <details className="project-file-tools">
        <summary>Project files</summary>
        <p>
          All files save together. Renaming or deleting a file does not rewrite
          its imports. JSON is imported with{" "}
          <code>{'with {type: "json"}'}</code>.
        </p>
        <div className="management-row">
          <label>
            File path<input
              aria-label="File path"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="utils/helper.ts"
              disabled={running || busy || preparing}
            />
          </label>
          <button
            className="btn btn-small"
            onClick={() => manageFile("add")}
            disabled={running || busy || preparing || !filePath}
          >
            New file
          </button>
          <button
            className="btn btn-small"
            onClick={() => manageFile("rename")}
            disabled={running || busy || preparing || !filePath}
          >
            Rename active file
          </button>
          {project && (
            <>
              <button
                className="btn btn-small btn-destructive"
                disabled={running || busy || preparing ||
                  activeFile === project.entrypoint}
                onClick={() => manageFile("delete")}
              >
                Delete active file
              </button>
              <label>
                Entrypoint<select
                  aria-label="Project entrypoint"
                  value={project.entrypoint}
                  disabled={running || busy || preparing}
                  onChange={(e) => {
                    const entrypoint = e.target.value;
                    setProject({ ...project, entrypoint });
                    setSource(
                      project.files.find((f) => f.path === entrypoint)!.content,
                    );
                  }}
                >
                  {project.files.filter((f) => /\.(ts|js)$/.test(f.path)).map(
                    (f) => <option key={f.path}>{f.path}</option>,
                  )}
                </select>
              </label>
            </>
          )}
        </div>
      </details>
      <div
        id="project-editor-panel"
        role={project ? "tabpanel" : undefined}
        aria-label={shownFile?.path}
      >
        <CodeEditor
          key={draftKey}
          documentKey={activeFile || "single"}
          value={shownSource}
          language={shownFile?.path.endsWith(".json")
            ? "json"
            : shownFile?.path.endsWith(".js")
            ? "javascript"
            : shownFile ? "typescript" : language}
          readOnly={running || busy || preparing}
          onChange={changeSource}
          location={!sourceDirty && errorTarget?.versionId === version?.id &&
              (!project || errorTarget!.path === activeFile)
            ? errorTarget
            : null}
        />
      </div>
      <div className="editor-footer">
        <span id="source-editor-help">
          {dirty
            ? "Save changes before Run. "
            : " "}
          {all.find((p) => p.id === profile)?.description}
        </span>
        <span>{shownSource.split("\n").length} lines</span>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <span role="status" className="save-feedback">
        {message}
      </span>
      {script && (
        <details className="detail-disclosure script-management">
          <summary>Script versions &amp; availability</summary>
          <div className="management-row">
            <label>
              Stored version
              <select
                aria-label="Stored version"
                value={version?.id ?? ""}
                disabled={dirty || running || busy}
                onChange={(e) => {
                  const found = versions.find((v) => v.id === e.target.value);
                  if (found) onVersion(found);
                }}
              >
                {!versions.length && version && (
                  <option value={version.id}>
                    Version {version.versionNumber}
                  </option>
                )}
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.versionNumber}
                    {v.id === script.currentVersionId ? " · current" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Script availability
              <select
                value={script.status}
                disabled={running || busy || preparing}
                onChange={async (e) => {
                  try {
                    await api.patchScript(script.id, {
                      status: e.target.value as Script["status"],
                    });
                    if (version) onSaved(version);
                  } catch (err) {
                    setError(String(err));
                  }
                }}
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
          </div>
          <p className="hint">
            Version history is retained. Availability changes script metadata;
            it does not grant runtime permissions.{" "}
            {execution && execution.scriptVersionId !== version?.id
              ? "The selected execution used a different stored version from this editor."
              : ""}
          </p>
        </details>
      )}
    </section>
  );
}
