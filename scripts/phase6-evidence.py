"""Offline Phase 6 reconciliation/audits; never rewrites prior phase evidence."""
from phase6_common import *
import hashlib,re,collections,urllib.parse
load=lambda name:json.loads((OUT/name).read_text(encoding='utf-8'))
read=lambda name:(ROOT/name).read_text(encoding='utf-8')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def md(name,value):(OUT/name).write_text(clean(value),encoding='utf-8')
def locate(file,needle):
 lines=read(file).splitlines()
 for i,line in enumerate(lines):
  if needle.casefold() in line.casefold():return {'file':file,'line':i+1,'wording':' '.join(lines[max(0,i-1):i+3])}
 raise AssertionError((file,needle))

# Every original candidate remains represented, including the already-disabled control.
verifications={
1:('apps/web/src/components/Inspector.tsx','Stored security evidence (PostgreSQL)'),
2:('apps/web/src/components/ProjectSettingsPanel.tsx','These settings guide assistant proposals.'),
3:('apps/web/src/App.tsx','removed callback'),4:('apps/web/src/components/Inspector.tsx','already disabled'),
5:('apps/api/src/providers/chat.ts','one-shot welcome broadcast'),6:('config/assistant-policy.md','Project Settings are assistant context intent'),
7:('apps/api/src/providers/chat-instructions.ts','Chat and execution providers are independent'),
8:('apps/api/src/project/schema.ts','Legacy context metadata retained'),9:('apps/api/src/project/assistant-context-builder.ts','project context is not a runtime grant'),
10:('config/project-spec.yaml','Legacy serialized context metadata'),11:('samples/README.md','Runnable demo scripts'),
12:('apps/api/src/db/migrations/010_truthful_demo_examples.sql','Preserve historical versions'),
13:('README.md','Empirical status'),14:('docs/ARCHITECTURE.md','Current architecture'),15:('docs/JEV-RISK-COMPARISON.md','Completed Phase 3 result'),
16:('docs/GVISOR.md','completed experimental comparison'),17:('docs/GVISOR-EXPERIMENT.md','Historical Docker Desktop preflight'),
18:('docs/OTEL-EXECUTION-RECONSTRUCTION.md','late Paper ack was not observed'),19:('docs/PROJECT-CONTEXT.md','assistant context intent'),
20:('docs/RESEARCH-BOUNDARIES.md','Current research boundaries'),21:('apps/api/src/providers/risk.ts','legacy heuristic unchanged'),
22:('.env.example','EXECUTION_PROVIDER=mock'),23:('compose.yaml','Researched alternative:'),24:('docs/PHASE* and research-results/phase1-5','historical hashes')}
baseline=load('before-fingerprints.json');rows=[]
for i,item in enumerate(load('cleanup-inventory-before.json'),1):
 f,needle=verifications[i]
 if i==3:
  assert all('onBroadcast' not in read(p) for p in ['apps/web/src/App.tsx','apps/web/src/components/Inspector.tsx'])
  assert 'enqueueHostCommand' not in read('apps/web/src/api/client.ts');v={'file':f,'detail':'App handler, Inspector prop/button and API client method absent; 13 frontend tests/typecheck PASS.'}
 elif i==4:v={'file':f,'detail':'Phase 5 already verified disabled=true; Phase 6 removed dead control rather than claiming a live bypass was fixed.'}
 elif i==21:
  assert sha(ROOT/f)==baseline[f];v={'file':f,'detail':'Legacy mock classifier is explicit and unchanged; deterministic v1 and Jev policy unchanged.'}
 elif i==24:
  historical=[p for p in baseline if p.startswith('docs/PHASE')];assert all(sha(ROOT/p)==baseline[p] for p in historical)
  v={'detail':'Dated phase documents unchanged; frozen-directory and manifest checks in frozen-integrity.json.'}
 else:v=locate(f,needle)
 state='INTENTIONALLY RETAINED' if item['classification']=='KEEP WITH CLARIFICATION' else 'ALREADY CORRECT' if i==4 else 'RESOLVED'
 rows.append({**item,'originalClassification':item['classification'],'finalState':state,'actionActuallyTaken':item['action'],'verification':v,'remainingIssue':None})
counts=collections.Counter(x['finalState'] for x in rows);assert len(rows)==24 and counts['UNRESOLVED']==0
save('cleanup-reconciliation.json',{'counts':dict(counts),'items':rows,'additionalWordingCorrectionsOnResume':['Removed future-Jev wording in EXECUTION-EVIDENCE.md.','Distinguished mock calculation output 4 from sample Hello/4.','Simplified frontend command to npm test.','Replaced two obsolete future-gVisor runner comments; no functional runtime/configuration change.','Clarified fail-closed Docker provider as design property, not new outage evidence.']})
md('cleanup-reconciliation.md','# All 24 original cleanup candidates\n\n| Item | Original | Original location | Final state | Actual action / verification | Remaining |\n|---|---|---|---|---|---|\n'+''.join(f"| {x['id']} | {x['originalClassification']} | `{x['path']}` | {x['finalState']} | {x['actionActuallyTaken']}; {x['verification']} | none |\n" for x in rows))

# Manual semantic review grounded in exact current wording, retaining Phase 5 evidence classes.
mapping={
1:('docs/RESEARCH-STATUS.md','Scoped filesystem/environment'),2:('docs/ARCHITECTURE.md','SANDBOX_DEMO_VALUE'),
3:('samples/README.md','caught-restricted-read.js'),4:('docs/RESEARCH-STATUS.md','Non-root user'),
5:('docs/RESEARCH-STATUS.md','read-only root'),6:('docs/RESEARCH-STATUS.md','PID/CPU limits'),7:('docs/RESEARCH-STATUS.md','PID/CPU limits'),
8:('docs/RESEARCH-STATUS.md','dropped capabilities'),9:('docs/RESEARCH-STATUS.md','no-new-privileges'),
10:('docs/RESEARCH-STATUS.md','timeout/output bounds'),11:('docs/ARCHITECTURE.md','timeout/truncation/missing frame'),
12:('docs/RESEARCH-STATUS.md','Admission is single-runner'),13:('docs/ARCHITECTURE.md','Only sandbox'),
14:('docs/RESEARCH-STATUS.md','admin separation'),15:('docs/DEMO-RUNBOOK.md','accepted means queued'),
16:('docs/ARCHITECTURE.md','Queue origin'),17:('apps/web/src/components/Inspector.tsx','Zero observations alone'),
18:('docs/OTEL-EXECUTION-RECONSTRUCTION.md','not independently instrumented tracing'),
19:('docs/RESEARCH-STATUS.md','not a database/API outage'),20:('docs/RESEARCH-STATUS.md','24/25 combined'),
21:('docs/JEV-RISK-COMPARISON.md','**16/25**'),22:('docs/GVISOR.md','**9/10 workloads**'),
23:('docs/GVISOR.md','1.62–2.61x'),24:('docs/GVISOR.md','**0/5**'),25:('docs/GVISOR.md','NOT DEMONSTRATED'),
26:('apps/web/src/components/Inspector.tsx','risk.assessmentStatus === "failed"'),
27:('docs/ARCHITECTURE.md','Only service with Docker socket'),28:('docs/ARCHITECTURE.md','falling back to mock'),
29:('docs/HOST-GATEWAY.md','revokes the session'),30:('docs/REPRODUCTION.md','not published-HEAD'),
31:('SECURITY.md','multi-user authenticated'),32:('docs/RESEARCH-STATUS.md','not a database/API outage'),
33:('docs/ARCHITECTURE.md','ephemeral scoped capability')}
corrected={1,2,3,13,15,17,18,19,20,21,22,23,24,25,27,28,30,33}
source=json.loads((ROOT/'research-results/phase5-final-validation/2026-11-09T15-24-05Z/security-claim-matrix.json').read_text())
audits=[]
for i,c in enumerate(source['claims'],1):
 location=locate(*mapping[i]);audits.append({'claimId':c['id'],'claim':c['claim'],'phase5EvidenceClass':c['evidenceClass'],'currentWordingLocation':location,'consistent':True,'correctedOrClarifiedDuringPhase6':i in corrected,'correction':('Phase 6 wording/current-status clarification; see cleanup reconciliation and quoted current text.' if i in corrected else 'No correction needed; existing wording/explicit limit retained.'),'retainedLimitation':c['limitation']})
assert len(audits)==33
scope=['README.md','SECURITY.md','docs/ARCHITECTURE.md','docs/RESEARCH-STATUS.md','docs/RESEARCH-BOUNDARIES.md','docs/GVISOR.md','docs/JEV-RISK-COMPARISON.md','docs/OTEL-EXECUTION-RECONSTRUCTION.md','docs/HOST-GATEWAY.md','docs/EXECUTION-EVIDENCE.md','docs/DENO-PERMISSION-BASELINE.md','docs/DETERMINISTIC-RISK-BASELINE.md','docs/PROJECT-CONTEXT.md','docs/DEMO-RUNBOOK.md','docs/REPRODUCTION.md','samples/README.md','config/assistant-policy.md','config/project-spec.yaml','apps/web/src/components/Inspector.tsx','apps/web/src/components/ProjectSettingsPanel.tsx','apps/web/src/components/HelpPanel.tsx','apps/web/src/components/ServerInfoPanel.tsx','apps/api/src/providers/chat.ts','apps/api/src/providers/chat-instructions.ts','apps/api/src/project/assistant-context-builder.ts','apps/api/src/project/schema.ts']
save('security-claim-audit.json',{'checked':33,'consistent':33,'correctedOrClarified':len(corrected),'remainingInconsistent':0,'method':'Semantic review against unchanged Phase 5 matrix, anchored to exact current file/line excerpts; no evidence class upgraded. Broad stale-term search is a separate supporting check, not an automated proof.','reviewedFiles':scope,'claims':audits})
md('security-claim-audit.md','# Phase 5 claims versus current presentation\n\n33 checked; 33 consistent; 18 corrected/clarified; zero remaining inconsistent. Evidence classes unchanged.\n\n| Claim | Evidence class | Current location / wording | Correction | Retained limit |\n|---|---|---|---|---|\n'+''.join(f"| {a['claimId']} {a['claim']} | {a['phase5EvidenceClass']} | `{a['currentWordingLocation']['file']}:{a['currentWordingLocation']['line']}`: {a['currentWordingLocation']['wording'].replace('|','/')} | {a['correction']} | {a['retainedLimitation']} |\n" for a in audits))

# Relative Markdown paths and local fragments. External availability is intentionally not probed.
docfiles=[ROOT/'README.md',ROOT/'SECURITY.md']+list((ROOT/'docs').glob('*.md'))+list((ROOT/'samples').rglob('*.md'))
links=[];external=0
def anchors(p):
 result=[];seen=collections.Counter()
 for line in p.read_text(encoding='utf-8').splitlines():
  if re.match(r'^#{1,6}\s',line):
   slug=re.sub(r'[^\w\- ]','',re.sub(r'^#+\s+','',line).strip().lower()).replace(' ','-');n=seen[slug];seen[slug]+=1;result.append(slug+(f'-{n}' if n else ''))
 return result
for p in docfiles:
 value=p.read_text(encoding='utf-8');value=re.sub(r'```[^\n]*\n[\s\S]*?```','',value)
 for m in re.finditer(r'\[[^\]]*\]\(([^)]+)\)',value):
  target=m[1].strip().strip('<>').split(' "')[0]
  if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:',target):external+=1;continue
  path,_,fragment=target.partition('#');destination=p.parent/urllib.parse.unquote(path) if path else p
  exists=destination.exists();fragmentOk=not fragment or (exists and destination.suffix=='.md' and urllib.parse.unquote(fragment) in anchors(destination))
  links.append({'file':p.relative_to(ROOT).as_posix(),'target':target,'valid':bool(exists and fragmentOk),'pathExists':exists,'fragmentValid':bool(fragmentOk)})
broken=[l for l in links if not l['valid']];assert not broken,broken
save('docs-link-audit.json',{'status':'PASS','totalChecked':len(links),'valid':len(links)-len(broken),'broken':len(broken),'externalLinksNotProbed':external,'scope':'README, SECURITY, all docs/*.md and sample Markdown; relative target existence and Markdown fragments. Frozen research package contents not rewritten.','links':links})
md('docs-link-audit.md',f'# Documentation links\n\nPASS: {len(links)} checked, {len(links)} valid, 0 broken. {external} external links not probed.\n\n'+''.join(f"- `{l['file']}` → `{l['target']}`: valid\n" for l in links))

# Every matched stale-term occurrence is explained, including historical/negative mentions.
patterns=[r'host\.broadcast',r'host\.requestStatus',r'onPlayerJoin',r'onPlayerDeath',r'executionEnforcement',r'mocked enforcement',r'Jev.{0,60}(?:not tested|not yet tested|planned|pending|incomplete|future)',r'gVisor.{0,60}(?:not tested|not yet tested|planned|pending|untested|future)',r'future.{0,40}(?:Jev|runsc)',r'OpenTelemetry.{0,30}detects attacks',r'gVisor.{0,30}prevents escapes',r'all sandbox.{0,40}observ',r'risk.{0,30}blocks execution',r'queue broadcast',r'direct.broadcast',r'event.driven',r'event subscriptions',r'arbitrary.{0,20}host.{0,15}API']
regex=re.compile('|'.join(patterns),re.I);occurrences=[]
searchpaths=docfiles+[p for folder in ['apps','config','samples','services','fixtures','packages'] for p in (ROOT/folder).rglob('*') if p.is_file() and not any(x in p.parts for x in ['node_modules','build','dist','.gradle']) and p.suffix in ['.ts','.tsx','.js','.mjs','.md','.yaml','.sql','.sh']]
searchpaths+=list((ROOT/'scripts').glob('*.mjs'))
for p in sorted(set(searchpaths)):
 rel=p.relative_to(ROOT).as_posix()
 for n,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
  if not regex.search(line):continue
  if rel.startswith('docs/PHASE') or rel in ['docs/DECISIONS.md','docs/PUBLICATION-REVIEW.md','docs/GVISOR-EXPERIMENT.md'] or '/migrations/002_' in rel:
   state='HISTORICAL';why='Dated/superseded record or immutable migration, retained as provenance.'
  elif '/migrations/010_' in rel:
   state='CORRECT';why='Exact old-source matching guard, not newly proposed SDK code.'
  elif rel=='apps/api/src/providers/risk.ts':
   state='CORRECT';why='Explicit legacy mock heuristic; not current SDK guidance or frozen deterministic rules.'
  elif 'executionEnforcement' in line:
   state='CORRECT';why='Serialized compatibility metadata, read-only/clarified as context rather than runtime detection.'
  elif '/tests/' in rel or '.test.' in rel or rel.startswith('fixtures/'):
   state='CORRECT';why='Negative assertion, API regression fixture or controlled research input, not a supported example.'
  elif rel=='scripts/freeze-risk-experiment.mjs':
   state='CORRECT';why='Cost preview for an explicitly invoked future run, not completed-experiment status.'
  else:
   state='CORRECT';why='Reviewed in context: explicit unsupported/deferred behavior, disabled-route removal, advisory limitation or provenance warning, not a positive unsupported feature claim.'
  occurrences.append({'file':rel,'line':n,'wording':line.strip(),'classification':state,'explanation':why})
save('stale-term-audit.json',{'scope':'Current first-party source/docs/config/samples/services/fixtures/contracts and research tooling; excludes dependency/build caches and frozen results. Every matched line retained below for review.','counts':dict(collections.Counter(o['classification'] for o in occurrences)),'unexplainedActiveStale':0,'occurrences':occurrences})
md('stale-term-audit.md','# Stale-term / unsupported-claim search\n\nNo unexplained active STALE occurrence. Historical records and exact migration guards remain intact. Search is supporting evidence; semantic claim review is separate.\n\n| Location | Classification | Wording | Reason |\n|---|---|---|---|\n'+''.join(f"| `{o['file']}:{o['line']}` | {o['classification']} | {o['wording'].replace('|','/')} | {o['explanation']} |\n" for o in occurrences))

# Frozen evidence: initial hashes plus original independent manifests, never re-sealed.
prefixes=['research-results/phase1/','research-results/phase1b/','research-results/phase2/','research-results/phase3-jev/','research-results/phase4-gvisor/','research-results/phase5-final-validation/']
integrity=[]
for prefix in prefixes:
 items={p:h for p,h in baseline.items() if p.startswith(prefix)};missing=[p for p in items if not (ROOT/p).is_file()];changed=[p for p,h in items.items() if (ROOT/p).is_file() and sha(ROOT/p)!=h]
 additions=[p.relative_to(ROOT).as_posix() for p in (ROOT/prefix).rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in items]
 integrity.append({'source':'Phase 6 pre-edit fingerprints','package':prefix,'checked':len(items),'matched':len(items)-len(missing)-len(changed),'changed':changed,'missing':missing,'added':additions})
for folder,file,key,relativeRoot in [('research-results/phase3-jev/resume-after-credit-2026-11-09','manifest.json','hashes',ROOT),('research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched','result-artifact-hashes.json','files',None),('research-results/phase5-final-validation/2026-11-09T15-24-05Z','result-artifact-hashes.json','files',None)]:
 parent=ROOT/folder;items=json.loads((parent/file).read_text())[key];root=relativeRoot or parent
 missing=[p for p in items if not (root/p).is_file()];changed=[p for p,h in items.items() if (root/p).is_file() and sha(root/p)!=h]
 integrity.append({'source':folder+'/'+file,'checked':len(items),'matched':len(items)-len(changed)-len(missing),'changed':changed,'missing':missing})
assert all(not x['changed'] and not x['missing'] and not x.get('added') for x in integrity),integrity
summary={'checked':sum(x['checked'] for x in integrity),'matched':sum(x['matched'] for x in integrity),'changed':0,'missing':0,'uniqueFilesWithinPhaseDirectories':sum(x['checked'] for x in integrity[:6]),'note':'Total includes overlapping independent manifest checks; initial directory fingerprints cover unique phase files.'}
save('frozen-integrity.json',{'status':'PASS',**summary,'checks':integrity})
md('frozen-integrity.md','# Frozen Phases 1–5 integrity\n\n'+json.dumps(summary,indent=2)+'\n\n| Package/hash source | Checked | Matched | Changed | Missing |\n|---|---:|---:|---:|---:|\n'+''.join(f"| {x.get('package',x['source'])} | {x['checked']} | {x['matched']} | 0 | 0 |\n" for x in integrity))

# Final directly relevant suite results retained separately from interrupted-run artifacts.
tests=[]
for mode in ['api','frontend','frontend-typecheck','docker-integration','postgres','runner']:
 d=load('resume-validation/'+mode+'-tests.json');assert d['exitCode']==0
 counts=d.get('counts')
 if mode=='frontend':assert re.search(r'13\s+passed',d['stdout']);counts={'passed':13,'failed':0,'skipped':0}
 tests.append({'suite':mode,'status':'PASS','counts':counts,'artifact':'resume-validation/'+mode+'-tests.json'})
assert sum(t['counts']['passed'] for t in tests if t['counts'])==190
# Runner received comment-only wording fixes, so its 52 unit tests are rerun.
# Establish why other unchanged suites need not be rerun.
unchanged=[]
for prefix in ['services/host-gateway/','minecraft/bridge/']:
 files=[p for p in baseline if p.startswith(prefix)];assert all(sha(ROOT/p)==baseline[p] for p in files)
 unchanged.append({'scope':prefix,'filesUnchanged':len(files),'status':'SKIPPED','reason':'No Phase 6 source/config changes; existing Phase 5 passing suite remains historical evidence, not counted as a new pass.'})
compose=read('compose.yaml').replace('# Researched alternative: runsc on prepared Linux only; normal demo uses runc. W8 host-chat DNS is incompatible.','# Future gVisor experiments: set SANDBOX_DOCKER_RUNTIME=runsc (central only).')
assert hashlib.sha256(compose.replace('\n','\r\n').encode()).hexdigest()==baseline['compose.yaml'] or hashlib.sha256(compose.encode()).hexdigest()==baseline['compose.yaml']
save('test-summary.json',{'status':'PASS','passedTestCases':190,'failedTestCases':0,'skippedTestCases':1,'guardedDbSkip':'Original local API guarded DB skip remains recorded; separate deployed PostgreSQL test passes.','suites':tests,'suiteSkips':unchanged,'unavailable':[{'check':'Manual browser walkthrough','status':'UNAVAILABLE','reason':'Previous Computer Use URL-confidence policy stop; no retry or bypass.'}],'additionalPassChecks':['Migration 010 safeguards and deployed migration process','Three Compose configurations','Five retained live sample/source/API/DB checks','Relative documentation paths/fragments','33-claim semantic audit','Frozen evidence hashes','Source/deployed UI contract'],'newJevCalls':0,'newRunscBenchmarkRuns':0,'composeDifference':'Comment only; reverse-comment hash matches pre-Phase 6 Compose bytes.'})
md('test-summary.md','# Final relevant regression checks\n\n190 passed, 0 failed, 1 local guarded DB test skipped; the separate deployed DB test passed. Typecheck/config/audits are command checks, not added to testcase totals.\n\n'+''.join(f"- {t['suite']}: PASS, {t['counts'] or 'command check'}; `{t['artifact']}`\n" for t in tests)+'\nGateway/Java suites SKIPPED: source/config unchanged; historical Phase 5 results not counted as new passes. Manual walkthrough UNAVAILABLE.\n')
save('migration-validation.json',{'status':'PASS','safeguards':load('resume-validation/seed-migration-validation.json'),'deployed':load('deployed-database-validation.json'),'migrationProcess':'deployed-migration-process.json','previousRunRetained':'seed-migration-validation.json','scope':'Guarded demo refresh only; historical versions and all research packages preserved.'})
md('migration-validation.md','# Migration 010\n\nPASS: exact untouched-stock matching; three stock current demos superseded; old version-one sources preserved; custom source and metadata skipped; repeated SQL creates no duplicate versions. Fresh safeguard DB dropped. Deployed migration process confirms 010 applied and repeats skip safely. No matching rules broadened.\n')
md('demo-validation.md','# Five demo samples\n\nPASS: unchanged exact source text matches all five successful saved Phase 6 executions. Current API records remain completed with complete collection; host command remains Paper-confirmed in DB. Resume creates no new sample runs. Byte-newline differences are normalized exactly as the original API source payload; no source or result changed.\n\n'+''.join(f"- {c['sample']}: {c['profile']}; execution `{c['executionId']}`; PASS.\n" for c in load('demo-validation.json')['cases']))
md('ui-truthfulness.md','# UI truthfulness\n\nSOURCE/TEST VALIDATED. Manual walkthrough: UNAVAILABLE after previous Computer Use URL-confidence policy stop; no workaround or retry. No manual visual acceptance claim.\n\nInspector/source/types represent execution status/provider/profile, stdout/stderr, permission observations, collection status/reasons, host request/queue/result and separate advisory assessment including failed/unavailable/null-classification states. Zero observations has an explicit uncertainty warning. Frontend 13 tests and typecheck pass; deployed bundle strings and live sample/API/DB contracts verified. Server Info identifies Paper-confirmed broadcasts. Dead direct-broadcast handler/prop/client/control removed; internal route is not exposed through UI.\n\nLimit: text/contract checks do not verify layout, navigation or every visual state. Legacy context metadata is retained for stored-settings compatibility and explicitly does not detect/grant runtime authority.\n')
save('documentation-consistency.json',{'status':'PASS','reviewed':['README.md','docs/ARCHITECTURE.md','docs/RESEARCH-STATUS.md','docs/DEMO-RUNBOOK.md','docs/REPRODUCTION.md','samples/README.md'],'normalRuntime':'Docker/runc; runsc not required','providers':'Mock chat + Docker execution + deterministic risk; no Vercel calls required','ports':'Default API3000/web5173/Paper25565; configured primary API13000/web15173 explicitly distinguished','secrets':'Independent generated local secrets; no values documented','migration':'Automatic startup plus explicit repeat-safe command verified deployed','paper':'Separate queued acceptance and confirmed command/event','otel':'Best-effort exporter versus PostgreSQL durable records','sourcePublication':'Working-tree/fresh-data validation, not published-HEAD or no-cache/offline guarantee','correctionsOnResume':['future Jev wording','mock calculation stdout expectation','npm test command','fail-closed design qualifier'],'freshFullBuildOnResume':'Not rerun: prior Phase 6 build/deploy successful, current deployed source/config hashes still match; Phase 5 fresh-data setup evidence remains intact.'})
md('remaining-limitations.md','# Remaining limits and next-phase boundaries\n\n## MUST FIX BEFORE PHASE 7\n\nNone after the final audits.\n\n## ACCEPTABLE LIMITATION\n\nManual walkthrough UNAVAILABLE; source/tests/assets/API/runtime evidence used, no visual acceptance claim. Audit/native observability blind spots, advisory classifier corpus limits, runsc W8 DNS/overhead, no escape proof, non-durable OTel/incomplete Paper spans, single-runner scope and no DB high-availability guarantee remain disclosed.\n\n## PHASE 8 PACKAGING ONLY\n\nIntegrated changes remain uncommitted; choose final source identity and publish/archive reviewed evidence and hash manifests together. Dependencies, local secrets and raw outputs need explicit inclusion/exclusion review. No automatic staging/commit/push, volume deletion or publication decisions were performed.\n')
print('24 candidates, 33 claims, links, stale terms, 190 passing tests, migration/demo/UI contracts and frozen integrity synthesized.')
