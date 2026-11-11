# Capability Workbench repair result

COMPLETE WITH LIMITATIONS

# 1. CodeMirror diagnosis

The deployed active ScriptEditor rendered a native textarea; a real CodeMirror view was not implemented on that path. DOM and bundle evidence preceded changes. See root-cause.md and editor-before.json.

# 2. CodeMirror final state

Active Workbench editor: CodeMirror 6

The rebuilt deployed bundle mounts EditorView with a line gutter and TypeScript colors; source DOM is DIV, zero source textareas. Actual browser search, undo/redo, matching brackets, indentation, active line, long-source scrolling and light/dark colors were verified. See codemirror-verification.md, editor-after.json, long-source-browser.json and codemirror-search.png.

# 3. Capability-run error diagnosis

Exact raw toast reproduced: a reviewed manifest version selected fixed host-chat; backend correctly rejected it. Missing frontend preflight exposed String(ApiError). Local review gating plus fresh App manifest preflight now prevents that accidental submission.

# 4. Fixed profile semantics

none: no extra grants. read-fixture: predefined fixture read only. env-demo: demo value only. host-chat: historical fixed chat authority. Per-script permissions: version-reviewed authority through SDK/Gateway transport; internal host-capabilities unchanged. See profile-semantics.md.

# 5. Permission-review workflow

States/counts/constraints and Review appear near Run. All decisions begin unchecked. Explicit saved review visibly selects Per-script permissions, never auto-runs, and later manual choices are respected. Dirty source requires Save/new review. Partial denial remains visible and enforceable.

# 6. Run-button behavior

Unreviewed host manifests open review without POST. Loading/errors/dirty or running states explain why Run is unavailable. Approved compatible versions require a separate click. Partial approval allows deliberate execution. A second manifest fetch handles stale frontend state; invalid mode offers a compatible-mode action without executing.

# 7. Error/toast behavior

Known backend workflow errors map to review/outdated guidance and actions. The reproduced fixed-mode mistake now displays Choose a compatible execution mode; execution count does not increase. No ordinary select-host-capabilities instruction or ApiError prefix is required.

# 8. Gemini advanced-script flow

Real Gemini generated a four-capability proposal saved unreviewed. The deployed UI displayed Review required, then approved mode after explicit harness review; separate UI Run completed. Paper confirmed status, broadcast and three spawns. GoldennBullet was offline, so the private-message failure is retained.

# 9. Legacy compatibility

Existing null-manifest fixed host-chat fixture completed with Paper confirmation. Historical versions were not migrated. Simple new script A used none without review.

# 10. Backend enforcement

Fail-closed API/Gateway checks unchanged. Three custom bypass attempts returned HTTP400 with zero execution records. D's denied spawn remained CAPABILITY_NOT_APPROVED while approved chat succeeded. Mode selection never creates authority.

# 11. Tests

Frontend: 146 passed / 0 failed / 0 skipped. API: 131 passed / 0 failed / 3 ignored (opt-in PostgreSQL). Gateway: 32 passed / 0 failed / 0 skipped. Frontend typecheck and production build/deployment passed. No SQL/query changes; no PostgreSQL rerun required. See tests.md and raw logs.

# 12. Live validation

A: console completed, none/no review. B: historical chat completed and confirmed. C: review gating/no invalid record, explicit approval and separate successful Run. D: partial approval warning and denied spawn enforced. E: custom requests rejected. F: real Gemini guided run completed with confirmed effects and the expected offline message failure. See live-validation.md.

# 13. Frozen research integrity

All 1633 pre-existing research-result files hashed against the pre-task baseline: zero changed or missing. No Jev/gVisor scientific reruns, frozen evidence/methodology edits or Phase 8 work. See frozen-integrity.json.

# 14. Files changed

See changed-files.md and changed-files.json (23 implementation/test/documentation files). Changes cover the active CM editor, Workbench permission gating, friendly profile/error guidance, Help and provider instruction wording; no SQL, runner, Gateway or Paper security implementation changed. New evidence is additive.

# 15. Remaining limitations

Private-message success cannot be claimed with GoldennBullet offline. Native macOS keys were not physically tested; CodeMirror platform bindings are configured. Syntax highlighting is not a TypeScript language server. Live review submission used the bounded API harness; final approval-button behavior is automated UI-tested, while browser checks opened/cancelled review and clicked Run separately. This local PoC's trusted-operator security model is unchanged.

# 16. Recommendation

Review the deployed Workbench and the supplied screenshots/report. No Phase 8. No commit or push performed.

READY FOR MANUAL REVIEW
