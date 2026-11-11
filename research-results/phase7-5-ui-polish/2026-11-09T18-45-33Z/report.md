# Phase 7.5 result
COMPLETE WITH LIMITATIONS

# Executive summary
- Replaced three competing columns with an editor-centered Workbench and optional assistant.
- Added first-class, real-database Execution Insights using a minimal read-only query.
- Unified execution outcome, collection, advisory result, runtime and host evidence presentation.
- Added neutral/indigo light and dark themes, responsive layouts and keyboard controls.
- Automated tests: 150 passed, 0 failed; 2 local DB skips separately passed deployed.
- All five live runc smoke cases passed; host broadcast Paper-confirmed.
- 1185 frozen research files match the before-implementation baseline.
- Phase8 not started; no experiments, security policy or shared contracts changed.

# 1. UX audit
Chat dominated the center, source was hidden, inspector tabs mixed global context with selected execution, risk/evidence duplicated and identifiers received too much emphasis. Green identity and appended CSS overrides weakened hierarchy. See before-inventory.md, created before implementation.

# 2. Information architecture
Old: conversations / chat / multipurpose Inspector (Security, Settings, Server Info). New: #workbench, #insights, #host, #settings. Script library contextual; assistant optional. Detail shared between Workbench and Insights, global settings/host separated from selected execution.

# 3. Visual design system
Cool-gray/slate/white + indigo/blue; semantic green/amber/red only. System sans with monospace source; 4/8/12/16/24/32/48 spacing, bordered surfaces, two radii, restrained shadows. Shared badges combine glyph/text/tone. Persistent light/dark theme; reduced motion and forced colors. See design-system.md.

# 4. Workbench redesign
Script identity and stored version precede language/profile/save/Run. Large editable source is central. Save versions explicitly; unsaved edits disable Run. In-memory drafts survive navigation, with StrictMode regression. Existing conversations/proposals remain optional. Availability and old versions disclosed separately. No hard-delete endpoint exists in the validated API; supported disable/archive metadata behavior retained.

# 5. Execution detail redesign
Outcome, measured duration, recorded profile, advisory and collection first. Actual/inferred/not-recorded execution path next. Output/Evidence/Runtime/Timeline progressively disclose stdout/stderr, observations, configured resources, exit/failure metadata and reconstructed records. IDs copyable under technical details. Advisory failure does not imply execution failure.

# 6. Insights tab
#insights uses GET /api/executions/history plus existing selected-detail/security/risk routes. Latest100 per-script rows, explicit total/window, date and provider filters. Four cards, three primary charts, one history table and a shared selected-run detail. No frozen JSON inputs. Selection loads its execution-linked risk assessment.

# 7. Visualization inventory
| Chart | Purpose / source | Aggregation | Caveat |
|---|---|---|---|
| Outcomes | Stored execution reliability/status | Actual status counts | Intentional timeout still terminated. |
| Advisory | Linked risk classification/status | Class and failure counts | Advisory, not maliciousness. |
| Duration | Stored lifecycle milliseconds | Chronological line + measured median | Null gaps; overhead included; mock simulated. |
| Permission categories | Selected native/stored observations | One count/proportion per category | No fabricated allowed/denied; collection caveat. |
Execution path uses observed/inferred/not-recorded stages. Conditional host path infers delivery only from a queued command's trusted successful acknowledgement. See insights-visualizations.md for exact contracts/tooltips/accessibility.

# 8. Panels removed / merged / moved
Removed widen-inspector mode, green identity, permanent assistant dominance and duplicate security summaries. Merged execution details; moved Server Info to Host Activity, settings to Settings, IDs to technical disclosure and fixed context metadata behind disclosures. Unrelated runs omit host diagram.

# 9. Settings redesign
Generation context, permission intent, project, host and bridge context grouped by meaning. Editable preferences precede fixed metadata. Preview/effective/reset secondary. Clear text separates assistant context from runtime grants. Autosave coalesces rapid edits, serializes writes and flushes on navigation; reset remains confirmed. No backend settings behavior changed.

# 10. Responsive/accessibility
Desktop and tablet browser review, wrapping navigation/stats/controls and resizing charts. Native editor keyboard, labeled forms, skip link, roving execution tabs, focus-visible outlines, focus-managed help and text alternatives to chart colors. No formal screen-reader certification or full WCAG claim. See accessibility-review.md, responsive-review.md and visual-review.json.

# 11. Data integrity
No fabricated metric or composite security score. Current DB only; missing metadata Not recorded, historical missing collection legacy_unknown, failed/unavailable advisory distinct, durations never invented from missing values. Complete collection does not prove exhaustive detection; grants are configured controls, not attack-prevention proof. PostgreSQL records do not independently prove collector receipt.

# 12. Functional regression
| Area | Result |
|---|---|
| Script create/read/update/version/disable | PASS; hard deletion unsupported in existing API |
| Execution and output | PASS |
| Permission profiles | PASS |
| Evidence/collection | PASS |
| Advisory risk/deterministic mapping | PASS |
| Host chat | PASS |
| Paper confirmation/activity | PASS |
| Settings reads/autosave/context distinction | PASS |
Existing authentication/local user flow, migrations, runner and shared contracts unchanged. Jev-compatible evidence/policy preserved byte-for-byte; no new paid classification.

# 13. Tests
Final final automated test-case invocations: PASS 150; FAIL 0; SKIPPED 2; UNAVAILABLE 0. API 107, frontend 41, deployed PostgreSQL 2. The 2 locally ignored DB tests passed in deployed runs. Typecheck, production build, API/web image build/deploy and Compose validation PASS. Conditional runner/shared/Docker suites not triggered. See tests.md and machine-readable logs.

# 14. Live smoke validation
| Case | Scenario | Profile | Result |
|---|---|---|---|
| A | Normal | none | PASS |
| B | Caught restricted read | none | PASS |
| C | Allowed fixture | read-fixture | PASS |
| D | Environment demo | env-demo | PASS |
| E | Host chat + Paper confirmation | host-chat | PASS |
Browser validation additionally created/saved two TypeScript versions and ran both successfully; unsaved Run, historical selection, keyboard tabs/help and copyable IDs were checked. All five smoke cases completed with complete collection and clean cleanup; B recorded permission observation and REVIEW despite successful process completion. Runtime independently inspected as runc. E had correlated completed host command and successful Paper acknowledgement. Original helper capture order used C=host, D=fixture, E=env; live-A-E-summary.json maps requested order to unchanged capture IDs. Browser workflow checks recorded separately.

# 15. Frozen research integrity
1185 pre-existing Phase1–7 research files hash-match before-fingerprints.json; zero changed/missing. Frozen experiment manifests additionally checked where present. No policy/reference/deterministic/scenario/source-contract change outside the authorized UI/read-only history support. Prior dirty Git changes belong to earlier phases.

# 16. Files changed
- `apps/api/src/repositories/execution-history.ts`
- `apps/api/src/routes/executions.ts`
- `apps/api/tests/execution_history_db_test.ts`
- `apps/api/tests/execution_history_test.ts`
- `apps/web/package-lock.json`
- `apps/web/package.json`
- `apps/web/src/App.test.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/api/client.ts`
- `apps/web/src/components/ChatPanel.tsx`
- `apps/web/src/components/ExecutionDetail.tsx`
- `apps/web/src/components/ExecutionInsights.tsx`
- `apps/web/src/components/HelpPanel.tsx`
- `apps/web/src/components/Inspector.tsx`
- `apps/web/src/components/ProjectSettingsPanel.tsx`
- `apps/web/src/components/ScriptEditor.tsx`
- `apps/web/src/components/ServerInfoPanel.tsx`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/StatusBadge.tsx`
- `apps/web/src/insights.test.tsx`
- `apps/web/src/insights.ts`
- `apps/web/src/inspector.test.tsx`
- `apps/web/src/styles/app.css`
- `apps/web/src/types.ts`
- `apps/web/src/workbench.test.tsx`
Additive package files listed in result-artifact-hashes.json. See changed-files.md for before-baseline provenance.

# 17. Final visible panel inventory
Global navigation/service/theme/help; contextual script library/conversations/latest runs; source/profile/save/Run; version availability; shared summary/path/output/evidence/runtime/timeline/advisory; Insights filters/scope/four stats/three charts/history/shared detail; Host Activity status/log/filter; Settings editable categories/metadata disclosures/preview/effective/reset. Each panel's purpose and KEEP/MOVE/MERGE decision appears in final-screen-inventory.md.

# 18. Remaining UI limitations
Latest100 history window, client window filters, existing first100 security-event view and native textarea rather than full IDE; in-memory drafts do not survive full reload. Mobile is usable, not a full mobile IDE. No hard deletion in existing API. No formal accessibility certification. Six development-toolchain dependency findings remain; production dependency audit zero. Normal runtime is runc; no gVisor-default or escape-prevention claim. Late host acknowledgement refreshes selected evidence via polling, not an independent delivery timestamp. The existing security-event endpoint returns its first100 matching rows; long-event runs may omit later records from that view.

# 19. Scope discipline
No new security or research functionality, metrics, mutation endpoint, classifier, permissions, experiments or schema migrations. Minimal read-only history query only; existing mutation APIs reused by presentation. Phase1–7 frozen evidence unchanged. No commit/push or Phase8 work.

# 20. Recommendation
Required implementation and validation complete with explicit limitations. Package is ready for the next authorized packaging phase; do not infer that Phase8 has begun.

READY FOR PHASE 8
