from common import *
import hashlib,re,os,urllib.parse,datetime

baseline=json.loads((OUT/'before-hashes.json').read_text())
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
prior={k:v for k,v in baseline.items() if k.startswith('research-results/')}
changed_prior=[k for k,v in prior.items() if not (ROOT/k).is_file() or digest(ROOT/k)!=v]
assert not changed_prior,changed_prior
save('frozen-integrity.json',{'priorResearchFilesChecked':len(prior),'changedOrMissing':changed_prior,'frozenExperimentsRerun':False})
changed=[]
for root in ['apps','services','packages','minecraft','config','docs']:
 for base,dirs,names in os.walk(ROOT/root):
  dirs[:]=[d for d in dirs if d not in ['node_modules','build','dist','.gradle','coverage','.git']]
  for name in names:
   p=Path(base)/name;k=p.relative_to(ROOT).as_posix()
   if k not in baseline or digest(p)!=baseline[k]:changed.append(k)
changed=sorted(set(changed+['README.md','compose.yaml']))
save('changed-files.json',changed)

query={'start':'2026-10-11T00:00:00Z','end':'2026-11-11T00:00:00Z','limit':'50'}
all_items=[];pages=[];total=None
for offset in range(0,1000,50):
 code,data=http('/api/executions/period?'+urllib.parse.urlencode({**query,'offset':str(offset)}));assert code==200,data
 total=data['total'];pages.append({'offset':offset,'returned':len(data['items']),'total':total});all_items+=data['items']
 assert all(r['durationMs'] is None or isinstance(r['durationMs'],(int,float)) for r in data['items'])
 if offset+len(data['items'])>=total:break
assert len(all_items)==total and len({r['id'] for r in all_items})==total and total>100
assert all(datetime.datetime.fromisoformat(query['start'])<=datetime.datetime.fromisoformat(r['createdAt'])<datetime.datetime.fromisoformat(query['end']) for r in all_items)
save('date-api-validation.json',{'range':query,'pages':pages,'total':total,'uniqueIds':len({r['id'] for r in all_items}),'numericDurations':True,'summary':data['summary']})

counts={}
for suite in ['frontend','api','runner','gateway']:
 r=json.loads((OUT/(suite+'-tests.json')).read_text());assert r['exitCode']==0,(suite,r['exitCode']);counts[suite]=r['counts']
for suite,file in [('postgres','postgres-tests.json'),('docker','docker-integration-tests.json'),('shared-contract','shared-contract-tests.json')]:
 r=json.loads((OUT/file).read_text());assert r['exitCode']==0,(suite,r['exitCode']);plain=re.sub(r'\x1b\[[0-9;]*m','',r['stdout']+'\n'+r['stderr']);m=re.search(r'(\d+) passed \| (\d+) failed(?: \| (\d+) ignored)?',plain);assert m,(suite,plain[-200:]);counts[suite]={'passed':int(m[1]),'failed':int(m[2]),'skipped':int(m[3] or 0)}
j=json.loads((OUT/'java-tests.json').read_text());assert j['exitCode']==0;counts['java']={k:j['junit'][k] for k in ['passed','failed','skipped']}
save('test-summary.json',counts)
for f in ['frontend-typecheck-tests.json','final-build.json','final-deployment.json','final-web-build.json','final-web-deploy.json','compose-validation.json']:
 assert json.loads((OUT/f).read_text())['exitCode']==0,f
audit={}
for kind in ['production','all']:
 r=json.loads((OUT/('dependency-audit-'+kind+'.json')).read_text());b=json.loads(r['stdout']);audit[kind]={'counts':b['metadata']['vulnerabilities'],'packages':[{k:v[k] for k in ['name','severity','isDirect','fixAvailable']} for v in b.get('vulnerabilities',{}).values()]}
save('dependency-summary.json',audit)

registry=json.loads((OUT/'deployed-registry.json').read_text());paper=json.loads((OUT/'trusted-paper-command-results.json').read_text())
assert len(registry)==10 and all(r['result']['success'] for r in paper['A'])
assert len(paper['A'])==6 and len(paper['B'])==1 and paper['B'][0]['result']['success'] is False
for key in ['A','B','C','D']:
 d=json.loads((OUT/(key+'-live.json')).read_text());assert d['execution']['status']=='completed';assert d['execution']['result']['manifest']['dockerRuntime']=='runc'
assert json.loads((OUT/'C-browser-version2-run.json').read_text())['execution']['status']=='completed'

def doc(name,s):(OUT/name).write_text(s.strip()+'\n',encoding='utf-8')
doc('architecture.md','''# Architecture
Expanded host capabilities and multi-file script support are post-analysis extensions. They were not part of the frozen Phase 1–7 research experiments.

The existing CodeMirror, Gemini proposal, immutable manifest/review, API execution, Docker supervisor, peer-bound Gateway session, queue correlation and typed SecureBridge paths were extended in place. Single-source legacy versions remain supported; migration013 adds optional immutable JSONB project snapshots and a date-order index. No scheduler, persistent sandbox, event subscription engine, package manager, generic Paper API or console command transport was added. Existing branding, themes, inline Yes/No approval, progress and evidence diagnostics remain.

Fresh sandbox -> validate/materialize selected version -> Deno entrypoint -> approved typed Host calls -> process/evidence -> cleanup. Permission decisions and process outcomes remain separate. The current trusted-operator/local-PoC threat model is unchanged; this is not a new public multi-tenant service.
''')
rows='\n'.join(f"| {id} | {c['sdk']} | {c['maxCalls']} | {c['impact']} | {c['description']} |" for id,c in registry.items())
doc('capability-expansion.md','''# Actual registry
| Capability | SDK | Maximum calls | Impact | Description |
|---|---|---:|---|---|
'''+rows+'''

New: player.getState, world.getBlock, world.setBlock, world.setWeather, world.setTime and world.playSound. Optional giveItem was omitted. Registry/resource generation and exact SDK examples are shared rather than separately maintained Assistant/Help lists.

Constraints: optional exact player-name allowlist (up to10); entities ZOMBIE/SKELETON/COW/PIG (spawn maximum3); materials STONE, DIRT, GRASS_BLOCK, COBBLESTONE, OAK_PLANKS, GLASS, GOLD_BLOCK, DIAMOND_ORE, AIR; weather CLEAR/RAIN/THUNDER; time DAY/NOON/SUNSET/NIGHT; sound ENTITY_ZOMBIE_AMBIENT/BLOCK_NOTE_BLOCK_PLING/ENTITY_EXPERIENCE_ORB_PICKUP. Approval can narrow these lists and quotas. Session total remains12 authorized argument-valid calls.

World coordinates: first active world only, loaded chunks, within32 blocks horizontally and spawnY−8…+16; world height bounds also apply. Blocks require integers and cannot replace containers/block entities or bedrock. Sounds use fixed volume0.5/pitch1. No NBT or arbitrary extra fields. Player state is sanitized name/position/rotation/world and online-only; no IP/session/internal objects. Typed direct Paper APIs implement each operation; no console command shortcut.
''')
doc('multi-file-model.md','''# Immutable project model
ScriptVersion optionally includes project:{entrypoint,files:[{path,content}]}. Legacy source-only snapshots remain null. The source column equals the project entrypoint text for compatibility. Every file persists together in JSONB; SQL triggers reject updates to source/project/language. New versions get new manifests and unreviewed decisions.

Limits:1–20 files, .ts/.js/.json,256KiB UTF-8/file,512KiB total,160-character restricted relative paths. Reject absolute/Windows/traversal/hidden/encoded paths, reserved device names, duplicates including case collisions and missing/non-code entrypoints. Canonical sorting and serialization bind every file to sourceSha256; old null-project hashes remain plain-source hashes. Detection scans all files and never grants authority.

The real Gemini C proposal contained main.ts, utils/summary.ts and config.json. Browser edits to all three were saved as version2. API verification proved all changes persisted and version1 stayed unchanged. Version2 required a new explicit review; the stored review did not auto-run. See C-browser-saved-version.json, C-version2-review.json and C-browser-version2-run.json.

Actual CodeMirror tabs support active/dirty states, full path labels/tooltips, keyboard arrows/Home/End and horizontal scrolling. Add/rename/delete and entrypoint controls validate paths, warn about imports and save the complete set. Mounted tab views retain cursor/scroll/history; drafts retain content across in-app navigation. Error navigation requires the matching clean version. Reload-persistent drafts and automatic import refactoring are not provided.
''')
doc('runtime-materialization.md','''# Runtime materialization
API and supervisor independently validate the complete bundle and entrypoint source; manifest session identity uses the canonical whole-project hash. New-project stdin carries JSON rather than executable shell fragments. A trusted materializer revalidates paths/counts/bytes, creates a fresh /workspace/project tree with createNew files, outputs the validated entrypoint path, and exits before user execution. No uploaded symlinks/binaries or caller-selected mounts/commands exist.

The user process retains its original Deno profile grants, resource deadlines, readonly root, isolated network, no privileges/Docker socket and ephemeral tmpfs. New projects add --no-remote --no-npm, not new filesystem/network grants. Relative TypeScript/JavaScript and JSON imports work; HTTP/npm/jsr imports fail. Materializer writes run without the untrusted audit environment; C's native observations were env/net from SDK transport, not trusted materialization writes. Runtime-written files never update application versions.

Docker integration:27 passed, including local imports, missing imports, helper syntax/runtime failures, blocked package/remote resolution, cleanup, env isolation and fresh filesystem state. Sandbox Deno remains2.9.7 and ordinary runtime runc. Frozen runsc/Jev work was not rerun.
''')
doc('assistant-contract.md','''# Assistant contract
Real configured Gemini gemini-3.8-flash returns message plus an optional proposal. Multi-file proposals add project:{entrypoint,files}; source must exactly equal entrypoint content. All paths, byte/count limits and requested constraints pass strict application validation before persistence. Unsupported capabilities are flagged and cannot be approved. No approval/granted fields are accepted.

The shared registry, exact SDK examples and explicit platform limitations form current context. Simple scripts stay one file; helpers/config justify conservative splits. Mixed event/action requests explain the unsupported persistent listener and provide the supported one-shot alternative. Four real A–D generation responses are retained; C produced three genuine files and D accurately explained the click-listener limitation.

An initial provider INVALID_ARGUMENT is retained in A-gemini-first-invalid-schema.json and assistant-first-failure-log.json. It disappeared after reducing provider grammar complexity (free-form constraints at the provider grammar layer, fewer array bounds); the full strict server parser still enforces every allowed constraint, field and size. The complexity diagnosis is an inference consistent with Google's documented limitations: https://ai.google.dev/gemini-api/docs/structured-output . There is no automatic blind retry or mock substitution.
''')
doc('security-validation.md','''# Security validation
Explicit version-bound reviews, immutable snapshots, source/bundle hash, approved subset, argument allowlists, quotas, expiry, execution identity and peer-IP session binding remain authoritative. Assistant/Jev/profile selection never grant authority. CLI test-harness approvals are explicit bounded operator actions; browser checks opened/cancelled review and separately ran approved versions. Automated UI tests cover final approval submission.

Live unreviewed request:HTTP400. Live constraint/denial fixture:command block, unapproved material, weather outside approved list and unapproved sound all denied with no queued Paper effects. Live narrowed server.status quota produced CAPABILITY_QUOTA_EXCEEDED. Existing Gateway tests retest expiry/revocation, forged execution/peer identity, unapproved/unsupported IDs and quota/constraint rejection. Unsupported Gemini proposals and forged approval fields are server-validated in API tests. Traversal, absolute paths, duplicate names, file/count/size bounds and whole-bundle hashes have focused coverage. All final suites pass.

The live check found an original four-ID filter in trusted command-result correlation. It now derives IDs from the registry; forged origins still fail. Original A/B/D evidence events were not backfilled or rewritten. Independent authenticated queue-side results confirm all six A commands, B's offline failure and D's weather acknowledgement (trusted-paper-command-results.json). Later typed-operations-live.json contains all seven expected confirmation events, including the failed offline player state.

Block cleanup targeted only the exact DIAMOND_ORE created by A, checked its type, restored its prior AIR material, and set weather CLEAR/time DAY. Those actions are recorded. Sounds were acknowledged by Paper; audibility on an online client was not tested. Demo entities retain existing scheduled cleanup. No configured credential values were found in the new package's textual artifacts.
''')
doc('insights-redesign.md',f'''# Execution Insights redesign
Removed the competing Script dropdown and Runs/latest-run selector shown in the user's screenshot. Period, provider and sort now query history across scripts. Local Today, rolling24h/7d/30d and custom datetime inputs convert to UTC. From is inclusive, To exclusive; ranges are limited to366 days. Server filtering/sorting precede LIMIT/OFFSET; the date index supports ordering. UI pages50/API maximum200; maximum offset100000 is disclosed. Narrow the period if reaching that bound.

The former latest100 client-only restriction is removed. Actual API validation returned {total} unique executions across {len(pages)} pages; transactional PostgreSQL tests separately proved125 rows across50/50/25 with exact half-open boundaries. Period totals and outcome/advisory/duration/evidence cards aggregate the entire query, not the current page. Selected-run diagnostics remain explicitly scoped to that run. Row selection does not change the date range. Direct Workbench targets outside the range/page are labelled separately.

Browser checked Today pagination51–70,24h/7d/30d, a custom single-day time window, a multi-day window and an empty future period. Selecting two different rows preserved both dates. Native segmented datetime entry was used after the automation fill helper did not enter values; no application workaround was added. Numeric PostgreSQL float8 durations were normalized after a real browser observation exposed strings. Query endpoints remain fixed while paging until changing/refreshing the range; database rows are not held in a transaction-wide browsing snapshot. See insights-browser.json, insights-custom-range.png and date-api-validation.json.
''')
doc('limits-ux.md','''# Limits UX
Prominent What are the limits? button appears in Workbench. A keyboard-accessible native modal provides one-shot lifecycle, file limits, imports, explicit per-version permission explanation, actual running-registry capability cards, exact SDK snippets, registered allowlists, spatial/online/quota restrictions, unsupported persistent events/commands/Paper/reflection/dependencies/network/filesystem and suggested supported requests.

The available-operation list comes from the API registry; examples/allowlists/platform limitations come from the same shared contract source used by Assistant and enforcement. Help links users to this dynamic guide instead of keeping its old four-operation list. It does not invent unimplemented giveItem/event APIs. World changes may outlive sandbox teardown; this is not a rollback mechanism.

Browser proof:10 actual cards; light background white, dark rgb(24,34,53). Mobile390 and tablet768 viewport checks showed no horizontal dialog overflow; native modal scrolling retained readable content. Viewport overrides were reset and dark theme restored. Editor cached tabs also changed syntax colors correctly after theme switches. See limits-browser.json and screenshots.
''')
doc('live-validation.md','''# Live demonstrations
Local deployed Docker/runc, real Gemini, real SecureBridge/Paper, deterministic advisory only. No player participation requested.

| Case | Result | Evidence |
|---|---|---|
| A world combination | Gemini generated status +THUNDER +two zombies +DIAMOND_ORE +broadcast. Execution completed; all6 commands independently confirmed by Paper | A-gemini.json, A-live.json, trusted-paper-command-results.json |
| B player state | Gemini used GoldennBullet and safe one-shot logic. Player offline was reported; no block was placed using nonexistent player state. Process completed after handling the failure | B-gemini.json, B-live.json, trusted-paper-command-results.json |
| C multi-file | Gemini produced3 files with actual helper/JSON imports. V1 ran. Browser edited all3, saved V2, observed fresh review, then separately ran approved V2 successfully | C-gemini.json, C-browser-saved-version.json, C-browser-version2-run.json, project-final.png |
| D unsupported click listener | Gemini explicitly explained unsupported persistent events and generated a separately approved CLEAR-weather one-shot alternative; Paper confirmed it | D-gemini.json, D-live.json, trusted-paper-command-results.json |

Additional typed operation run independently confirmed block read, block cleanup, weather CLEAR, time DAY and allowlisted sound, with a correctly recorded offline player-state failure. Console, read-fixture, env-demo, historical null-manifest host-chat and an existing-format capability manifest all completed. Negative requests and quota checks remain recorded. Live missing-import, helper syntax and helper runtime executions failed as expected, retaining actual file/line diagnostics. Browser error navigation opened helper.ts line1,column7 in the matching version; these are expected negative test outcomes, not failed validation.

Successful online player state/relative block placement and client-audible sound were not demonstrated; no players were online. Successful method invocation/acknowledgement is distinguished from an online player's visual experience. Approvals in live tests used the explicit bounded API harness; no claim of a human clicking final approval is made.
''')
test_table='\n'.join(f"| {name} | {c['passed']} | {c['failed']} | {c['skipped']} |" for name,c in counts.items())
doc('tests.md','''# Final validation
| Suite | Passed | Failed | Skipped/ignored |
|---|---:|---:|---:|
'''+test_table+'''

API's4 ignored tests are the opt-in PostgreSQL suites; all4 passed separately against the deployed database. Frontend typecheck, production builds/deployment, Compose validation and git diff whitespace checks passed. Shared-contract generation/resource consistency passed. No frozen Jev/gVisor scientific experiments rerun.

Coverage includes project paths/counts/UTF8 bytes/canonical hashes; one/multiple files, immutable Save/version/review; real CodeMirror tabs/editing/drafts/JSON/keyboard/cache themes; helper diagnostics/navigation; structured Assistant validation; six capability argument schemas, constraints/denial/quota/session boundaries; date presets/custom/empty/stale replies/pagination/full aggregates; running-registry Limits and accessibility. Expected runtime/provider failures are retained as evidence. Original Docker error-location assertion was corrected to strip ANSI formatting before comparison.

Dependency audit:production0 findings; full tree6 (3 moderate,1 high,2 critical), all in development tooling. The exact affected packages/advisories/fix metadata are in dependency-summary.json and raw audits. Major toolchain upgrades were not applied automatically. The deployed site serves a production build, not the Vitest UI/development server. Audit is npm's view of this dependency graph, not a whole-system vulnerability assessment.
''')
doc('changed-files.md','# Changed files\n\nCompared against the pre-task working-tree hashes; prior work was already uncommitted and was preserved. README is append-only in this task.\n\n'+'\n'.join('- `'+k+'`' for k in changed)+'\n\nAdditive evidence and harnesses are confined to this timestamped package and its parent current-result-path.txt pointer. No commit/push performed.')

doc('report.md',f'''# Advanced script platform extension result

COMPLETE WITH LIMITATIONS

# Executive summary

- Real multi-file snapshots, local imports and editable CodeMirror tabs are deployed.
- Six typed operations expand the sandbox registry to10 capabilities.
- Approval binds every file and remains explicit/version-specific/Gateway-enforced.
- Date-range Insights replaces the competing script/run selectors and pages beyond100 records.
- Workbench has a dynamic What are the limits? guide in both themes and responsive layouts.
- Real Gemini/Paper A–D checks completed; online player success remains unverified because GoldennBullet is offline.
- All final tests pass; development dependency findings are documented.
- Frozen research files remain unchanged; no Phase8, commit or push.

# 1. Final supported script model

Bounded one-shot TypeScript/JavaScript calculations, loops/functions/classes, helper modules, JSON imports and compositions of registered approved Host operations. Fresh sandbox per execution; saved snapshots are independent of ephemeral runtime files.

# 2. Explicit unsupported model

Persistent event/click/join listeners, background jobs, daemons, schedules and subscriptions remain unsupported. No arbitrary commands/Paper/reflection/dependencies/filesystem/internet access or installed plugins.

# 3. Capability registry

| Capability | SDK | Maximum calls | Impact | Description |
|---|---|---:|---|---|
{rows}

See capability-expansion.md for complete constraints/allowlists. First active world, loaded demo area32 blocks horizontal/spawnY−8…+16; block integer coordinates and protected-state checks. Per-capability approved quotas plus total12. Optional giveItem omitted.

# 4. Advanced Assistant behavior

Real Gemini knows the shared registry/examples/limitations, composes registered operations and structured multi-file projects, and proposes rather than grants permissions. D explains unsupported click listeners and offers a one-shot alternative. Initial schema INVALID_ARGUMENT and the successful grammar simplification are retained; full server validation stayed strict. See assistant-contract.md.

# 5. Capability approval/enforcement

Canonical complete-bundle hash, immutable version/review, fresh review on any saved file change, explicit decisions, separate Run, approved subset and Gateway/Paper validation. Mode selection/Assistant/advisory labels never grant authority.

# 6. Multi-file project architecture

Optional immutable project JSONB snapshot with entrypoint and full sorted file set; legacy source rows remain compatible. Migration013 includes snapshot-update protection and date-order index. source remains entrypoint text for older consumers.

# 7. Multi-file editor UX

Active Workbench editor: CodeMirror6. Real main.ts/utils/summary.ts/config.json tabs, keyboard/dirty/path states and add/rename/delete/entrypoint controls. Browser edited all3, saved V2, proved V1 unchanged, reviewed V2 and separately ran it. Cached-tab theme colors were verified in the final bundle. project-final.png and editor-final-browser.json provide proof.

# 8. Runtime file handling/security

1–20 .ts/.js/.json files;256KiB/file,512KiB total. Strict relative paths at API/supervisor/materializer. Fresh tmpfs, no symlinks/binaries, no user shell expansion. Relative/JSON imports work; HTTP/npm/jsr blocked. No additional runtime grants or writeback. See runtime-materialization.md.

# 9. Advanced live demonstrations

A: all6 Paper command results successful (status/weather/two spawns/block/chat). B: offline player failure handled, no incorrect placement. C: real3-file imports and V1/V2 runs successful. D: unsupported event explained; approved one-shot CLEAR succeeded. Additional new-operation/cleanup confirmations recorded. See live-validation.md.

# 10. Multi-file failure handling

Missing import identifies main.ts import site; syntax failure identifies helper.ts:1:14; runtime failure identifies helper.ts:1:7. Browser navigation opened the matching helper tab and line; another/dirty version is not overwritten.

# 11. Execution Insights redesign

Removed Script and Runs selectors from the screenshot area. Added local Today/24h/7d/30d/custom datetime queries across scripts, provider/server sorting and50-row paging. Selection preserves dates and opens only that run's details. Period statistics cover all matching pages; empty range is clean.

# 12. Date-query correctness

Latest100 limitation removed. Real API returned {total} unique rows across{len(pages)} pages; transactional125-row proof and exact half-open boundary tests passed. Durations normalize PostgreSQL float8 strings to numbers. From inclusive/To exclusive, range<=366days, API limit<=200, disclosed offset cap100000 remains. Pagination fixes its timestamp endpoints until query change/refresh.

# 13. What are the limits?

Prominent Workbench button opens a native accessible modal. Current API registry, shared SDK examples/allowlists and explicit platform limitations drive the content. Includes permissions, project limits, unsupported events and supported/unsupported examples. Desktop/mobile390/tablet768 and both themes verified.

# 14. Jev/advisory behavior

Jev remains advisory only. Live checks used the existing deterministic analyzer. No advisory outcome approves/denies/adds capabilities; no frozen Phase3 rerun or classifier rule change.

# 15. Security/tampering validation

Live unreviewed/denied/disallowed material/weather/sound requests and narrowed quota failed closed. Focused tests cover malformed schemas, entity constraints, expired/revoked sessions, cross-execution/peer identity, unsupported proposals, forged fields and file escapes. Original confirmation-event filter was repaired using the registry; old events were not rewritten. See security-validation.md.

# 16. Backward compatibility

Console, read-fixture, env-demo, historical fixed host-chat and existing-format manifest scripts all completed. No forced historical migration or review for simple scripts. Current project/source interfaces accept legacy requests.

# 17. Tests

| Suite | PASS | FAIL | SKIPPED |
|---|---:|---:|---:|
{test_table}

Frontend typecheck, production builds, Compose validation and whitespace checks passed. API's4 opt-in database skips were run separately:4/0/0. Raw logs retained. No frozen scientific reruns.

# 18. Dependency audit

Production0 findings. Development tree6:3 moderate,1 high,2 critical. Exact affected dependencies/advisories/fix metadata in dependency-summary.json. No automatic major upgrades; deployed UI is the production build.

# 19. Frozen research integrity

{len(prior)} pre-existing research-result files hashed:zero changed/missing. No Jev/gVisor numbers, evidence, methods or Phase7 conclusions rewritten. These are explicitly post-analysis product extensions.

# 20. Files changed

{len(changed)} implementation/test/config/documentation files; see changed-files.md/json. Additive timestamped evidence only. No commit or push.

# 21. Remaining limitations

GoldennBullet offline:successful online player state/relative block placement unverified. Client visual/audible effects were not observed; trusted Paper acknowledgements are recorded. Live reviews used the bounded operator API harness; approval-button behavior is UI-tested. Native datetime controls required segmented input in automation. Dependency-tool findings and the disclosed date-page offset cap remain. Drafts do not survive browser reload; file refactoring/LSP/debugger are not provided. No prior execution-report export existed; the existing manifest JSON export remains, with immutable project inventories available through version data.

# 22. Scope discipline

No persistent scripting/event listeners, arbitrary commands, generic Paper API, package manager, scheduler or persistent sandbox processes added. Existing trusted entity cleanup remains. Frozen research untouched. No Phase8.

# 23. Recommendation

Review the deployed platform, project-final.png, insights-custom-range.png and this package. No Phase8. Successful online-player validation can remain deferred without requiring a live presentation.

READY FOR MANUAL REVIEW
''')

required=['architecture.md','capability-expansion.md','multi-file-model.md','runtime-materialization.md','assistant-contract.md','security-validation.md','insights-redesign.md','limits-ux.md','live-validation.md','tests.md','changed-files.md','report.md']
assert all((OUT/f).is_file() for f in required)
leaks=[]
for p in OUT.rglob('*'):
 if p.is_file() and p.suffix in ['.md','.json','.log','.py']:
  text=p.read_text(encoding='utf-8',errors='replace')
  if any(secret in text for secret in SECRETS):leaks.append(p.relative_to(OUT).as_posix())
assert not leaks,leaks
save('evidence-validation.json',{'requiredDocuments':len(required),'configuredCredentialLeaks':leaks,'priorResearchFilesUnchanged':len(prior),'tests':counts,'dateQueryTotal':total,'sourceFilesChanged':len(changed)})
print(json.dumps({'priorResearchFilesUnchanged':len(prior),'sourceFilesChanged':len(changed),'tests':counts,'dateQueryTotal':total,'report':str(OUT/'report.md')}))
