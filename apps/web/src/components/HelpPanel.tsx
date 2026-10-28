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
          <section><h3>1. Start a conversation</h3>
            <p>Click New under Conversations. Messages are saved automatically; there is no separate Save chat step. Selecting a conversation also selects its newest linked script and latest execution.</p>
          </section>
          <section><h3>2. Describe what you want</h3>
            <p>Ask for a JavaScript or TypeScript script, for example: Create a script that prints test hello and 2 + 2.</p>
            <p>Use top-level code, or call any function you define. Exporting a function alone does not execute it. Gemini/OpenAI generate replies; Mock only provides fixed demonstrations.</p>
          </section>
          <section><h3>3. Review the proposed script</h3>
            <p>Click Save script as draft beneath an assistant proposal or JavaScript/TypeScript code block. This also works in older conversations. Review each block before saving; save a complete runnable script rather than a partial example.</p>
            <p>The saved draft appears at the top of Scripts / extensions and opens in the Inspector. Selecting a saved script opens its linked conversation. Execution history is newest first and selecting a run opens its script and conversation.</p>
          </section>
          <section><h3>4. Choose permissions and Run</h3>
            <dl className="help-dl">
              <div><dt>No permissions</dt><dd>For console logging, calculations, and text processing. No explicit filesystem, network, environment, subprocess or FFI grants.</dd></div>
              <div><dt>Read test fixture</dt><dd>Read /fixtures/allowed.txt inside the sandbox. This does not allow reading your computer or Minecraft files.</dd></div>
              <div><dt>Demo environment variable</dt><dd>Read SANDBOX_DEMO_VALUE only; its demo value is hello-from-supervisor.</dd></div>
              <div><dt>Chat broadcast</dt><dd>Use import &#123; host &#125; from &quot;host&quot; and await host.chat.broadcast(&quot;Hello&quot;). Default budget: five calls per execution, 256 characters per message.</dd></div>
            </dl>
            <p>Run executes the stored source once in a fresh Docker/Deno sandbox when the provider is Docker/Deno. Mock simulates execution. This does not install a persistent Paper plugin or subscribe to player events.</p>
            <dl className="help-dl">
              <div><dt>Queued</dt><dd>Request received.</dd></div>
              <div><dt>Validating</dt><dd>Checking the script and request.</dd></div>
              <div><dt>Running</dt><dd>Executing the source.</dd></div>
              <div><dt>Analysing</dt><dd>Assessing recorded execution evidence afterward.</dd></div>
              <div><dt>Completed</dt><dd>Process exited successfully. Inspect STDOUT and host activity.</dd></div>
              <div><dt>Failed</dt><dd>Inspect STDERR, exit code, and failure category. A permission denial can be an expected test result.</dd></div>
              <div><dt>Terminated</dt><dd>Execution hit the configured timeout.</dd></div>
              <div><dt>Blocked</dt><dd>Reserved policy status; advisory risk classification does not block execution.</dd></div>
            </dl>
          </section>
          <section><h3>5. Risk assessment and evidence</h3>
            <p>Security and the Inspector follow the selected execution. LOW / REVIEW / HIGH describe observed behavior, not whether a script is safe or malicious. Jev never grants permissions. Jev unavailable means classification failed; execution can still succeed.</p>
            <p>The timeline is reconstructed from PostgreSQL records. Advanced details show execution and trace IDs. OpenTelemetry exports correlated traces separately.</p>
          </section>
          <section><h3>6. Project Settings and Server Info</h3>
            <p>These tabs apply to the entire project, not individual chats. Settings save automatically and affect the next assistant turn, with no app restart required. They do not reconfigure the running Minecraft server or replace the execution permission picker.</p>
            <p>Server Info displays live Paper status and events. Queue broadcast sends a separate predefined test message through the bridge; it does not run the selected script. A sandbox broadcast accepted by the gateway is queued; verify Minecraft delivery separately.</p>
          </section>
          <section><h3>7. Current prototype status</h3>
            <p>Chat, execution, and risk providers are configured separately. Real execution requires EXECUTION_PROVIDER=docker; Jev requires RISK_ANALYZER=jev and working provider access. Host event subscriptions are not implemented; gVisor requires a prepared Linux host. Older scripts without a recoverable conversation link open without a chat.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
