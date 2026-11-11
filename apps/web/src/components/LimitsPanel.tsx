import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import {
  CAPABILITY_EXAMPLES,
  type CapabilityId,
  MATERIALS,
  SOUNDS,
  TIMES,
  WEATHER,
} from "../../../../packages/contracts/src/capabilities";
import {
  PLATFORM_LIMITATIONS,
  PROJECT_LIMITS,
} from "../../../../packages/contracts/src/script-project";
export function LimitsPanel({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [registry, setRegistry] = useState<
      Awaited<ReturnType<typeof api.capabilityRegistry>> | null
    >(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (dialog.current) {
      if (dialog.current.showModal) dialog.current.showModal();
      else dialog.current.setAttribute("open", "");
    }
    api.capabilityRegistry().then((r) => {
      if (active) setRegistry(r);
    }).catch(() => {
      if (active) {
        setError(
          "The running capability registry could not be loaded. Try reopening this guide.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <dialog
      className="limits-dialog"
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="limits-title"
    >
      <header className="section-heading">
        <div>

          <h2 id="limits-title">What are the limits?</h2>
        </div>
        <button className="btn" onClick={onClose} autoFocus>
          Close limits
        </button>
      </header>
      <p>
        Create calculations, loops, functions/classes and small local modules.
        Each Run starts a fresh isolated sandbox, executes once within
        configured time, memory, CPU and output budgets, returns evidence, then
        destroys the sandbox. An infinite loop is terminated; it does not become
        a background service.
      </p>
      <h3>Files and local imports</h3>
      <p>
        Complex scripts may use multiple local TypeScript, JavaScript and JSON
        files. They appear as tabs and execute together as one version. Up to
        {" "}
        {PROJECT_LIMITS.maxFiles} files, {PROJECT_LIMITS.maxFileBytes / 1024}
        {" "}
        KiB each and {PROJECT_LIMITS.maxTotalBytes / 1024}{" "}
        KiB total. Choose an entrypoint and import helpers with relative paths.
        These saved project files do not provide unrestricted filesystem access.
        Runtime changes are never saved back.
      </p>
      <h3>Why does the app ask for permission?</h3>
      <p>
        The Assistant can request a capability, but you must approve it for that
        specific script version. The Host Gateway enforces exactly what was
        approved, including argument restrictions and quotas. Approving one
        script does not grant permissions to another script or its next version.
        Advisory assessments never grant permissions.
      </p>
      <h3>Minecraft interaction · running registry</h3>
      {error
        ? <p role="alert">{error}</p>
        : !registry
        ? <p role="status">Loading registered capabilities…</p>
        : Object.entries(registry).map(([id, c]) => (
          <article className="limit-capability" key={id}>
            <h4>
              {c.label} <code>{id}</code>
            </h4>
            <p>
              {c.description} Maximum {c.maxCalls} calls; capability impact:
              {" "}
              {c.impact}. Your approval may narrow this further.
            </p>
            <pre className="code">{CAPABILITY_EXAMPLES[id as CapabilityId]??'See the current SDK documentation.'}</pre>
          </article>
        ))}
      <p>
        World coordinate actions use the first active world, within 32 blocks
        horizontally and −8…+16 vertically of spawn, loaded chunks only. Blocks
        require integer coordinates, an approved material and cannot replace
        containers/block entities or bedrock. No NBT. Spawns allow
        ZOMBIE/SKELETON/COW/PIG; demo entities are stationary and scheduled for
        removal after 60 seconds. Sounds use fixed volume/pitch and an
        allowlist. Weather/time changes affect the active world; time persists
        until changed. Player actions require an online exact name. Total
        session budget: 12 argument-valid authorized calls.
      </p>
      <details>
        <summary>Registered argument allowlists</summary>
        <p>
          Block materials: {MATERIALS.join(", ")}. Weather:{" "}
          {WEATHER.join(", ")}. Time: {TIMES.join(", ")}. Sounds:{" "}
          {SOUNDS.join(", ")}.
        </p>
      </details>
      <h3>What is not possible?</h3>
      <ul>{PLATFORM_LIMITATIONS.map((l) => <li key={l}>{l}</li>)}</ul>
      <p>
        Scripts cannot wait for clicks, joins, movement, combat or block events.
        Persistent subscriptions require a different lifecycle and resource
        model.
      </p>
      <h3>Examples you can ask the Assistant</h3>
      <ul>
        <li>
          Spawn two zombies, change weather to thunder, place an approved block
          near the demo location and announce it.
        </li>
        <li>
          Read GoldennBullet’s position and place diamond ore two blocks away,
          if it is inside the permitted demo area.
        </li>
        <li>
          Create a multi-file script with a helper module and JSON
          configuration.
        </li>
        <li>Read server status and send a private summary to GoldennBullet.</li>
      </ul>
      <p>
        “When a player left-clicks, execute this forever” is unsupported. Ask
        for the supported action as a manually run one-shot script instead.
      </p>
      <p className="hint">
        Expanded capabilities and multi-file scripts are post-analysis
        extensions, outside the frozen Phase 1–7 experiments.
      </p>
    </dialog>
  );
}
