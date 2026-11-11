# Profile compatibility and consolidated information

The Workbench recognizes clear static imports from the exact host specifier, including side-effect and multiline imports. It skips comments, quoted examples/templates and dynamic import/import.meta. This intentionally is not a general parser, permission analyzer or validity/safety check.

A mismatch produces a nonblocking warning near Run. Run remains possible. Use host-chat profile only updates the controlled visible profile selection. It never runs, edits source, saves project settings, creates permanent grants or bypasses enforcement. The real paired regression has exactly two executions, both of the same source version, and effective settings/overrides are unchanged.

The additional user correction is implemented: **no collapsible Profile guide exists**. All four scopes are inside the existing circle-i beside Execution profile. Its final desktop content fits without internal scrolling (clientHeight=scrollHeight=356).

Exact option descriptions:

- none: No filesystem, environment, network, subprocess, FFI or host capability grants.
- read-fixture: Read access to predefined /fixtures data only.
- env-demo: Access to the predefined SANDBOX_DEMO_VALUE environment variable only.
- host-chat: Restricted Host SDK/Gateway for chat.broadcast; no general host access. Required for scripts importing "host".

Intro: Deno/Docker grants for this run. Assistant settings do not grant permissions. Footer: These scoped grants are not a general security guarantee. Existing per-option provider metadata remains the editor's selected-profile footer. Descriptions were checked against the existing runner permissions/contracts/entrypoint, which are unchanged.

Assistant host-code proposals also get deterministic client guidance to run with host-chat, without changing stored messages, provider prompts or profile state. The existing real Gemini restoration C response already mentioned the profile; it now also shows this client reminder. No new paid model request was made.
