from phase6_common import *
import hashlib,collections,re,urllib.parse
read=lambda name:(ROOT/name).read_text(encoding='utf-8')
load=lambda name:json.loads((OUT/name).read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def md(name,value):(OUT/name).write_text(clean(value),encoding='utf-8')
GIT=r'C:\Program Files\Git\cmd\git.exe'
def git(*args):
 r=subprocess.run([GIT,*args],cwd=ROOT,capture_output=True);assert r.returncode==0,r.stderr.decode(errors='replace');return r.stdout.decode('utf-8')
baseline=load('before-fingerprints.json')
required=['changed-files.json','changed-files.md','publication-checklist.json','publication-checklist.md','secret-scan.json','secret-scan.md','report.md','result-artifact-hashes.json','final-blocker-assessment.json']
for name in required:
 if not (OUT/name).exists():(OUT/name).write_text('{}\n' if name.endswith('.json') else 'Finalization pending.\n',encoding='utf-8')
save('final-blocker-assessment.json',{'result':'COMPLETE WITH LIMITATIONS','MUST_FIX':[],'ACCEPTABLE_LIMITATION':['Manual browser walkthrough unavailable; source/test/deployed asset/API/DB checks do not establish visual acceptance.','Native audit blind spots, single-runner scope, non-durable OTel/no full Paper span and no production/escape guarantees retained.','Earlier Phase 6 exact suite logs were overwritten by initial resume output-binding error; known original outcomes and final separate reruns documented in validation-history.json. No frozen result was affected.'],'PHASE_8_PACKAGING_ONLY':['Important Phases 1–6 source remains uncommitted; publish a reviewed source identity later.','Choose explicit full result archive versus selective summary publication; preserve manifests/raw artifacts together.','Exclude configured secrets, dependencies/caches and transient outputs.'],'phase7Started':False,'committed':False,'pushed':False})

# File-level package recommendations include ignored files without reading their values.
modified=git('diff','--name-only','-z','HEAD').split('\0');untracked=git('ls-files','--others','--exclude-standard','-z').split('\0');ignored=git('ls-files','--others','--ignored','--exclude-standard','-z').split('\0')
states={p:'modified/deleted tracked' for p in modified if p}
states.update({p:'untracked' for p in untracked if p});states.update({p:'ignored' for p in ignored if p})
cacheparts={'node_modules','dist','build','.gradle','.deno','.vite','__pycache__','.cache'}
def category(path):
 p=Path(path)
 if p.name=='.env' or (p.name.startswith('.env.') and p.name!='.env.example') or p.suffix in ['.pem','.key','.p12','.pfx','.jks','.keystore','.kdbx']:return 'LOCAL/SECRET'
 if path.startswith('research-results/'):return 'GENERATED/RESULTS'
 if any(s in p.parts for s in cacheparts) or p.name=='.phase6-output-path' or p.suffix in ['.log','.tmp','.bak','.pyc']:return 'SHOULD NOT COMMIT'
 return 'SHOULD COMMIT'
entries=[]
for path,state in sorted(states.items()):
 p=ROOT/path;cat=category(path)
 entries.append({'path':path,'gitState':state,'category':cat,'exists':p.is_file(),'bytes':p.stat().st_size if p.is_file() else 0})
counts=collections.Counter(x['category'] for x in entries)
groups=[]
for folder in sorted((ROOT/'research-results').iterdir()):
 if not folder.is_dir():continue
 files=[p for p in folder.rglob('*') if p.is_file()];size=sum(p.stat().st_size for p in files)
 groups.append({'path':folder.relative_to(ROOT).as_posix(),'files':len(files),'bytes':size,'recommendation':('Selectively commit small sanitized summary/manifests; archive full sealed package separately with all raw inputs/results. Do not delete or silently publish.' if len(files)>10 else 'Candidate for committing the complete small sanitized package after explicit review; preserve original files/hashes.'),'existingConvention':'Some frozen evidence/logs are ignored; current local results are not all available at published HEAD.'})
publication={'scope':'Exact modified/deleted tracked, untracked and ignored file paths in this repository at finalization; unchanged tracked source already present at HEAD is not a pending-file entry. Sizes are advisory snapshots, not integrity hashes.','categoryCounts':dict(counts),'trackedChanges':len([p for p in modified if p]),'untrackedFiles':len([p for p in untracked if p]),'ignoredFiles':len([p for p in ignored if p]),'stagedFiles':git('diff','--cached','--name-only').splitlines(),'files':entries,'resultPackages':groups,'actionsPerformed':'Inventory/recommendations only. No git add/commit/push, ignore-policy edits, result deletion or publication.','phase8Checklist':['Review every SHOULD COMMIT source/test/migration/sample/doc/tool file, including additions from earlier phases. Stage the removed obsolete sample too.','Ensure machine-specific research helpers are described as provenance tooling, not portable normal setup. Parameterize defaults later only if needed for publication.','Publish a reviewed source commit/archive identity; published HEAD currently lacks the integrated state.','Choose explicit evidence delivery. Keep complete frozen packages plus original hash manifests, and document artifact download locations if not in Git.','Do not publish populated env files, gateway/bridge/provider secrets or database passwords. No blanket git add -f or git add . over raw local data.','Exclude cache/build/temporary paths; review sanitized small result summaries separately. Keep all negative findings and original failures.','Recheck clean-checkout links after the chosen artifact publication; current links are verified locally, not promised present at published HEAD.']}
save('publication-checklist.json',publication)
human='# Phase 8 source-publication checklist — recommendations only\n\nNo files staged, committed, pushed, deleted or published. Exact paths for all categories are in `publication-checklist.json`. Pending-file scope includes modified/deleted tracked, untracked and ignored files; unchanged tracked files are already source-controlled.\n\n'+''.join(f'- **{k}: {counts[k]} file entries**\n' for k in ['SHOULD COMMIT','SHOULD NOT COMMIT','LOCAL/SECRET','GENERATED/RESULTS'])+'\n## SHOULD COMMIT\n\n'
human+=''.join(f"- `{x['path']}` ({x['gitState']}{'; stage deletion' if not x['exists'] else ''})\n" for x in entries if x['category']=='SHOULD COMMIT')
human+='\n## SHOULD NOT COMMIT\n\nDependency/build caches, Python caches, temporary marker and transient outputs. Exact file paths are retained in the JSON rather than thousands of repetitive Markdown rows.\n\n'
human+='\n## LOCAL/SECRET\n\n'+''.join(f"- `{x['path']}` — private local file; no values included.\n" for x in entries if x['category']=='LOCAL/SECRET')
human+='\n## GENERATED/RESULTS\n\n| Directory | Files | Bytes | Recommendation |\n|---|---:|---:|---|\n'+''.join(f"| `{g['path']}` | {g['files']} | {g['bytes']} | {g['recommendation']} |\n" for g in groups)+'\n## Publication steps\n\n'+''.join(f'{i}. {step}\n' for i,step in enumerate(publication['phase8Checklist'],1))
md('publication-checklist.md',human)

# Phase 6 changes are measured against the initial pre-cleanup tree, not dirty Git HEAD.
skip={'.git','node_modules','build','dist','.gradle','.deno','__pycache__'}
current={p.relative_to(ROOT).as_posix():p for p in ROOT.rglob('*') if p.is_file() and not any(x in p.parts for x in skip) and not p.name.startswith('.env')}
changed=[]
for path,h in baseline.items():
 p=ROOT/path
 if not p.is_file():changed.append({'path':path,'change':'removed','category':category(path)})
 elif sha(p)!=h:changed.append({'path':path,'change':'updated','category':category(path)})
for path,p in current.items():
 if path not in baseline:changed.append({'path':path,'change':'created','category':category(path)})
changed=sorted(changed,key=lambda x:x['path'])
sourceChanges=[c for c in changed if c['category']=='SHOULD COMMIT']
save('changed-files.json',{'baseline':'before-fingerprints.json, captured before original Phase 6 edits','allEntries':len(changed),'sourceDocSampleToolEntries':len(sourceChanges),'counts':dict(collections.Counter(c['change'] for c in changed)),'files':changed,'separateGitHeadInventory':'publication-checklist.json','scope':'Initial snapshot excludes env/dependency/build caches and the new Phase 6 directory. All new Phase 6 package artifacts are listed as created; cache files are not source edits.'})
md('changed-files.md','# Exact Phase 6 changed/created/removed files\n\nCompared with the pre-cleanup fingerprint snapshot, not dirty Git HEAD. Full package artifact paths are in `changed-files.json`.\n\n## Source / documentation / sample / tool changes\n\n'+''.join(f"- {c['change'].upper()}: `{c['path']}`\n" for c in sourceChanges)+f'\n{len(sourceChanges)} source/doc/sample/tool entries; {len(changed)} entries including generated evidence and local marker. No frozen Phase 1–5 file is changed.\n')

# Secret scan: configured exact values plus obvious credential/private-key assignments.
scanPaths={ROOT/c['path'] for c in changed if (ROOT/c['path']).is_file()}
scanPaths.update((ROOT/'docs').glob('*.md'));scanPaths.update((ROOT/'samples').rglob('*'));scanPaths.update([ROOT/'README.md',ROOT/'SECURITY.md'])
scanPaths={p for p in scanPaths if p.is_file() and p.name!='result-artifact-hashes.json'}
bad=[];assignment=re.compile(r'(?:HOST_GATEWAY_ADMIN_TOKEN|HOST_GATEWAY_SERVICE_TOKEN|BRIDGE_TOKEN|HOST_CAPABILITY_TOKEN|AI_GATEWAY_API_KEY|POSTGRES_PASSWORD)\s*[=:]\s*[\"\']?([A-Za-z0-9_\-]{24,})')
key=re.compile(r'(?:vck_|vca_|sk-proj-|AIza)[A-Za-z0-9_\-]{24,}')
for p in scanPaths:
 raw=p.read_bytes();value=raw.decode('utf-8',errors='replace')
 if any(s.encode() in raw for s in set(SECRETS)):bad.append({'file':p.relative_to(ROOT).as_posix(),'category':'configured credential value'})
 if assignment.search(value) or key.search(value) or re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',value):bad.append({'file':p.relative_to(ROOT).as_posix(),'category':'obvious credential/private-key pattern'})
assert not bad,[{'file':x['file'],'category':x['category']} for x in bad]
save('secret-scan.json',{'status':'PASS','filesScanned':len(scanPaths),'distinctConfiguredValuesChecked':len(set(SECRETS)),'configuredValueMatches':0,'obviousCredentialPatternMatches':0,'scope':'Phase 6 changed/new text, all docs and samples, README/SECURITY and full current Phase 6 package, including retained rerun logs. Dependency caches, populated env files and frozen previous packages are not republished or scanned as changes.','configuredValueMethod':'Exact non-example .env values for credential/password/token/secret keys, minimum length 8; includes independently generated local reproduction secrets.','additionalCategories':['provider-like keys','gateway/admin/service/bridge/capability credential assignments','PostgreSQL password assignments','private key markers'],'limitations':'Exact-value and obvious-pattern check, not proof against arbitrary encoding, future unknown credentials or universal PII.'})
md('secret-scan.md',f'# Secret scan\n\nPASS: {len(scanPaths)} files scanned against {len(set(SECRETS))} distinct configured values plus credential/private-key patterns. Zero matches. No secret values printed. Scope and detection limits are recorded in `secret-scan.json`.\n')

recon=load('cleanup-reconciliation.json')['counts'];claims=load('security-claim-audit.json');links=load('docs-link-audit.json');integrity=load('frozen-integrity.json');tests=load('test-summary.json')
testtable='| Suite | PASS | FAIL | SKIPPED |\n|---|---:|---:|---:|\n'+''.join(f"| {t['suite']} | {t['counts']['passed'] if t['counts'] else 'command check'} | {t['counts']['failed'] if t['counts'] else 0} | {t['counts']['skipped'] if t['counts'] else 0} |\n" for t in tests['suites'])
report=f'''# Phase 6 result

COMPLETE WITH LIMITATIONS

# Executive summary

- Resumed the existing cleanup; all 24 original candidates reconciled: 18 resolved, five intentionally retained, one already correct, zero unresolved.
- Current UI/source/help distinguish assistant context, enforced profiles and observed evidence; dead direct-broadcast wiring is removed.
- Five current samples use implemented behavior; retained live executions match exact current source text, including a Paper-confirmed host call.
- README/architecture/status/Jev/gVisor/OTel/demo/reproduction docs reflect completed findings and retain negative results.
- All 33 Phase 5 security claims audited: 33 consistent, 18 corrected/clarified, no evidence-class upgrade.
- Final directly relevant tests: 190 passed, zero failed, one local guarded DB skip separately passed deployed. Docker integration 22/22.
- Relative links/fragments: {links['totalChecked']} checked, {links['valid']} valid, zero broken. No arbitrary external availability probing.
- Frozen integrity: {integrity['checked']} hash comparisons matched, zero changed/missing, covering 958 unique files in Phase 1–5 directories plus overlapping original manifests.
- Manual walkthrough remains UNAVAILABLE after the previous Computer Use policy stop. No retry/bypass or manual visual acceptance claim.
- No commit/push, new capability, policy retuning, provider experiment, runtime benchmark or Phase 7 work.

# 1. Cleanup reconciliation

All 24 candidates are in `cleanup-reconciliation.json` and `.md`, retaining original IDs/classifications/locations, actual action, verification, final state and remaining issue. RESOLVED 18; INTENTIONALLY RETAINED 5; ALREADY CORRECT 1; UNRESOLVED 0. The already-disabled button was not misrepresented as an active bypass fix; dead wiring/control was removed. Historical migration 002, legacy mock heuristic, compatibility metadata/default mock option and dated evidence were retained intentionally.

# 2. UI truthfulness

SOURCE/TEST VALIDATED using current components/types, 13 frontend tests, typecheck, deployed asset strings and actual API/DB execution records. The UI represents execution outcome/provider/profile, stdout/stderr, permission observations, collection status/reasons, host request/queue/confirmed result, advisory classification and failed/unavailable/null assessment states separately. Zero observations includes explicit uncertainty. Settings guide assistant context; Run selects trusted grants. Manual walkthrough UNAVAILABLE; no layout/navigation acceptance is claimed. See `ui-truthfulness.md` and `deployed-ui-contract.json`.

# 3. Sample/API cleanup

Five samples: normal calculation/logging (`none`), caught restricted read (`none`), `/fixtures/allowed.txt` (`read-fixture`), `SANDBOX_DEMO_VALUE` (`env-demo`) and one-shot `host.chat.broadcast` (`host-chat`). Removed the obsolete host-status sample. Mock suggestions no longer invent player callbacks/status APIs; status goes to backend-only Server Info. Calculation executes at top level. Exact live sample IDs/profile/evidence are in `demo-validation.json`; no source changes were made after their successful live runs.

# 4. Execution/enforcement wording

Assistant/project settings are context intent. Trusted provider/profile and container manifest describe runtime enforcement. Collection status/reasons, observations and outcomes describe recorded evidence. Serialized `executionEnforcement` values remain read-only compatibility metadata, not live detection/grants. Explicit mock execution still simulates source; Docker actually runs stored JS/TS once. Docker fail-closed fallback behavior is documented as a design property, not a new outage experiment.

# 5. Jev documentation

Completed technically after Vercel account verification: pinned `typesafe-ai/jev-1.14.0`, 25 cases × five repetitions, 125 primary classifications, 16/25 modal agreement with researcher reference labels versus deterministic 24/25; 23/25 unanimous and two variable cases. No modal reference-agreement improvement demonstrated. Advisory only. Prior failures, policy/input/transformation/analyzer version 2 and negative comparison preserved. No live provider calls in Phase 6.

# 6. gVisor documentation

Native Ubuntu WSL2/Docker 29.9.3/runsc release-20261102.0 systrap; same image, 100 measured runtime-attested executions, 9/10 compatible workloads. W8 unchanged DNS incompatibility retained: runc Paper 5/5, runsc 0/5. Approximately 1.62–2.61x median ratios are comparable non-timeout workload/environment-specific end-to-end results, not universal overhead. Escape prevention NOT DEMONSTRATED. Normal demo remains runc; native shutdown intentional. No DNS fix/benchmark rerun.

# 7. OpenTelemetry documentation

PostgreSQL is durable application evidence/timeline/assessment/command correlation. OTel is best-effort reconstructed execution/sandbox.run/advisory/host observability, with non-durable collector debug output. Late Paper acknowledgements remain DB evidence, not a complete independent distributed Paper span. Phase 5 collector outage retained enforcement/authorization/DB evidence; not whole-system fault tolerance. These limits remain explicit.

# 8. Architecture / README / status documentation

Current client/API/DB/runner/Docker/Deno/optional gateway/authenticated enqueue/SecureBridge/Paper path and separate risk/telemetry paths are documented. README prioritizes local normal setup, truthful layers, current empirical status and links. `docs/RESEARCH-STATUS.md` indexes completed packages without Phase 7 interpretation. Historical preflight/publication/decision notes are labeled as dated/superseded, not erased. `documentation-consistency.json` records the cross-check.

# 9. Demo runbook validation

`docs/DEMO-RUNBOOK.md`: PASS for source/commands/contracts and retained real demo execution evidence. It needs runc, mock chat/deterministic risk and connected Paper, no Jev call/runsc/benchmark/failure injection. Default API3000/web5173 versus configured retained API13000/web15173 is explicit. Normal/caught/host flow and correlation routes checked. Mock calculation expects 4; current sample/stock script prints Hello and 4. Manual visual acceptance unavailable.

# 10. Reproduction validation

`docs/REPRODUCTION.md`: PASS for current configuration/routes, explicit secret generation, migration 010, Paper/plugin flow, test commands and links. Three Compose configurations validate without printing expanded secrets. Deployed migration rerun confirms all ten applied/skipped safely. Prior Phase 6 API/web build/deploy succeeded; deployed API/config source hashes match. Full fresh-data build is Phase 5 evidence, not a new resume build or published-HEAD/offline/no-cache guarantee. Gateway/runner behavior unchanged except two runner comments.

# 11. Security claim audit

33 checked, 33 consistent, 18 corrected/clarified during Phase 6, zero remaining inconsistent. Exact current file/line excerpts and retained Phase 5 classes/limits are in `security-claim-audit.json`/`.md`. No universal security, general detector accuracy, complete observability, runtime authority from AI settings, escape prevention or production recovery claim was introduced.

# 12. Stale-term audit

Current source/docs/config/samples/fixtures/contracts/tooling searched; each matching line classified CORRECT or HISTORICAL in `stale-term-audit.json`/`.md`. No unexplained active STALE occurrence. Old SDK terms remain only as immutable seed history, exact migration guards, negative tests or explicit legacy heuristic. Historical future plans remain dated. Two active future-gVisor runner comments and future-Jev evidence wording were corrected without functional changes.

# 13. Documentation links

PASS: {links['totalChecked']} checked, {links['valid']} valid, {links['broken']} broken. Includes local relative report/sample/setup/demo paths and Markdown fragments across README/SECURITY/docs/sample Markdown. {links['externalLinksNotProbed']} external links intentionally not probed. Local links do not imply uncommitted/ignored artifacts already exist at published HEAD.

# 14. Migration 010 validation

PASS: exact source/current-version/name/description guards supersede only untouched stock demos, preserve historical version-one source and skip user edits/advanced versions. Repeated SQL creates no duplicates. Existing safeguard test rerun in a disposable DB, then dropped; real deployed migration/test verified. No broadened matching or frozen-evidence rewrites. See `migration-validation.json`/`.md`.

# 15. Source-publication checklist

Exact pending-file inventory: SHOULD COMMIT {counts['SHOULD COMMIT']}; SHOULD NOT COMMIT {counts['SHOULD NOT COMMIT']}; LOCAL/SECRET {counts['LOCAL/SECRET']}; GENERATED/RESULTS {counts['GENERATED/RESULTS']}. This covers {publication['trackedChanges']} modified/deleted tracked, {publication['untrackedFiles']} untracked and {publication['ignoredFiles']} ignored files. Exact paths/categories and result-directory file counts/sizes/recommendations are in `publication-checklist.json`; human steps in `.md`. Unchanged tracked source is already at HEAD and not counted as pending. Recommendations only: no staging/commit/push, deletion, forced include or silent publication. Important Phase 1–6 integration remains uncommitted; full evidence archives versus selected small summaries require Phase 8 review.

# 16. Tests

{testtable}
PASS: 190 test cases, zero failed. Local API guarded DB test SKIPPED 1; same real PostgreSQL test separately PASS deployed. Typecheck/Compose/migration/claim/link/integrity/demo checks are not added to testcase totals. Gateway/Java suites SKIPPED because Phase 6 source/config is unchanged; Phase 5 results are historical, not counted as new passes. Runner 52 tests were rerun after comment-only corrections. Manual walkthrough UNAVAILABLE. No paid Jev or gVisor benchmark rerun. Final artifacts are under `resume-validation/`.

# 17. Frozen research integrity

PASS: {integrity['checked']} checked, {integrity['matched']} matched, 0 changed, 0 missing. This includes 958 unique files across Phase1 2, Phase1B 8, Phase2 23, Phase3 336, Phase4 494, Phase5 95, plus overlapping original manifests: Jev131/gVisor439/Phase5 94. No expected frozen file or previous hash was regenerated; no unexpected additions in those directories. `frozen-integrity.json` makes overlap explicit.

# 18. Secret scan

PASS: {len(scanPaths)} files checked against {len(set(SECRETS))} distinct configured values and obvious provider/gateway/service/bridge/capability/password/private-key patterns; zero matches. Values are never printed. Includes changed source/docs/samples and this full Phase 6 package. Exact-value/pattern scan is not universal PII/encoded-secret detection; scope is recorded.

# 19. Manual walkthrough

UNAVAILABLE. Previous Computer Use stopped due to uncertain browser URL; resume does not retry or bypass. Source/test/typecheck/deployed assets/contracts and unchanged live execution/DB evidence used instead. No manually visually verified claim.

# 20. Remaining limitations

Visual/layout/navigation acceptance remains unavailable; current uncommitted working-tree source is not published-HEAD reproducibility. Existing audit, advisory corpus, runtime compatibility/overhead, OTel, admission and production-recovery limits remain. Initial resume logging wrapper overwrote earlier Phase 6 exact suite logs before its module-global binding was corrected; original known outcomes and independently retained final reruns are documented in `validation-history.json`. No Phase 1–5 artifact was affected. A newline-only helper comparison was corrected to compare exact decoded source text used in API payloads; source/results were not changed to force agreement.

# 21. Remaining Phase 6 blockers

MUST FIX: none. ACCEPTABLE LIMITATION: manual walkthrough and explicitly retained evidence/generalization/observability limits, plus recorded Phase 6 logging provenance issue. PHASE 8 PACKAGING ONLY: source identity/commits, reviewed archive/summary publication, cache/secret exclusion and final clean-checkout links. Packaging is not a reason to block Phase 7; no Phase 7 work started.

# 22. Files created/changed

{len(sourceChanges)} source/doc/sample/tool entries compared with the original Phase 6 snapshot; complete repository-relative list is `changed-files.md`/`.json`. Generated package artifacts are also enumerated in the JSON. Key files: README; architecture/status/Jev/gVisor/OTel/context/demo/reproduction docs; UI App/Inspector/Settings/Help/client and affected tests; API chat/context/schema/test; guarded migration 010; assistant policy/project metadata; five samples/sample README; Compose comment and two runner comments; additive validation/audit/report tooling. Removed obsolete `samples/scripts/host-status-query.js`. Earlier phase source changes are separately included in the Git-based publication inventory.

# 23. Scope discipline

No new capability, events/persistent scripting, architecture redesign, classifier retuning, Jev policy/model/corpus change, runsc DNS fix, runtime, production auth, distributed queue or research experiment. No frozen Phase 1–5 edit, commit or push. No final research interpretation or Phase 7 synthesis.

# 24. Recommendation

Phase 6 is complete with disclosed limitations. Carry the same evidence classes and negative findings into later work. Stop here; Phase 7 has not begun.

READY FOR PHASE 7
'''
md('report.md',report)
# Re-scan final rendered artifacts (including report/publication/secret-scan text) before sealing.
for p in OUT.rglob('*'):
 if p.is_file():assert not any(value.encode() in p.read_bytes() for value in set(SECRETS)),p.name
seal={p.relative_to(OUT).as_posix():sha(p) for p in OUT.rglob('*') if p.is_file() and p.name!='result-artifact-hashes.json'}
save('result-artifact-hashes.json',{'algorithm':'sha256','excludesSelf':True,'files':seal})
assert len([line for line in report.splitlines() if line.startswith('# ')])==26
print(json.dumps({'result':'COMPLETE WITH LIMITATIONS','publicationCounts':dict(counts),'phase6SourceDocSampleToolChanges':len(sourceChanges),'phase6ArtifactCount':len(seal),'secretScanFiles':len(scanPaths),'configuredValuesChecked':len(set(SECRETS)),'recommendation':'READY FOR PHASE 7'}))
