# Assistant restoration result
COMPLETE

# 1. Root cause
The ignored .env and deployed API explicitly selected CHAT_PROVIDER=mock while a Gemini credential and model remained configured. The UI accurately displayed the backend-selected provider. No real provider was removed or bypassed by the redesign. Phase5 evidence already records mock; Phase6's offline demo instructions reinforced that selection. Phase7.5 tested the offline/mock setup and missed restoring and validating normal real generation. The precise historical edit of ignored .env is not recoverable from Git; no attribution is invented. Factory defaults/unknown-provider fallback also silently selected mock, a separate configuration hazard now removed.

# 2. Previous behavior
Git HEAD, e910ff5 and 6b7016f retain Gemini (preferred) and optional OpenAI. Eight stored pre-restoration Gemini responses use gemini-3.8-flash, dated October28–November2. No historical successful OpenAI response is claimed. Original route POST /api/conversations/:id/messages -> fresh AssistantContextBuilder -> ChatProvider.respond -> stored assistant message -> Markdown/proposal rendering remains intact. Existing GEMINI_API_KEY/GEMINI_MODEL mechanism and model preserved; no new provider.

# 3. Fix
Restore only CHAT_PROVIDER=gemini in ignored .env; retain existing credential/model. Add configureChatProvider/UnavailableChatProvider; reject absent/unknown selection rather than silently substituting mock, and keep non-chat API available for missing credentials. Public configuration exposes controlled status/reason, never keys. Gemini uses x-goog-api-key header instead of query-string credentials and a bounded 60-second request. Google API authentication reference: https://ai.google.dev/api . Current context now explicitly describes all four trusted profiles and unsupported capabilities. Clarify offline instructions in README, DEMO-RUNBOOK and REPRODUCTION. Add provider/configuration/failure/wire and frontend tests.

# 4. Provider selection
Current: Gemini / gemini-3.8-flash, execution Docker, risk deterministic. Explicit mock remains clearly labeled and intentional. Missing/invalid configuration -> unavailable (no process-wide chat configuration exit). Real-provider request failure -> explicit 502, preserved user message and no fabricated assistant response; unavailable configuration -> 503. Factory missing-key validation remains controlled. No auto-selection of another provider/model and no mock fallback on upstream failure. Public configured status means configured, not an independent account/quota health probe.

# 5. UI
Assistant header derives provider/model from backend public config: Gemini/OpenAI/Mock/Unavailable. Unavailable configuration disables sending and explains configuration state while retaining editor/inspection. Runtime failures show explicit assistant-unavailable error and say no mock response was substituted. Existing historical replies are retained; they are not regenerated or relabeled as newly generated. Current header describes the selected provider, not the historical origin of every stored reply.

# 6. Context integrity
Fresh context continues to use current project settings, policy, observed host state and capability catalogue. host.chat.broadcast with import from host is the supported sandbox host method. Player-join/persistent callbacks, arbitrary commands, Paper APIs, and sandbox status/player queries remain unsupported. Added profile descriptions come directly from trusted profile metadata: none, read-fixture, env-demo, host-chat. Settings remain assistant intent, not grants; runtime authorization and limits unchanged. Config policy/catalogue/project-spec bytes unchanged. Live D/E confirm these distinctions.

# 7. Live assistant validation
Five fresh conversations; exact existing Gemini model and key; five calls, zero provider failures, zero retries. No prior private conversation/history transmitted for these checks. Full raw responses preserved separately; semantic review does not rewrite them.
| Case | Prompt | Result |
|---|---|---|
| A | Create a TypeScript script that calculates 21 * 2 and prints the result. | PASS: dynamic arithmetic code, none profile. |
| B | Create a script that prints Hello World in the console. | PASS: runnable code and correct none guidance. |
| C | Create a script that prints Hello World in the console and broadcasts it to the in-game chat. | PASS: correct host import/SDK and host-chat. |
| D | Create a script that reacts every time a player joins the server. | PASS: explains missing events.playerJoin/persistent callbacks; supported manual alternative labeled. |
| E | Which execution profiles are currently supported, what does each grant, and can assistant settings grant runtime permissions? | PASS: all four profiles accurate; settings cannot grant runtime permissions. |
Exact quoted prompts and complete responses are in assistant-A through assistant-E.json. No Jev experiment or gVisor benchmark rerun.

# 8. Generated-code execution
Browser saved model-generated A and C through the existing Save script as draft workflow, explicitly selected profiles and clicked Run. Executed versions match original model code blocks exactly. A printed Result:42 with none; C printed Hello World and queued one broadcast with host-chat. Both completed with complete evidence collection. C has a correlated completed sandbox_capability host command, secure_bridge success event and confirmed Host Activity broadcast. Delivery is inferred, not independently timestamped. A additionally saved version2 with an explicitly recorded harmless manual comment after the original version1 execution, proving versioning without altering the model response or original executed version. No automatic execution authority introduced.

# 9. Regression tests
Final API: 116 PASS, 0 FAIL, 2 SKIPPED (existing opt-in PostgreSQL history/activity tests; no queries changed). Final frontend: 45 PASS, 0 FAIL, 0 SKIPPED. Total automated invocations: 161 PASS, 0 FAIL, 2 SKIPPED. Provider API, context-builder, frontend Assistant and wider frontend tests included. Frontend typecheck, production tsc/Vite build, API/web Docker build/redeploy and Compose validation PASS. No shared/runner execution contracts changed, so affected runner suite condition not triggered. Early new-test typing errors were corrected before final passing API suite. No required live check unavailable.

# 10. Wider Phase 7.5 smoke regression
| Area | Result |
|---|---|
| Script create/read/update | PASS: generated drafts saved/opened; deletion still unsupported by existing API. |
| Versioning | PASS: A stored version1 retained, version2 saved. |
| Profiles | PASS: explicit none and host-chat selections reflected in results. |
| Execution/detail | PASS: generated sources ran; output, collection and host evidence inspected. |
| Insights | PASS: selected generated host execution appears with real duration, profile, advisory and collection. |
| Host Activity | PASS: Paper-confirmed Hello World appears under Chat. |
| Settings | PASS: changed existing overridden network-context intent false->true->false through UI autosave; exact original override document restored; no runtime grants changed. |
| Help | PASS: opens, current instructions visible, Escape closes. |
No additional functionality loss observed in this focused check. Existing generated Markdown drafts receive generic editable names; no naming redesign attempted. Historical mock replies remain stored history. This is a smoke check, not exhaustive validation of every future model answer.

# 11. Frozen research integrity
1258 pre-existing research files, including Phase7.5 evidence, unchanged against the before-fix baseline; zero changed/missing. Prior experiment/artifact seals independently match (Phase3 131, Phase4 439, Phase5 94, Phase6 95, Phase7 44, Phase7.5 72 entries). Config policy, project specification, capability catalogue, deterministic rules, reference labels and execution authorities unchanged. No earlier research result rewritten. Evidence is additive only in this manual-polish directory.

# 12. Files changed
- `apps/api/src/main.ts` — modified
- `apps/api/tests/config_test.ts` — modified
- `apps/api/src/project/assistant-context-builder.ts` — modified
- `apps/api/src/providers/chat.ts` — modified
- `apps/api/src/providers/gemini.ts` — modified
- `apps/api/src/routes/config.ts` — modified
- `apps/api/src/routes/conversations.ts` — modified
- `apps/web/src/App.test.tsx` — modified
- `apps/web/src/types.ts` — modified
- `apps/web/src/components/ChatPanel.tsx` — modified
- `docs/DEMO-RUNBOOK.md` — modified
- `docs/REPRODUCTION.md` — modified
- `compose.yaml` — modified
- `README.md` — modified
- `apps/api/tests/assistant_restoration_test.ts` — added
- `.env` — ignored local selection only; credentials not exported.
No commit/push. Earlier uncommitted work preserved. Credentials remain ignored/server-side; no actual credential values in evidence or frontend bundles.

# 13. Remaining limitations
Five successful real calls do not guarantee future availability or perfect model answers; provider/account/quota errors remain explicit. Existing mock conversation replies are preserved, and the current-provider header is not a per-message provenance label. No real upstream account failure was deliberately injected; failure/no-fallback paths are covered with test doubles. Existing hard deletion is unsupported; generic generated-draft naming remains editable. No new security functionality or automatic execution introduced.

# 14. Recommendation
Do not start Phase8. The normal real assistant is restored and validated; inspect the fresh Assistant restoration conversations in the UI for manual acceptance.

READY FOR MANUAL REVIEW
