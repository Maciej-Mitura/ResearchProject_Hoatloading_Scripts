import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type {
  ProjectSettingsField,
  ProjectSettingsResponse,
  ValidationIssue,
} from "../types";

type SaveState = "idle" | "saving" | "saved" | "error";

const CATEGORY_ORDER = ["host", "bridge", "scripting", "security", "project"] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  host: "Host / Game",
  bridge: "Bridge",
  scripting: "Scripting",
  security: "Security",
  project: "Project",
};

export function ProjectSettingsPanel() {
  const [data, setData] = useState<ProjectSettingsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showEffective, setShowEffective] = useState(false);
  const [pendingConfirmReset, setPendingConfirmReset] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getProjectSettings();
      setData(res);
      setLoadError(null);
    } catch (err) {
      setLoadError(String(err));
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [load]);

  const fieldsByCategory = useMemo(() => {
    const map = new Map<string, ProjectSettingsField[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const f of data?.fields ?? []) {
      const list = map.get(f.category) ?? [];
      list.push(f);
      map.set(f.category, list);
    }
    return map;
  }, [data]);

  const blockingIssues = (data?.issues ?? []).filter((i) => i.severity === "error");
  const warningIssues = (data?.issues ?? []).filter((i) => i.severity === "warning");

  function scheduleSave(patch: Record<string, unknown>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("saving");
    setSaveError(null);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await api.patchProjectSettings(patch);
          setData(res);
          setSaveState("saved");
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setSaveState("idle"), 1800);
        } catch (err) {
          setSaveState("error");
          setSaveError(String(err));
          await load();
        }
      })();
    }, 450);
  }

  function onFieldChange(field: ProjectSettingsField, next: unknown) {
    // Optimistic local update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: prev.fields.map((f) =>
          f.path === field.path ? { ...f, value: next, source: "override" as const } : f
        ),
      };
    });
    scheduleSave(pathToPatch(field.path, next));
  }

  async function onReset() {
    setPendingConfirmReset(false);
    setSaveState("saving");
    try {
      const res = await api.resetProjectSettings();
      setData(res);
      setSaveState("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 1800);
    } catch (err) {
      setSaveState("error");
      setSaveError(String(err));
    }
  }

  if (loadError) {
    return <p className="error-banner">{loadError}</p>;
  }
  if (!data) {
    return <p className="empty">Loading project settings…</p>;
  }

  return (
    <div className="project-settings">
      <div className="project-settings-status" aria-live="polite">
        {saveState === "saving" && <span className="save-pill">Saving…</span>}
        {saveState === "saved" && <span className="save-pill save-ok">Saved</span>}
        {saveState === "error" && (
          <span className="save-pill save-err">Error saving{saveError ? `: ${saveError}` : ""}</span>
        )}
      </div>

      {blockingIssues.length > 0 && (
        <div className="settings-alert settings-alert-error" role="alert">
          {blockingIssues.map((i, idx) => (
            <p key={idx}>{issueText(i)}</p>
          ))}
        </div>
      )}

      {warningIssues.slice(0, 4).map((i, idx) => (
        <div key={idx} className="settings-alert settings-alert-warn">
          <p>{issueText(i)}</p>
        </div>
      ))}

      {data.preview.versionMismatch && (
        <div className="settings-alert settings-alert-warn">
          <p>
            Configured Minecraft version differs from the currently connected server
            ({data.preview.reportedGameVersion ?? "unknown"}).
          </p>
        </div>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const fields = fieldsByCategory.get(cat) ?? [];
        if (fields.length === 0) return null;
        return (
          <div key={cat} className="inspector-block">
            <h3>{CATEGORY_LABELS[cat]}</h3>
            <div className="settings-fields">
              {fields.map((field) => (
                <FieldRow
                  key={field.path}
                  field={field}
                  onChange={(v) => onFieldChange(field, v)}
                />
              ))}
            </div>
          </div>
        );
      })}

      <div className="inspector-block">
        <h3>AI Context Preview</h3>
        <button
          type="button"
          className="btn"
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? "Hide preview" : "Show AI Context Preview"}
        </button>
        {showPreview && (
          <dl className="kv settings-preview">
            <dt>Game</dt>
            <dd>{data.preview.game}</dd>
            <dt>Server</dt>
            <dd>{data.preview.server}</dd>
            <dt>Runtime</dt>
            <dd>{data.preview.runtime}</dd>
            <dt>Preferred language</dt>
            <dd>{data.preview.preferredLanguage}</dd>
            <dt>Network</dt>
            <dd>{data.preview.network}</dd>
            <dt>Filesystem</dt>
            <dd>{data.preview.filesystem}</dd>
            <dt>Host capabilities</dt>
            <dd>
              <ul className="cap-list">
                {data.preview.hostCapabilities.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </dd>
            <dt>Host status</dt>
            <dd>{data.preview.hostStatus}</dd>
            <dt>Enforcement</dt>
            <dd>{data.preview.enforcement}</dd>
          </dl>
        )}
        <p className="hint">
          Policy settings describe intent. Enforcement may still be mocked in this PoC.
        </p>
      </div>

      <div className="inspector-block">
        <h3>Effective configuration</h3>
        <button
          type="button"
          className="btn"
          onClick={() => setShowEffective((v) => !v)}
        >
          {showEffective ? "Hide effective configuration" : "View effective configuration"}
        </button>
        {showEffective && (
          <pre className="code">{JSON.stringify(data.effective, null, 2)}</pre>
        )}
      </div>

      <div className="inspector-block">
        <h3>Reset</h3>
        {!pendingConfirmReset ? (
          <button
            type="button"
            className="btn"
            onClick={() => setPendingConfirmReset(true)}
          >
            Reset to defaults
          </button>
        ) : (
          <div className="reset-confirm">
            <p className="hint">
              Clear all project overrides and restore values from the base project specification?
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn-primary" onClick={() => void onReset()}>
                Confirm reset
              </button>
              <button type="button" className="btn" onClick={() => setPendingConfirmReset(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  field,
  onChange,
}: {
  field: ProjectSettingsField;
  onChange: (value: unknown) => void;
}) {
  const sourceLabel =
    field.source === "override" ? "Project override" : "Base configuration";

  return (
    <label className={`settings-field${field.risky ? " settings-field-risky" : ""}`}>
      <span className="settings-field-label">
        {field.label}
        <span className="settings-source">{sourceLabel}</span>
      </span>
      {field.description && <span className="settings-field-desc">{field.description}</span>}
      {renderControl(field, onChange)}
      {field.risky && field.value === true && (
        <span className="settings-risky-note">
          Expands script authority; enforcement may still be mocked.
        </span>
      )}
    </label>
  );
}

function renderControl(
  field: ProjectSettingsField,
  onChange: (value: unknown) => void,
) {
  if (!field.editable) {
    return (
      <span className="settings-readonly">
        {formatDisplay(field.value)}
      </span>
    );
  }

  if (field.type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={Boolean(field.value)}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  if (field.type === "enum" && field.values?.length) {
    return (
      <select
        value={String(field.value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      >
        {field.values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      value={field.value == null ? "" : String(field.value)}
      placeholder={field.value == null ? "null" : undefined}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw.trim() === "" ? null : raw);
      }}
    />
  );
}

function formatDisplay(value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function pathToPatch(path: string, value: unknown): Record<string, unknown> {
  const parts = path.split(".");
  const root: Record<string, unknown> = {};
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const next: Record<string, unknown> = {};
    cur[parts[i]!] = next;
    cur = next;
  }
  cur[parts[parts.length - 1]!] = value;
  return root;
}

function issueText(i: ValidationIssue): string {
  return i.path ? `${i.message}` : i.message;
}
