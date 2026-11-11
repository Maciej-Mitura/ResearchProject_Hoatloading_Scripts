import { useEffect, useRef } from "react";
interface Props {
  open: boolean;
  onClose: () => void;
}

export function HelpPanel({ open, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, [open]);
  if (!open) return null;

  return (
    <div
      ref={panel}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
        if (e.key === "Tab") {
          const nodes = panel.current?.querySelectorAll<HTMLElement>(
            'button, a[href], input, select, textarea, [tabindex="0"]',
          );
          if (!nodes?.length) return;
          const first = nodes[0]!,
            last = nodes[nodes.length - 1]!;
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
      className="help-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="help-panel">
        <header className="help-header">
          <h2 id="help-title">How to use</h2>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            aria-label="Close help"
          >
            Close
          </button>
        </header>

        <div className="help-body">
          <section>
            <h3>Understanding execution evidence</h3>
            <p>
              Completed, failed and terminated describe process outcome.
              Advisory assessment describes a separate analyzer result, not
              maliciousness or permission grants. Collection describes how
              usable the permission audit is: complete, partial, unavailable, or
              legacy status unknown.
            </p>
            <p>
              Observed means supported by a trusted record; inferred means
              derived from related records without an independent record for
              that exact stage. Not recorded means no reliable record is
              available; not applicable means the stage was not used. A recorded
              collection status can itself say unavailable. A host-chat profile
              permits requests but does not prove usage; queued is not
              confirmed.
            </p>
            <p>
              During execution, elapsed time and coarse API statuses are shown.
              There is no meaningful percentage for an arbitrary script. Output
              appears after the provider returns; late host acknowledgements are
              refreshed for a bounded follow-up window.
            </p>
          </section>
          <section>
            <h3>Workbench: select → edit → run</h3>
            <p>
              Select a stored script or choose New script. Save changes as a
              stored version, choose an execution profile and Run. Workbench
              shows live execution status. Use View in Execution Insights to
              inspect that run's Output, Evidence, Runtime and Timeline or
              compare recorded runs. The assistant is optional.
            </p>
          </section>
          <section>
            <h3>1. Start a conversation</h3>
            <p>
              Open Assistant conversations in the script library and choose New
              conversation. Messages are saved automatically; there is no
              separate Save chat step. Selecting a conversation also selects its
              newest linked script and latest execution.
            </p>
          </section>
          <section>
            <h3>2. Describe what you want</h3>
            <p>
              Ask for a JavaScript or TypeScript script, for example: Create a
              script that prints test hello and 2 + 2.
            </p>
            <p>
              Use top-level code, or call any function you define. Exporting a
              function alone does not execute it. Gemini/OpenAI generate
              replies; Mock only provides fixed demonstrations.
            </p>
          </section>
          <section>
            <h3>3. Review the proposed script</h3>
            <p>
              Click Save script as draft beneath an assistant proposal or
              JavaScript/TypeScript code block. This also works in older
              conversations. Review each block before saving; save a complete
              runnable script rather than a partial example.
            </p>
            <p>
              The saved draft appears in the Script library and opens in the
              Workbench editor. Selecting a saved script opens its linked
              conversation. Execution history is newest first and selecting a
              run opens its script and conversation.
            </p>
          </section>
          <section>
            <h3>4. Choose permissions and Run</h3>
            <p>
              <strong>Fixed profiles</strong>{" "}
              provide predefined grants such as fixture access, the demo
              environment value, or historical chat broadcast.
            </p>
            <p>
              <strong>Per-script permissions</strong>{" "}
              use specific host capabilities approved for each saved version.
              The Assistant proposes; you decide; the Host Gateway enforces. Run
              opens review first when needed. After review the mode is selected
              visibly, and you still click Run yourself. Changing away from it
              is respected.
            </p>
            <dl className="help-dl">
              <div>
                <dt>No permissions</dt>
                <dd>
                  For console logging, calculations, and text processing. No
                  explicit filesystem, network, environment, subprocess or FFI
                  grants.
                </dd>
              </div>
              <div>
                <dt>Read test fixture</dt>
                <dd>
                  Read /fixtures/allowed.txt inside the sandbox. This does not
                  allow reading your computer or Minecraft files.
                </dd>
              </div>
              <div>
                <dt>Demo environment variable</dt>
                <dd>
                  Read SANDBOX_DEMO_VALUE only; its demo value is
                  hello-from-supervisor.
                </dd>
              </div>
              <div>
                <dt>Chat broadcast (legacy versions)</dt>
                <dd>
                  Use import &#123; host &#125; from &quot;host&quot; and await
                  host.chat.broadcast(&quot;Hello&quot;). Default budget: five
                  calls per execution, 256 characters per message.
                </dd>
              </div>
              <div>
                <dt>Per-script permissions</dt>
                <dd>
                  For new saved versions using the Host SDK. Review Version
                  permissions first: the assistant proposes; you select each
                  capability. New versions require a fresh review. The profile
                  supplies transport only; it does not approve capabilities.
                </dd>
              </div>
            </dl>
            <p>
              Open “What are the limits?” in Workbench to see the running
              capability registry, exact SDK examples and supported constraints.
              Every new review starts unchecked. Partial denial remains enforced
              even if unchanged source still attempts the call. Inspect or
              export capability usage in the selected run's Insights.
            </p>
            <p>
              This capability-manifest prototype is a post-analysis extension
              and was not part of the frozen research experiments.
            </p>
            <p>
              Run executes the stored source once in a fresh Docker/Deno sandbox
              when the provider is Docker/Deno. Mock simulates execution. This
              does not install a persistent Paper plugin or subscribe to player
              events.
            </p>
            <dl className="help-dl">
              <div>
                <dt>Queued</dt>
                <dd>Request received.</dd>
              </div>
              <div>
                <dt>Validating</dt>
                <dd>Checking the script and request.</dd>
              </div>
              <div>
                <dt>Running</dt>
                <dd>Executing the source.</dd>
              </div>
              <div>
                <dt>Analysing</dt>
                <dd>Assessing recorded execution evidence afterward.</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>
                  Process exited successfully. Inspect STDOUT and host activity.
                </dd>
              </div>
              <div>
                <dt>Failed</dt>
                <dd>
                  Inspect STDERR, exit code, and failure category. A permission
                  denial can be an expected test result.
                </dd>
              </div>
              <div>
                <dt>Terminated</dt>
                <dd>Execution hit the configured timeout.</dd>
              </div>
              <div>
                <dt>Blocked</dt>
                <dd>
                  Reserved policy status; advisory risk classification does not
                  block execution.
                </dd>
              </div>
            </dl>
          </section>
          <section>
            <h3>5. Risk assessment and evidence</h3>
            <p>
              Execution Insights starts with history. Filter to Most recent run
              or sort the history, then select a row to open that run's details
              and statistics. The Workbench result button opens its run
              directly.
            </p>
            <p>
              Execution evidence and Insights follow the selected execution. LOW
              / REVIEW / HIGH describe observed behavior, not whether a script
              is safe or malicious. Jev never grants permissions. Jev
              unavailable means classification failed; execution can still
              succeed.
            </p>
            <p>
              The timeline is reconstructed from PostgreSQL records. Advanced
              details show execution and trace IDs. OpenTelemetry exports
              reconstructed traces separately to a non-durable collector debug
              exporter; late Paper confirmation remains stored project evidence.
              Audit complete / partial / unavailable / legacy_unknown describes
              collection, not permission outcomes. Zero observations alone does
              not prove absence of activity.
            </p>
          </section>
          <section>
            <h3>6. Project Settings and Host Activity</h3>
            <p>
              These pages apply to the entire project, not individual chats.
              Settings save automatically and affect the next assistant turn,
              with no app restart required. They do not reconfigure the running
              Minecraft server or replace the execution permission picker.
            </p>
            <p>
              Host Activity displays live Paper status and confirmed activity.
              Broadcasts originate from an approved Per-script permissions
              execution or a historical host-chat script through the Host
              Gateway. Accepted means queued; confirm the corresponding command
              result and Host Activity event separately.
            </p>
          </section>
          <section>
            <h3>7. Current prototype status</h3>
            <p>
              Chat, execution, and risk providers are configured separately.
              Real execution requires EXECUTION_PROVIDER=docker; Jev requires
              RISK_ANALYZER=jev and working provider access. Host event
              subscriptions are not implemented; normal demos use runc. The
              separate Linux/WSL gVisor experiment found 9/10 compatible
              workloads and a host-chat DNS failure; escape prevention was not
              tested. Older scripts without a recoverable conversation link open
              without a chat.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
