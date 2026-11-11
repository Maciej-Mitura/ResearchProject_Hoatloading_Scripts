import {
  bindingSource,
  projectText,
} from "../../../../packages/contracts/src/script-project";
import { useEffect, useState } from "react";
import {
  CAPABILITIES,
  isCapability,
  parseRequests,
  prepareRequests,
} from "../../../../packages/contracts/src/capabilities";
import type { ScriptProposal } from "../types";
import { api } from "../api/client";

export interface SavedProposalVersion {
  scriptId: string;
  versionId: string;
}
export type SaveChatProposal = (
  proposal: ScriptProposal,
  messageId?: string,
) => Promise<SavedProposalVersion | void>;

async function findSavedVersion(
  proposal: ScriptProposal,
  messageId: string,
): Promise<SavedProposalVersion> {
  const scripts = (await api.listScripts()).filter((s) =>
    s.sourceMessageId === messageId
  );
  const matches: SavedProposalVersion[] = [];
  for (const script of scripts) {
    const detail = await api.getScript(script.id);
    for (const version of detail.versions) {
      if (
        bindingSource(version.source, version.project) ===
          bindingSource(proposal.source, proposal.project) &&
        version.language === proposal.language
      ) matches.push({ scriptId: script.id, versionId: version.id });
    }
  }
  if (matches.length !== 1) {
    throw new Error(
      "Open this script in Workbench to select the exact saved version for review.",
    );
  }
  return matches[0]!;
}

/** Explicit chat controls use the same version-bound review endpoint as Workbench. */
export function ChatCapabilityReview(
  { proposal, messageId, saved, saving, onSave, index = 0 }: {
    proposal: ScriptProposal;
    messageId: string;
    saved: boolean;
    saving: boolean;
    onSave: SaveChatProposal;
    index?: number;
  },
) {
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [binding, setBinding] = useState<SavedProposalVersion | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [storedReview, setStoredReview] = useState<
    { approved: number; denied: number } | null
  >(null);
  useEffect(() => {
    if (!saved || binding || confirmed) return;
    let active = true;
    void findSavedVersion(proposal, messageId).then(async (target) => {
      const { manifest } = await api.getManifest(
        target.scriptId,
        target.versionId,
      );
      if (active) {
        setBinding(target);
        if (manifest?.review) {
          setStoredReview({
            approved: manifest.review.approved.length,
            denied: manifest.review.denied.length,
          });
        }
      }
    }).catch(
      () => {
        /* Exact version errors are shown if the user tries to confirm. */
      },
    );
    return () => {
      active = false;
    };
  }, [
    saved,
    messageId,
    proposal.source,
    proposal.language,
    JSON.stringify(proposal.project),
  ]);
  let requests: ReturnType<typeof prepareRequests>;
  try {
    requests = prepareRequests(
      proposal.project ? projectText(proposal.project) : proposal.source,
      proposal.requestedCapabilities,
    );
  } catch {
    return (
      <p role="alert">
        This proposal contains invalid capability requests. Ask the assistant to
        revise it.
      </p>
    );
  }
  const supported = requests.requested.filter((r) =>
    isCapability(r.capability)
  );
  const ready = supported.every((r) => choices[r.capability] !== undefined);
  const pending = busy || saving;

  async function resolveSaved(): Promise<SavedProposalVersion> {
    if (binding) return binding;
    if (!saved) {
      const result = await onSave(proposal, messageId);
      if (!result) {
        throw new Error(
          "The saved version could not be identified. Review its permissions in Workbench.",
        );
      }
      setBinding(result);
      return result;
    }
    // Recover only the exact proposal version, never the current edited source.
    const result = await findSavedVersion(proposal, messageId);
    setBinding(result);
    return result;
  }
  async function confirm() {
    if (pending || confirmed || !ready) return;
    setBusy(true);
    setError("");
    try {
      if (!requests.requested.length) {
        await onSave(proposal, messageId);
        setConfirmed(true);
        return;
      }
      const target = await resolveSaved();
      if (requests.requested.length) {
        const { manifest } = await api.getManifest(
          target.scriptId,
          target.versionId,
        );
        if (!manifest) {
          throw new Error(
            "This is a legacy version. Save a new version in Workbench to use capability review.",
          );
        }
        // A different request list must be reviewed afresh, even for identical source.
        if (
          JSON.stringify(parseRequests(manifest.requested)) !==
            JSON.stringify(requests.requested)
        ) {
          throw new Error(
            "The saved permission requests differ from this proposal. Review them in Workbench.",
          );
        }
        await api.reviewManifest(
          target.scriptId,
          target.versionId,
          manifest.id,
          supported.filter((r) => choices[r.capability] === true).map((r) =>
            r.capability
          ),
        );
        window.dispatchEvent(
          new CustomEvent("capability-review-updated", {
            detail: { versionId: target.versionId },
          }),
        );
      }
      setConfirmed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  if (!requests.requested.length) {
    return (
      <div className="chat-permission-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || saved || confirmed}
          onClick={() => void confirm()}
        >
          {saved || confirmed
            ? "Saved to scripts"
            : pending
            ? "Saving…"
            : `Save script${index ? ` ${index + 1}` : ""} as draft`}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <section
      className="chat-permission-review"
      aria-label={`Permissions for ${proposal.name}`}
    >
      <div className="chat-permission-heading">
        <strong>Choose this script’s permissions</strong>
        <span>{requests.requested.length} requested</span>
      </div>
      <p className="hint">
        Choose Yes or No for each capability, then confirm. This saves your
        choices for this script version and does not run it.
      </p>
      {storedReview && !confirmed && (
        <p className="hint">
          Saved review: {storedReview.approved} approved · {storedReview.denied}
          {" "}
          denied. Choose below only if you want to change it.
        </p>
      )}
      {requests.requested.map((r) => (
        <div className="chat-permission-row" key={r.capability}>
          <div>
            <strong>
              {isCapability(r.capability)
                ? CAPABILITIES[r.capability].label
                : r.capability}
            </strong>
            <p>
              {isCapability(r.capability)
                ? CAPABILITIES[r.capability].description
                : "This project does not expose this capability."}
            </p>
            <p className="hint">Why requested: {r.reason}</p>
            <small>
              {["materials", "weather", "times", "sounds"].map((k) =>
                (r.constraints as unknown as Record<string, string[]>)[k]
                    ?.length
                  ? ` · ${k}: ${
                    (r.constraints as unknown as Record<string, string[]>)[k]
                      ?.join(", ")
                  }`
                  : ""
              )} Maximum {r.constraints.maxCalls}{" "}
              {r.constraints.maxCalls === 1 ? "call" : "calls"}
              {r.constraints.entityTypes
                ? ` · ${r.constraints.entityTypes.join(", ")}`
                : ""}
              {r.constraints.playerNames
                ? ` · ${r.constraints.playerNames.join(", ")}`
                : ""}
              {isCapability(r.capability)
                ? ` · Impact: ${
                  CAPABILITIES[r.capability].impact.toUpperCase()
                }`
                : " · Unsupported (approval unavailable)"}
            </small>
          </div>
          {isCapability(r.capability)
            ? (
              <div
                className="chat-permission-choices"
                role="group"
                aria-label={`Allow ${CAPABILITIES[r.capability].label}?`}
              >
                <button
                  type="button"
                  aria-pressed={choices[r.capability] === true}
                  aria-label={`Yes, allow ${CAPABILITIES[r.capability].label}`}
                  disabled={pending || confirmed}
                  onClick={() =>
                    setChoices((s) => ({ ...s, [r.capability]: true }))}
                >
                  <span aria-hidden="true">✓</span> Yes
                </button>
                <button
                  type="button"
                  aria-pressed={choices[r.capability] === false}
                  aria-label={`No, deny ${CAPABILITIES[r.capability].label}`}
                  disabled={pending || confirmed}
                  onClick={() =>
                    setChoices((s) => ({ ...s, [r.capability]: false }))}
                >
                  <span aria-hidden="true">×</span> No
                </button>
              </div>
            )
            : <span className="hint">Not available</span>}
        </div>
      ))}
      {requests.warnings.map((w) => <p className="hint" key={w}>{w}</p>)}
      {error && <p role="alert">{error}</p>}
      <div className="chat-permission-actions">
        <button
          className="btn btn-primary"
          disabled={pending || confirmed || !ready}
          onClick={() => void confirm()}
        >
          {confirmed
            ? "Permissions saved"
            : pending
            ? "Saving choices…"
            : saved || binding
            ? "Confirm permission choices"
            : "Save script & confirm choices"}
        </button>
        <span className="hint" role="status">
          {confirmed
            ? `${
              supported.filter((r) => choices[r.capability]).length
            } approved · ${
              requests.requested.length -
              supported.filter((r) => choices[r.capability]).length
            } denied. Run separately in Workbench.`
            : ready
            ? "Your choices are ready to confirm."
            : "No choices are selected automatically."}
        </span>
      </div>
    </section>
  );
}
