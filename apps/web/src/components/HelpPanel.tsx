interface Props {
  open: boolean;
  onClose: () => void;
}

export function HelpPanel({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
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
          <button type="button" className="btn" onClick={onClose} aria-label="Close help">
            Close
          </button>
        </header>

        <div className="help-body">
          <section>
            <h3>1. Start a conversation</h3>
            <p>
              Use the chat in the center column to describe the behavior or extension you want
              to create. Start a new conversation from the sidebar when you want a fresh thread.
            </p>
          </section>

          <section>
            <h3>2. Describe what you want</h3>
            <p>Write a short request in plain language. For example:</p>
            <blockquote>
              When a player joins the server, send them a welcome message.
            </blockquote>
            <p>
              The assistant can ask clarifying questions or discuss the requested behavior before
              proposing a script.
            </p>
          </section>

          <section>
            <h3>3. Review the proposed script</h3>
            <p>
              Script proposals can appear in the chat and in the Scripts list (sidebar). Each
              script can have multiple versions. You can save a proposal as a draft and inspect
              it in the right-hand panel.
            </p>
            <p className="help-note">
              Parts of this development build still use mocked chat scenarios or mocked execution
              depending on configuration.
            </p>
          </section>

          <section>
            <h3>4. Execution</h3>
            <p>
              From the inspector you can run a selected script. With{" "}
              <code>EXECUTION_PROVIDER=docker</code> the stored source runs in a fresh restricted
              Docker/Deno container (initial prototype). With <code>mock</code>, only the pipeline
              is simulated. Status terms mean:
            </p>
            <dl className="help-dl">
              <div>
                <dt>Queued</dt>
                <dd>The execution request has been received.</dd>
              </div>
              <div>
                <dt>Validating</dt>
                <dd>The platform is checking the request/script.</dd>
              </div>
              <div>
                <dt>Analysing</dt>
                <dd>Security/risk analysis is being prepared or performed.</dd>
              </div>
              <div>
                <dt>Running</dt>
                <dd>The execution environment is processing the script.</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>The execution ended normally.</dd>
              </div>
              <div>
                <dt>Blocked</dt>
                <dd>A security or policy rule prevented execution.</dd>
              </div>
              <div>
                <dt>Failed</dt>
                <dd>The execution could not complete because of an error.</dd>
              </div>
              <div>
                <dt>Terminated</dt>
                <dd>The execution was deliberately stopped.</dd>
              </div>
            </dl>
            <p className="help-note">
              The final sandbox is not claimed to be complete in this prototype — the pipeline may
              still be simulated.
            </p>
          </section>

          <section>
            <h3>5. Security information</h3>
            <dl className="help-dl">
              <div>
                <dt>Permissions</dt>
                <dd>What capabilities a script is allowed to use.</dd>
              </div>
              <div>
                <dt>Security event</dt>
                <dd>A recorded security-relevant action or decision.</dd>
              </div>
              <div>
                <dt>Risk assessment</dt>
                <dd>
                  An advisory classification of observed behavior. It does not itself grant
                  permissions.
                </dd>
              </div>
              <div>
                <dt>Telemetry</dt>
                <dd>Logs, metrics and traces used to observe an execution.</dd>
              </div>
              <div>
                <dt>Host application</dt>
                <dd>
                  The external application controlled through the restricted bridge. For this PoC
                  that may be a local Paper/Minecraft server.
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3>6. Project Settings</h3>
            <p>
              The <strong>Project Settings</strong> tab (right panel) controls the environment the
              AI assumes when helping create scripts. Changing Minecraft version or preferred
              language affects the <em>next</em> AI response after the setting shows Saved —
              no app restart required.
            </p>
            <ul>
              <li>Changes save automatically and are project-specific overrides.</li>
              <li>Dynamic server state (connected, players) is observed separately from settings.</li>
              <li>Unsupported combinations (e.g. Bedrock + Paper) show validation warnings.</li>
              <li>
                Security toggles describe configured policy intent; sandbox enforcement may still
                be mocked in this prototype.
              </li>
            </ul>
          </section>

          <section>
            <h3>7. Current prototype status</h3>
            <p>
              Some execution and security functionality may currently be simulated while the
              technical research implementation is being developed. Treat advisory risk scores and
              mock runs as demonstration of the workbench flow, not as a finished security
              guarantee.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
