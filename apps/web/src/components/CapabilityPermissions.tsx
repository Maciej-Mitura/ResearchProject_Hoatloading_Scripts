import { useEffect, useRef, useState } from "react";
import {
  CAPABILITIES,
  type CapabilityManifest,
  isCapability,
} from "../../../../packages/contracts/src/capabilities";
import { type PermissionLoad, permissionState } from "../permission-workflow";
import { api } from "../api/client";
import { InfoTip } from "./InfoTip";
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function CapabilityPermissions(
  { scriptId, versionId, dirty, running, onStateChange, reviewRequest = 0 }: {
    scriptId: string;
    versionId: string;
    dirty: boolean;
    running: boolean;
    onStateChange?: (state: PermissionLoad) => void;
    reviewRequest?: number;
  },
) {
  const [manifest, setManifest] = useState<CapabilityManifest | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [reload, setReload] = useState(0);
  const openedRequest = useRef(0);
  const loadGeneration = useRef(0);
  function openReview() {
    setSelected([]);
    setError("");
    dialog.current?.showModal();
  }
  useEffect(() => {
    if (
      reviewRequest > openedRequest.current && manifest?.requested.length &&
      !dirty && !running
    ) {
      openedRequest.current = reviewRequest;
      openReview();
    }
  }, [reviewRequest, manifest, dirty, running]);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    onStateChange?.({ manifest: null, loaded: false });
    const load = (reason: PermissionLoad["reason"] = "loaded") => {
      const generation = ++loadGeneration.current;
      return api.getManifest(scriptId, versionId).then((r) => {
        if (active && generation === loadGeneration.current) {
          setManifest(r.manifest);
          setLoaded(true);
          setError("");
          onStateChange?.({ manifest: r.manifest, loaded: true, reason });
        }
      }).catch((e) => {
        if (active && generation === loadGeneration.current) {
          setError(
            "Permission details could not be loaded. Retry before running.",
          );
          setLoaded(false);
          onStateChange?.({ manifest: null, loaded: false, error: String(e) });
        }
      });
    };
    void load();
    const updated = (event: Event) => {
      if (
        (event as CustomEvent<{ versionId: string }>).detail?.versionId ===
          versionId
      ) void load("external-review");
    };
    window.addEventListener("capability-review-updated", updated);
    return () => {
      active = false;
      window.removeEventListener("capability-review-updated", updated);
    };
  }, [scriptId, versionId, reload, onStateChange]);
  async function approve() {
    if (!manifest || dirty || running) return;
    setBusy(true);
    setError("");
    try {
      const r = await api.reviewManifest(
        scriptId,
        versionId,
        manifest.id,
        selected,
      );
      loadGeneration.current++;
      setManifest(r.manifest);
      onStateChange?.({
        manifest: r.manifest,
        loaded: true,
        reason: "reviewed",
      });
      dialog.current?.close();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  if (error && !loaded) {
    return (
      <div role="alert">
        <p>{error}</p>
        <button
          className="btn btn-small"
          onClick={() => setReload((n) => n + 1)}
        >
          Retry permissions
        </button>
      </div>
    );
  }
  if (!loaded) return <p role="status">Loading version permissions…</p>;
  if (!manifest) {
    return (
      <div className="capability-summary">
        <strong>Fixed profiles</strong>
        <p>
          This historical version uses predefined profiles. No new host
          capabilities are granted. Save a new version to request a manifest.
        </p>
      </div>
    );
  }
  const review = manifest.review;
  return (
    <section className="capability-summary" aria-label="Version permissions">
      <div className="label-row">
        <strong>Permissions: {permissionState(manifest, dirty)}</strong>
        <InfoTip label="Capability manifest">
          <p>
            Approval applies to this saved version. The Gateway checks every call
            against its approved capabilities.
          </p>
          <p>
            Capability impact describes the action. Advisory assessment describes
            the recorded execution.
          </p>
        </InfoTip>
      </div>
      <p>
        {manifest.requested.length} requested · {review?.approved.length ?? 0}
        {" "}
        approved · {review?.denied.length ?? 0} denied · {dirty
          ? "Save this version before reviewing"
          : review
          ? "Decisions saved for this version"
          : manifest.requested.length
          ? "Review required"
          : "No host capabilities requested"}
      </p>
      {manifest.warnings.map((w) => <p className="alert-warning" key={w}>{w}
      </p>)}
      {!!review?.denied.length && (
        <p>
          This script still references capabilities you denied. The Gateway will reject those calls.
        </p>
      )}
      {manifest.requested.map((r) => (
        <p key={r.capability}>
          <code>{r.capability}</code> · {!isCapability(r.capability)
            ? "Unsupported"
            : !review
            ? "Pending review"
            : review.approved.some((a) => a.capability === r.capability)
            ? "Approved"
            : "Denied"} {r.constraints.entityTypes
            ? ` · ${
              r.constraints.entityTypes.join(", ")
            } only · max ${r.constraints.maxCalls}`
            : ` · max ${r.constraints.maxCalls}`}
        </p>
      ))}
      <div className="editor-actions">
        {!!manifest.requested.length && (
          <button
            type="button"
            className="btn btn-small"
            disabled={dirty || running}
            onClick={openReview}
          >
            Review permissions
          </button>
        )}
        <button
          type="button"
          className="btn btn-small"
          onClick={() =>
            downloadJson(manifest, `capability-manifest-${versionId}.json`)}
        >
          Export manifest JSON
        </button>
      </div>
      {review && (
        <small className="permission-review-record">
          Reviewed{" "}
          {new Date(review.approvedAt).toLocaleString()}
        </small>
      )}
      <dialog
        ref={dialog}
        className="capability-dialog"
        aria-labelledby="capability-review-title"
      >
        <h2 id="capability-review-title">Review requested capabilities</h2>
        <p>
          Select the capabilities to approve for this version.
        </p>
        {manifest.requested.map((r) => (
          <div className="capability-option" key={r.capability}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(r.capability)}
                disabled={!isCapability(r.capability) || busy}
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked
                      ? [...s, r.capability]
                      : s.filter((x) =>
                        x !== r.capability
                      )
                  )}
              />
              <strong>
                {isCapability(r.capability)
                  ? CAPABILITIES[r.capability].label
                  : r.capability}
              </strong>
            </label>
            <p>
              {isCapability(r.capability)
                ? CAPABILITIES[r.capability].description
                : "Unsupported: this project does not expose this capability."}
            </p>
            <p>Requested because: {r.reason}</p>
            <p>
              Maximum calls: {r.constraints.maxCalls}
              {["materials", "weather", "times", "sounds"].map((k) =>
                (r.constraints as unknown as Record<string, string[]>)[k]
                    ?.length
                  ? ` · ${k}: ${
                    (r.constraints as unknown as Record<string, string[]>)[k]
                      ?.join(", ")
                  }`
                  : ""
              )}
              {r.constraints.entityTypes
                ? ` · Entities: ${r.constraints.entityTypes.join(", ")}`
                : ""}
              {r.constraints.playerNames
                ? ` · Players: ${r.constraints.playerNames.join(", ")}`
                : ""}
            </p>
            {isCapability(r.capability) && (
              <small>
                Capability impact:{" "}
                {CAPABILITIES[r.capability].impact.toUpperCase()}
              </small>
            )}
          </div>
        ))}
        {error && <p role="alert">{error}</p>}
        <div className="editor-actions">
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || dirty || running}
            onClick={() =>
              void approve()}
          >
            {busy ? "Saving review…" : "Approve selected permissions"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
