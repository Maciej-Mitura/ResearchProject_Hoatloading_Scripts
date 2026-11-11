# Error UX polish result

COMPLETE

This manual polish also includes the requested execution-path redesign and the subsequent correction to put all profile descriptions inside the existing title info tooltip. See execution-path-report.md for the dedicated stepper report.

# 1. Screenshot failure diagnosis

Original execution 77786ad5-98c1-4651-8133-6f0086a8d5e5 imports the trusted host SDK but recorded profile none. Deno could not resolve host without the host-chat import map and exited 1 at main.ts:1:22. This is a script/profile compatibility failure. Deno's npm:host hint is not the project fix. LOW was the stored deterministic R010 result, not execution success. COMPLETE meant the final audit collection finished despite the import failure. All three statuses remain unchanged.

# 2. ANSI issue

Terminal-colored Deno strings were rendered directly in multiple browser sections. A shared displayOutput projection now normalizes stdout, stderr, parsing and excerpts using pinned ansi-regex 5.0.1 plus control/OSC cleanup. Raw database values remain unchanged.

# 3. Human-readable error UX

Before: repeated red raw terminal output and npm-install hint. After: one Host SDK unavailable card explains the none profile, source location and explicit host-chat/Run action. Original diagnostics move into a quiet, collapsed Technical error details section. Normalized copy is available.

# 4. Error taxonomy

Known Host SDK mismatch/setup, general import, permission, timeout, memory-limit, infrastructure, generic process failure and generic termination/blocked presentation classes. Actual failure category labels are humanized. Unknown causes remain generic with technical codes preserved; no LLM or classifier change.

# 5. Profile mismatch UX

A known host resolution error with none/read-fixture/env-demo recommends host-chat. With recorded host-chat it instead says Host SDK setup/runtime failure and recommends inspecting SDK/import-map/runtime setup. Missing profile does not trigger a guessed correction. Stdout alone never supplies the diagnosis.

# 6. Pre-run guidance

Clear static host imports trigger a nonblocking warning for other profiles. The explicit Use host-chat profile action changes only the visible selection, never source/settings or automatic execution. Run stays available for intentional negative tests. Assistant host-code proposals receive a deterministic client reminder, without changing provider prompts or grants.

All option help now lives in the existing Execution profile info tooltip; the collapsible Profile guide has been removed as requested.

# 7. STDERR presentation

Collapsed technical output is ANSI-free, monospaced, whitespace-preserving, wrapping and copyable. It includes exit code, raw category code, recorded profile, source URI and line/column. Deno's original hint remains there as tool output, explicitly separate from application advice. Exact raw values remain in a nested escaped JSON disclosure.

# 8. Why-this-result improvements

Metadata now shows the human reason, recorded/suggested profile, exit code, times, deadline, OOM, truncation and cleanup. The primary card supplies the cause and next action. Full errorMessage is no longer repeated in diagnostics and a competing red Output banner. Derived timeline diagnoses are labelled as process-output reconstruction, not newly observed runtime events.

# 9. Status independence

Failed describes process outcome. Complete describes collection finishing normally, not success or exhaustive visibility. LOW/R010 means no predefined high-risk indicators were observed in the available structured model, not successful execution. Tooltip and failure copy explain this explicitly. The new stepper displays this combination as ✓ Request, ✓ Process, × Result, ✓ Evidence, ✓ Assessment.

# 10. Paired host-profile regression

Same source and SAME saved version: none -> failed/exit 1/780 ms/complete/LOW; host-chat -> completed/879 ms/complete/LOW plus one successful correlated Paper broadcast. Correction did not auto-run: exactly two explicit executions exist. No false SDK-unavailable diagnosis under the successful profile.

# 11. Generic failure regression

Controlled throw -> failed/exit 1/584 ms, generic Script execution failed, parsed source location, normalized stderr and no Host SDK suggestion. Normal console script completed in 542 ms. Bounded progress run showed running at 0.8 s and automatically completed at stored 5,338 ms.

# 12. Historical compatibility

The original ANSI-containing failure was reopened and normalized at render time. The entire stored execution record remained equal, with ANSI still retained. Old missing fields/locations use truthful fallbacks. Existing timeout still shows Terminated/Unavailable/HIGH with its actual 10 s deadline.

# 13. Tests

Frontend: **107 passed, 0 failed, 0 skipped**, six files. Typecheck, production build, redeployment and whitespace check passed. API/provider code and contracts were unchanged, so their suites were not repeated. No Jev/gVisor experiment rerun. Details and development corrections are recorded in regression-tests.md and test logs.

# 14. Wider smoke regression

Verified Gemini provider/header/existing response and host-profile reminder; script create/read/rename/save/version retention/disable/restore; profiles, normal/progress/detail, Insights, Host Activity, Settings preview and Help. A pre-existing late savedVersion response race found during smoke now has a narrow selected-script guard, deferred-response regression and live New script check. Effective settings and overrides unchanged. No new paid model call.

# 15. Frozen research integrity

All **1,363 pre-existing research files unchanged**, none missing. Prior seals/manifests verify 978 entries, including the previous manual execution-UX package. Runtime, security, classifier, evidence policy and API/provider source remained unchanged.

# 16. Files changed

15 frontend/package files (13 source/test/style files plus package manifest/lock). Full list and hashes: changed-files.md / integrity-and-scope.json. Additive evidence only under this timestamped error-ux directory. No commit or push.

# 17. Remaining limitations

The source check intentionally covers clear static imports, not general validity, arbitrary dynamic imports or all module-resolution forms. Unknown runtime errors retain technical evidence and generic guidance. Host-chat setup/analysis failure and memory/infrastructure presentations use fixtures rather than deliberately damaging deployed services. No new Gemini generation or formal screen-reader certification was performed.

# 18. Recommendation

Review the paired none failure, its technical output and the consolidated profile tooltip. Both requested manual polishes are complete. Do NOT start Phase 8.

READY FOR MANUAL REVIEW
