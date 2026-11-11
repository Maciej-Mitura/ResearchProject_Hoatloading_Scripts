from common import *
import hashlib

baseline=json.loads((OUT/'before-hashes.json').read_text())
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
old={k:v for k,v in baseline.items() if k.startswith('research-results/')}
changed_old=[k for k,v in old.items() if not (ROOT/k).is_file() or digest(ROOT/k)!=v]
assert not changed_old,changed_old
save('frozen-integrity.json',{'priorResearchFilesChecked':len(old),'changed':changed_old,'experimentsRerun':False})

changed=[k for k,v in baseline.items() if not k.startswith('research-results/') and (not (ROOT/k).is_file() or digest(ROOT/k)!=v)]
for folder in ['apps','services','packages','minecraft','config','docs']:
 for p in (ROOT/folder).rglob('*'):
  if not p.is_file() or any(x in p.parts for x in ['node_modules','dist','build','.gradle','coverage']):continue
  k=p.relative_to(ROOT).as_posix()
  if k not in baseline:changed.append(k)
changed=sorted(set(changed))
save('changed-files.json',changed)

cases=json.loads((OUT/'live-cases.json').read_text())
for n in ['A','C','D','F']:
 d=json.loads((OUT/(n+'-ui-run.json')).read_text())
 assert d['execution']['status']=='completed',(n,d['execution']['status'])
c_history=http('/api/executions/history?scriptId='+cases['C']['script']['id'])[1]
assert c_history['total']==1,c_history
save('C-history-after-incompatible-mode.json',c_history)
assert json.loads((OUT/'C-history-after-ui-review-prompt.json').read_text())['total']==0
f=json.loads((OUT/'F-ui-run.json').read_text())
results=[e['metadata'] for e in f['securityEvents'] if e['eventType']=='host.command.result']
save('live-summary.json',{'CReviewPromptExecutionCount':0,'CAfterRealRunAndWrongModeAttempt':c_history['total'],'FResults':results,'approvalMethod':'Explicit bounded integration-harness API reviews; UI opened/cancelled review and submitted separate Run clicks. No claim of browser approval-button submission.'})

def doc(name,text):(OUT/name).write_text(text.strip()+'\n',encoding='utf-8')
doc('root-cause.md','''# Root cause
Before repair the deployed Workbench rendered a native TEXTAREA with id source-editor, no .cm-editor, and bundle index-DNnxZY_L.js (editor-before.json). The active ScriptEditor source path itself rendered the textarea; a real mounted CodeMirror implementation was absent. This was an implementation gap, not merely hidden editor styles or an assumed stale bundle.

The exact toast was reproduced on the existing generated-spawn version with a stored review but the fixed host-chat profile selected (run-error-before.png). The version was manifest-based; backend validation correctly rejected fixed authority. The previous Run path did not consult manifest state before POST and rendered String(ApiError), exposing the implementation requirement. No backend validation was removed. Current Run checks local permissions, then App re-fetches the manifest before POST; backend races map to actionable guidance.
''')
doc('codemirror-verification.md','''# Deployed CodeMirror verification
Active Workbench editor: CodeMirror 6

Workbench -> ScriptEditor -> CodeEditor -> EditorView/EditorState. Active deployed bundle /assets/index-AgzVD9CN.js. Production web container rebuilt/recreated. editor-after.json records one .cm-editor, DIV.cm-content#source-editor, zero source textareas, one line gutter and distinct TypeScript keyword/type/number colors. The old source textarea path was removed. editor-packages.json records the official pinned dependencies.

Actual browser keyboard checks: Ctrl+F opened editor search and found two matches; Ctrl+Z undid and Ctrl+Y restored source; Enter indented two spaces; two matching bracket decorations appeared. Current-line highlighting and gutters are visible in codemirror-search.png. Search layout is a compact 69.25px panel. Light/dark backgrounds measured rgb(238,242,248) and rgb(17,27,43). No reload was required for theme change.

long-source-browser.json records 806 lines, scrollHeight 17311px, clientHeight 440px, scrollTop 16857px and final line visible. Switching scripts and back preserved the dirty draft and disabled Run. The synthetic long draft was then restored to the saved source without saving it. A was created in the real editor, edited, saved as version 2 and run under No permissions. Existing integration tests cover Assistant insertion, Save and version/script switching using actual EditorView transactions.

Mac Cmd bindings use CodeMirror's platform keymaps; physical macOS input was not tested. This is syntax highlighting, not an LSP/type-error service. Drafts persist across in-app navigation, not browser reload.
''')
doc('capability-workflow.md','''# Permission workflow
Version-scoped manifest loading is explicit and fail-closed on load errors, with retry. An older response cannot overwrite a newer review. States: No host permissions, Review required, Approved, Partially approved, Outdated; historical null manifests are Fixed profiles. Compact requested/approved/denied counts, constraints and review controls appear near Run. Dirty source cannot run; it must be saved and reviewed as a new version.

Run on an unreviewed host manifest opens the unchecked review dialog without execution POST. Decisions are explicit; approval selects Per-script permissions visibly and never runs. A subsequent manual mode choice remains respected. Partial denial warns that remaining source calls will be rejected and allows an intentional run; it does not restore denied authority. Inline Assistant Yes/No remains supported. Known server workflow errors become guidance with a review action; unrelated errors retain a readable error message.

Live approvals for C/F were submitted by the explicitly authorized bounded integration harness. Browser validation opened/cancelled the review and separately clicked Run after the stored review was loaded; automated UI tests exercise the final approval-button submission. This distinction is intentional and recorded rather than presenting harness approval as a human browser interaction.
''')
doc('profile-semantics.md','''# Execution profiles
| Internal ID | Visible name | Scope |
|---|---|---|
| none | No permissions | No additional filesystem, environment or host grants; restricted sandbox |
| read-fixture | Read test fixture | Read predefined /fixtures data only |
| env-demo | Demo environment | Read SANDBOX_DEMO_VALUE only |
| host-chat | Chat broadcast (fixed) | Historical null-manifest versions, fixed chat.broadcast authority |
| host-capabilities | Per-script permissions | SDK/Gateway transport using only the selected version's explicit stored review |

Mode selection is not permission approval. New saved versions use version-scoped manifests, including empty manifests for simple scripts. The existing backend incompatibility between a manifest and fixed host-chat remains enforced. Tooltips and Help explain the options; ordinary workflow messages no longer ask users to select an internal identifier. Technical stored diagnostics may retain IDs.
''')
doc('tests.md','''# Validation
| Check | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Frontend Vitest (11 files) | 146 | 0 | 0 |
| API Deno tests | 131 | 0 | 3 |
| Host Gateway Deno tests | 32 | 0 | 0 |

Frontend typecheck passed. Production frontend build and deployment passed (web-final-build.json/web-final-deploy.json). API build/deployment passed (build.json/deploy.json). API ignored tests are the three explicitly opt-in PostgreSQL suites; SQL and manifest queries were not changed, so those were not rerun. No frozen experiments rerun.

New targeted repair coverage includes real editor mount/no textarea, edits, history/search/indentation, long source, theme, external source/read-only, Save/drafts, review-before-run, approval without auto-run, manual mode choice, partial denial, dirty/outdated and new-version review, friendly backend-race handling, no invalid POST, correct mode submission and stale manifest response protection. Full-suite logs and machine-readable counts are retained beside this file.
''')
doc('live-validation.md','''# Live A-F validation
Local deployed web/API, Docker/runc, deterministic risk advisory, real Paper bridge. These are bounded product checks, not new scientific runs.

| Case | Outcome | Evidence |
|---|---|---|
| A console | Created/edited/saved version 2 in CM; No permissions, no review; completed, stdout 42 | A-ui-run.json |
| B historical host-chat | Existing bounded null-manifest fixture completed; Paper confirmed broadcast | B-legacy-run.json |
| C advanced | Run opened unchecked review; zero executions. Harness review stored; mode visibly selected, no auto-run. Separate UI Run completed; Paper confirmed status/chat. Later fixed-mode Run showed friendly guidance and history remained exactly one | C-history-after-ui-review-prompt.json, C-ui-run.json, C-history-after-incompatible-mode.json |
| D partial | Warning displayed, chat approved/spawn denied; deliberate UI Run completed with chat confirmation and CAPABILITY_NOT_APPROVED for spawn | D-ui-run.json |
| E bypass | Unreviewed fixed-mode request, unreviewed per-script request and forged client authority each rejected HTTP400; zero execution records | E-backend-bypass.json |
| F Gemini | Real Gemini 201 proposal, four requested/unreviewed capabilities saved. Browser showed Review required. Harness explicitly approved; browser showed ready Per-script permissions. Separate Run completed; status, chat, three ZOMBIE effects confirmed by Paper | F-gemini-response.json, F-ui-run.json, workbench-final.png |

F private-message attempt was authorized but Paper returned an offline-player failure for GoldennBullet. Successful delivery was not tested and no user participation was requested. No raw ApiError appeared in normal C/F flow or the preempted wrong-mode attempt. Runtime completion is distinct from individual host-effect success; F therefore includes the message failure rather than claiming all effects succeeded.
''')
doc('changed-files.md','# Files changed during this repair\n\nCompared with the pre-task hash baseline, not an already-dirty Git HEAD.\n\n'+'\n'.join('- `'+k+'`' for k in changed)+'\n\nAdditive evidence, scripts, screenshots and logs are confined to this timestamped package and its current-result-path.txt pointer. No commits or pushes performed.')
report=f'''# Capability Workbench repair result

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

All {len(old)} pre-existing research-result files hashed against the pre-task baseline: zero changed or missing. No Jev/gVisor scientific reruns, frozen evidence/methodology edits or Phase 8 work. See frozen-integrity.json.

# 14. Files changed

See changed-files.md and changed-files.json ({len(changed)} implementation/test/documentation files). Changes cover the active CM editor, Workbench permission gating, friendly profile/error guidance, Help and provider instruction wording; no SQL, runner, Gateway or Paper security implementation changed. New evidence is additive.

# 15. Remaining limitations

Private-message success cannot be claimed with GoldennBullet offline. Native macOS keys were not physically tested; CodeMirror platform bindings are configured. Syntax highlighting is not a TypeScript language server. Live review submission used the bounded API harness; final approval-button behavior is automated UI-tested, while browser checks opened/cancelled review and clicked Run separately. This local PoC's trusted-operator security model is unchanged.

# 16. Recommendation

Review the deployed Workbench and the supplied screenshots/report. No Phase 8. No commit or push performed.

READY FOR MANUAL REVIEW
'''
doc('report.md',report)
leaks=[]
for p in OUT.rglob('*'):
 if p.is_file() and p.suffix in ['.json','.md','.log','.py']:
  s=p.read_text(encoding='utf-8',errors='replace')
  if any(v in s for v in SECRETS):leaks.append(p.name)
assert not leaks,leaks
save('evidence-validation.json',{'requiredDocuments':8,'configuredCredentialLeaks':leaks,'liveCases':'A-F','priorResearchFilesUnchanged':len(old)})
print(json.dumps({'sourceFilesChanged':len(changed),'priorResearchFilesUnchanged':len(old),'report':str(OUT/'report.md')}))
