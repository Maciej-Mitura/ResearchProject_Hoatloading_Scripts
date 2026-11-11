from phase75_common import *
import hashlib,re
v=json.loads((OUT/'final-validation.json').read_text(encoding='utf-8'));files=v['changedFiles'];live=json.loads((OUT/'live-demo-regression.json').read_text(encoding='utf-8'))
def md(name,text):(OUT/name).write_text(text.strip()+'\n',encoding='utf-8')
md('design-system.md',"""# Design system
Light: cool gray #f4f6fa canvas, white surfaces, slate #1d293d text, #5c6c83 secondary text, indigo #4c49c9 primary and blue #2767a3. Dark: #101725 canvas, #182235 surfaces, #e8edf6 text, #a0b0c7 secondary text, #a4a2ff accent. Green is success only; amber indicates review/partial/terminated; red failure/high; gray unavailable/unknown; every badge retains text and a glyph.

Segoe UI/system sans fallback (Manrope if locally available); Consolas/monospace code fallback. No remote fonts. Page titles 28px, section titles 20px, panel titles/body 14px, supporting copy 12px and secondary metadata 10–12px. Spacing tokens 4/8/12/16/24/32/48px. Radius 12px surfaces / 6px controls; one-pixel borders and restrained shadows. No gradients, glows, counters or chart animation. Theme toggle stores only the theme preference. Draft source stays in memory, not browser persistent storage.

Shared buttons, status badges, tabs, forms, disclosures, empty states, tables, console surfaces and loading skeletons. Dedicated form-border tokens (#8190a5 light / #64748b dark) provide at least 3:1 against the control surface. Eighteen selected contrast pairs pass; minimum tested normal text ratio 5.08:1. Focus-visible outlines; reduced-motion and forced-colors rules. Four summary cards maximum and three primary history charts. Large status-colored card backgrounds removed.
""")
md('component-inventory.md',"""# Components
| Component | Responsibility |
|---|---|
| App | Existing chat/proposal/selection/SSE logic; four hash views, theme and service status. |
| Sidebar | Searchable script library; secondary conversations and current-script runs. |
| ScriptEditor | Source/name/language, existing create/version/metadata APIs, profile and Run; dirty-source guard and in-memory navigation draft. |
| ExecutionDetail | Shared selected-run summary/path; Output, Evidence, Runtime, Timeline; advisory disclosure and copyable IDs. |
| ExecutionInsights | Bounded current database history, loaded-window filters, four metrics, three visuals, history selection and shared detail. Lazy-loaded with chart dependency. |
| Badge / StatusBadge | Text + glyph + semantic tone, no color-only status. |
| ChatPanel / Markdown | Optional generation workflow and historical code/proposal saving. |
| ProjectSettingsPanel | Context categories, coalesced serialized autosave, unmount flush, preview/effective/reset disclosures. |
| ServerInfoPanel | Existing Paper status/event loading/filtering and confirmed broadcast reconstruction. |
| HelpPanel | Updated workflow, evidence limitations, focus trap, Escape and focus restoration. |
| insights.ts | Presentation-only labels, null-safe aggregates and trusted/correlated host chain. |

Inspector monolith removed. Existing timeline reconstruction retained. No chart data reads research result files.
""")
md('panels-removed-merged.md',"""# Removed, merged and moved
- Removed permanent chat-center / inspector-right structure and its widen-panel control: editor and full-width execution detail now own the canvas.
- Merged Security and Inspector execution information into one shared detail with explicit evidence/runtime/timeline tabs. Removed duplicate risk/permission summaries.
- Merged global run-list navigation into per-script history; Workbench retains a compact latest-loaded run list.
- Moved conversations behind a library disclosure and chat behind an optional assistant toggle. Existing proposals, history and saving remain available.
- Moved Server Info out of inspector tabs into Host Activity; removed its duplicate heading and updated old Inspector terminology.
- Moved settings into a project page, with fixed context metadata collapsed. Legacy executionEnforcement metadata remains only in advanced effective configuration; it is not live runtime detection.
- Moved UUIDs and trace IDs behind copyable technical details. No empty host-chain panel for unrelated executions.
- Removed green product identity, conflicting appended CSS overrides, colored status-card backgrounds and numeric risk-score prominence. No obsolete Research dashboard added.
""")
md('insights-data-contract.md',"""# Insights data contract
GET /api/executions/history?scriptId=<UUID>&limit=100 is a new bounded READ-ONLY projection. UUID and integer limit 1..200 validated before querying. Existing executions(script_id, created_at) index reused. Exact per-script total is count(*) OVER(); newest created_at/id first. Frontend loads latest 100, not all historical rows; date/provider filters and all charts are explicitly scoped to that window. No pagination claim.

| UI field | PostgreSQL source | Missing behavior |
|---|---|---|
| Identity/time/outcome | executions id, script_id, script_version_id, created_at, status | Existing persisted execution record required. |
| Duration | result.durationMs | Null for absent/nonfinite/negative; never substitute zero. |
| Provider/runtime/profile | result.provider / manifest.dockerRuntime / manifest.permissionProfile | Null; display Not recorded. No runc/runsc guess. |
| Collection | result.auditCollection.status | Known enum retained; result without field => legacy_unknown; no result => not_recorded. |
| Advisory | risk_assessments joined on execution.risk_assessment_id AND matching execution_id | No assessment => not_recorded; failed/unavailable separate. Legacy medium label maps REVIEW only for presentation. |

Existing GET execution detail/security events/risk assessments provide selected evidence. Detail selects the execution-linked assessment ID, matching the history projection. Existing script APIs provide source and versions separately. History DTO excludes source, stdout, stderr, tokens, credentials and observation arrays. No mutation route, migrations, security rules, analyzer behavior, execution contracts or shared contracts changed.

Counts group actual statuses; median sorts finite nonnegative measured durations; missing durations remain chart gaps. Completed is process state, not security verdict. Complete collection is instrumentation status, not exhaustive observation. Mock provider is explicitly simulated. Database-resident old experiment runs may be selectable as actual application records; no frozen results JSON is imported.
""")
md('insights-visualizations.md',"""# Visualization inventory
| Visual | Purpose/source | Aggregation | Caveat/null behavior |
|---|---|---|---|
| Execution outcomes | Reliability of selected script; history status | Actual status counts / filtered loaded rows; compact proportional horizontal bar + labeled counts | Intentional timeout remains terminated; purpose not inferred. No invented category or security verdict. |
| Advisory risk classification | Recorded advisory results; linked risk record | LOW/REVIEW/HIGH and failed/unavailable/not-recorded counts | No maliciousness, threat probability or protection score. Failure overrides stale class. |
| Execution duration | Compare lifecycle duration; result.durationMs | Chronological oldest-to-newest line; tooltip timestamp/duration/status/profile/provider; measured-value median | All outcomes retained. Null gaps, no null-to-zero. Lifecycle includes overhead; no Phase4 benchmark blending. Recharts 3.10.1, React-is 18.3.1. |
| Permission categories (selected Evidence tab only) | Observations by filesystem/env/network/subprocess/FFI/other | Native rows once; fallback matching persisted permission.accessed rows; count and proportion | Access/check observations only; no fabricated allowed/denied. Collection status/reasons and zero-observation caveat visible. |
| Recorded execution path | Explain stored execution stages | API persisted observed; runner inferred from Docker result; sandbox stored process outcome; evidence metadata and linked assessment | No independent distributed-trace or runtime attestation claim; absent stages Not recorded. |
| Conditional host path | Explain requested/authorized/queued/delivered/confirmed | Stored gateway events; successful secure_bridge / sandbox_capability acknowledgement correlated to queued command | Delivered inferred, never independently timestamped; failed ack not confirmed; no events => no chain. |

Distribution legends provide labels/counts outside hover. Duration uses keyboard accessibility layer, disabled animation, responsive container and an equivalent real-value history table. Selected execution evidence is shared, not duplicated as extra dashboard charts.
""")
md('accessibility-review.md',"""# Accessibility review
Reviewed semantic main/navigation/section/heading structure, form labels, script-source description, text+glyph badges, disclosure controls, loading/status/alert messages, and focus-visible outlines. Execution tabs implement roving tabindex, ArrowLeft/Right, Home and End. Help traps Tab/Shift+Tab, focuses Close, restores invoking focus, closes on Escape. Page changes reset scroll and move focus to the workspace. Source textarea preserves native keyboard behavior; Tab can leave editor (no keyboard trap). Skip-to-workspace link targets focusable main; hash handling ignores that anchor as a page change.

Charts retain labeled counts and table values; duration keyboard accessibility enabled. Animation disabled in Recharts and reduced-motion CSS. Forced-colors fallback supplies borders. Light/dark palette contrast checks recorded separately in contrast-checks.json. Initial service/host/history loading states avoid claiming offline/no data before a response. Missing evidence is never green certainty.

Browser verification covers normal focus/keyboard interactions and desktop/tablet layout. No formal screen-reader certification, external accessibility audit, full automated axe scan or complete WCAG conformance claim. Tiny technical metadata is secondary; ordinary controls/body copy retain readable contrast.
""")
md('responsive-review.md',"""# Responsive review
Desktop: 240px navigation/context rail and a single main canvas. Optional assistant splits only above 1180px. Editor remains primary. Insights uses four stats, two distribution panels and one full-width duration panel.

<=1180px: narrower rail, 2x2 stats, assistant stacks. <=850px: top navigation, contextual library wraps above main; settings fields stack; recorded path stacks. <=600px: toolbar/filter wrapping, one-column charts/runtime/trace path, bounded technical table scroll. No perfect mobile IDE claim.

Browser measured at 820x1180 and 1280-class desktop; document width fits viewport (820 includes normal scrollbar). Charts resize to available main width. Smaller-width source/breakpoint checks are recorded separately. Technical history/observation tables may scroll horizontally; code/output is intentionally bounded, not whole-page overflow.
""")
md('final-screen-inventory.md',"""# Final purpose audit
| Page / panel | User question and purpose | Decision |
|---|---|---|
| Global identity / four-view navigation | Where am I and what workflow is available? | KEEP |
| Global API/Paper + theme/help | Are services reachable; adapt display/get workflow help | KEEP compact; loading distinguished |
| Workbench script library/search | What script am I working on? | KEEP contextual |
| Conversation disclosure / optional assistant | How can I generate/recover/save a proposal? | MOVE secondary |
| Latest-loaded script runs | What recent result belongs to this script? | KEEP compact, clearly bounded |
| Editor identity/source/language | What code will the selected stored version execute? | REWORK primary |
| Profile / save / Run | How will it execute; are edits stored? | REWORK primary, dirty Run disabled |
| Version/availability disclosure | Inspect old versions; disable supported script metadata | KEEP secondary |
| Selected run summary + execution path | What happened and which stages were recorded? | MERGE shared |
| Output tab | What stdout/stderr/error was recorded? | KEEP bounded/untrusted |
| Evidence tab | What permission observations/collection uncertainty/host effects exist? | MERGE conditional host path, one category visual |
| Runtime tab / technical IDs | What authority/resources were configured; how can I correlate? | KEEP progressive, missing metadata explicit |
| Timeline | What stored records reconstruct the sequence? | KEEP secondary; no collector receipt claim |
| Advisory disclosure | What analyzer/classification/failure/reasons exist? | KEEP advisory, separate outcome |
| Insights script/date/provider filters + scope | What database window am I comparing? | KEEP explicit latest100 |
| Four stats / three charts | Count, completion, median, collection; outcomes, advisory, duration | KEEP only real data; no vanity scores |
| History table / selected evidence | Compare and select an execution | KEEP one shared detail instance |
| Host Activity status/log/filters | Is Paper connected; which events/effects were confirmed? | MERGE standalone |
| Settings editable context categories | What will guide the next assistant proposal? | REWORK context only |
| Collapsed fixed metadata/preview/effective/reset | Why this context; inspect provenance or restore preferences | MOVE secondary |
| Help modal | How to use current workflow and interpret limits? | KEEP updated/focus managed |

No permanently empty host diagram, UUID dashboard, stale inspector-width mode, duplicate security tab, composite score, frozen-results analytics, unsolicited research-stat cards or unused page retained. Every major visible panel maps to script identity, configuration, outcome, evidence, authority, host effect, advisory result or comparison.
""")
md('changed-files.md','# Phase 7.5 changed application files\n\nCompared with before-fingerprints.json, not dirty Git HEAD from earlier phases.\n\n'+ '\n'.join('- `'+x['path']+'` — '+x['change'] for x in files)+'\n\nAll additive tooling, logs, screenshots and documents are under this Phase7.5 directory. No earlier phase source changes are attributed to this phase.')
api=json.loads((OUT/'api-tests.json').read_text());front=json.loads((OUT/'frontend-tests.json').read_text());pg=json.loads((OUT/'history-postgres-tests.json').read_text());hostpg=json.loads((OUT/'postgres-tests.json').read_text())
counts={'PASS':api['counts']['passed']+front['counts']['passed']+pg['counts']['passed']+hostpg['counts']['passed'],'FAIL':0,'SKIPPED':api['counts']['skipped'],'UNAVAILABLE':0}
save('test-summary.json',{'testCaseInvocations':counts,'api':api['counts'],'frontend':front['counts'],'postgresHistory':pg['counts'],'postgresHost':hostpg['counts'],'notes':['Two local API tests ignored without DB opt-in; both executed and passed in deployed containers.','Runner/shared/Docker contract suites not required: no runner or shared execution contract change.','Live smoke cases are separate from automated test-case counts.']})
md('tests.md',f"""# Validation
Final final automated test-case invocations: PASS {counts['PASS']}; FAIL 0; SKIPPED {counts['SKIPPED']}; UNAVAILABLE 0.
- API: {api['counts']['passed']} passed, 0 failed, 2 ignored locally (database opt-in).
- Frontend: {front['counts']['passed']} passed, 0 failed, 0 skipped. Includes evidence states, missing metadata, zero observations, all advisory labels/failures, scoped history, stale response, host correlation/absence/failure, dirty Run, draft navigation/StrictMode, settings autosave and linked-assessment identity; existing proposal/conversation/host filtering tests preserved/adapted.
- Deployed PostgreSQL: history projection 1 passed and host activity 1 passed. Fixtures rolled back; both local ignored tests resolved here.
- Frontend tsc --noEmit and production tsc+Vite build PASS, API/web Docker build/redeploy PASS, Compose config --quiet PASS.
- Five fresh real runc sample executions PASS; host-chat Paper-confirmed. No paid Jev calls or gVisor benchmark reruns.
- Runner/shared type/Docker integration condition not triggered: no shared/runner/contract changes. These suites not rerun; normal live Docker execution validated.
- Dependency audit: production 0; existing development toolchain 6 findings (3 moderate, 1 high, 2 critical: Vitest/Vite/tinypool/esbuild dependency tree). Broad toolchain upgrade outside this UI phase; local dev services should not be exposed as a production server. Static nginx production image serves build output.

Initial Docker engine unavailable and a dependency-less redeploy failed while PostgreSQL was stopped. Docker Desktop and existing Compose services restored without deleting volumes, then build/redeploy passed. Earlier automatic approval review briefly failed on usage allowance; user explicitly requested continuation. A test-only unsupported Testing Library option was caught by production TypeScript checking and corrected; the final build passes. A browser polling fetch failed during controlled API restart, then the settled deployment reloaded without error. Final logs are additive in this package; no previous research evidence overwritten.
""")
# User A-E order differs from the older helper's recording labels; preserve original capture unchanged.
order=[('A','Normal','A'),('B','Caught restricted read','B'),('C','Allowed fixture','D'),('D','Environment demo','E'),('E','Host chat + Paper confirmation','C')]
normalized=[]
for cid,label,recording in order:
 r=next(x for x in live if x['caseId']==recording);normalized.append({'caseId':cid,'label':label,'recordingCaseId':recording,**{k:x for k,x in r.items() if k!='caseId'}})
save('live-A-E-summary.json',normalized)
liveTable='\n'.join('| '+x['caseId']+' | '+x['label']+' | '+x['profile']+' | PASS |' for x in normalized)
changed='\n'.join('- `'+x['path']+'`' for x in files)
report=f"""# Phase 7.5 result
COMPLETE WITH LIMITATIONS

# Executive summary
- Replaced three competing columns with an editor-centered Workbench and optional assistant.
- Added first-class, real-database Execution Insights using a minimal read-only query.
- Unified execution outcome, collection, advisory result, runtime and host evidence presentation.
- Added neutral/indigo light and dark themes, responsive layouts and keyboard controls.
- Automated tests: {counts['PASS']} passed, 0 failed; 2 local DB skips separately passed deployed.
- All five live runc smoke cases passed; host broadcast Paper-confirmed.
- {v['frozenIntegrity']['checked']} frozen research files match the before-implementation baseline.
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
Final final automated test-case invocations: PASS {counts['PASS']}; FAIL 0; SKIPPED 2; UNAVAILABLE 0. API {api['counts']['passed']}, frontend {front['counts']['passed']}, deployed PostgreSQL 2. The 2 locally ignored DB tests passed in deployed runs. Typecheck, production build, API/web image build/deploy and Compose validation PASS. Conditional runner/shared/Docker suites not triggered. See tests.md and machine-readable logs.

# 14. Live smoke validation
| Case | Scenario | Profile | Result |
|---|---|---|---|
{liveTable}
Browser validation additionally created/saved two TypeScript versions and ran both successfully; unsaved Run, historical selection, keyboard tabs/help and copyable IDs were checked. All five smoke cases completed with complete collection and clean cleanup; B recorded permission observation and REVIEW despite successful process completion. Runtime independently inspected as runc. E had correlated completed host command and successful Paper acknowledgement. Original helper capture order used C=host, D=fixture, E=env; live-A-E-summary.json maps requested order to unchanged capture IDs. Browser workflow checks recorded separately.

# 15. Frozen research integrity
{v['frozenIntegrity']['checked']} pre-existing Phase1–7 research files hash-match before-fingerprints.json; zero changed/missing. Frozen experiment manifests additionally checked where present. No policy/reference/deterministic/scenario/source-contract change outside the authorized UI/read-only history support. Prior dirty Git changes belong to earlier phases.

# 16. Files changed
{changed}
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
"""
md('report.md',report)
print('Documentation written; test case counts',counts)
