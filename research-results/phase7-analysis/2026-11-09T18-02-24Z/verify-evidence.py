"""Read-only reanalysis of saved artifacts; writes only this new Phase 7 package."""
from pathlib import Path
import json,hashlib,collections,statistics
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
P3='research-results/phase3-jev/resume-after-credit-2026-11-09'
P4='research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched'
P5='research-results/phase5-final-validation/2026-11-09T15-24-05Z'
P6='research-results/phase6-cleanup/2026-11-09T16-10-39Z'
sources={}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(path):
 p=ROOT/path;sources[path]=sha(p);return json.loads(p.read_text(encoding='utf-8'))
def save(name,data):(OUT/name).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def md(name,text):(OUT/name).write_text(text,encoding='utf-8')
classification=load(P5+'/security-claim-matrix.json');assert len(classification['claims'])==33
det=load(P3+'/deterministic-replay.json');assert len(det)==25
agreements={p:sum(c['classification']==c['reference'] for c in det if c['partition']==p) for p in ['closed_development','holdout_variant']}
misses=[c['caseId'] for c in det if c['classification']!=c['reference']];assert misses==['HOL-008']
raw=[]
for file in sorted((ROOT/P3).glob('result-primary-*.json')):
 row=load(file.relative_to(ROOT).as_posix());assert row['stage']=='primary' and row['technicallyValid'] and row['httpStatus']==200
 assert row['result']['status']=='ok' and row['result']['providerMetadata']['responseModel']=='typesafe-ai/jev-1.14.0'
 raw.append(row)
assert len(raw)==125
cases=load(P3+'/per-case-analysis.json');assert len(cases)==25
labels={c['caseId']:c['reference'] for c in cases};bycase=collections.defaultdict(list)
for row in raw:bycase[row['caseId']].append(row)
assert len(bycase)==25 and all(len(rs)==5 and {r['round'] for r in rs}=={1,2,3,4,5} for rs in bycase.values())
mode={cid:collections.Counter(r['result']['classification'] for r in rs).most_common(1)[0] for cid,rs in bycase.items()}
individual=sum(r['result']['classification']==labels[r['caseId']] for r in raw)
modal=sum(c==labels[cid] for cid,(c,n) in mode.items());stable=sum(n==5 for c,n in mode.values());ownmode=sum(n for c,n in mode.values())
assert (individual,modal,stable,ownmode)==(84,16,23,121)
analysis=load(P3+'/analysis.json');assert analysis['comparison']['jev_only']==0
assert analysis['referenceAgreement']['combined']['individual']['numerator']==individual and analysis['repeatability']['pooledCallsMatchingOwnCaseMode']['numerator']==ownmode
sensitivity=[load(p.relative_to(ROOT).as_posix()) for p in sorted((ROOT/P3).glob('result-sensitivity-*.json'))]
smoke=[load(p.relative_to(ROOT).as_posix()) for p in sorted((ROOT/P3).glob('smoke-SCN-*.json'))]
failures=load(P3+'/failure-log.json');assert len(sensitivity)==15 and len(smoke)==3 and len(failures)==1 and failures[0]['httpStatus']==403
assert all(r['httpStatus']==200 and r['parsingStatus']=='valid' and r['modelProvenanceValid'] and r['result']['status']=='ok' for r in sensitivity+smoke)
manifest=load(P3+'/manifest.json');assert manifest['repetitions']==5 and manifest['maxAttempts']==150
frozen=[load(p.relative_to(ROOT).as_posix()) for p in sorted((ROOT/'research-results/risk-comparison/frozen-evidence-v1').glob('*.json'))]
languages=dict(collections.Counter(x['evidence']['script']['language'] for x in frozen));assert languages=={'javascript':25}
hol=next(x for x in frozen if x['scenarioId']=='HOL-008');assert hol['evidence']['permissions']['accesses']==[] and hol['evidence']['permissions']['failureCategory'] is None
devLabels=load('fixtures/scenarios/manifest.json');holdLabels=load('fixtures/scenarios/holdout-manifest.json');load('fixtures/scenarios/sensitivity.json')
referenceMap={x['id']:x['expectedResearchLabel'] for m in [devLabels,holdLabels] for x in m['scenarios']}
assert referenceMap==labels
assert all(x['referenceLabel']==labels[x['scenarioId']] for x in frozen)
detMap={c['caseId']:c['classification'] for c in det}
comparison=collections.Counter(('both_match' if detMap[cid]==labels[cid] and cls==labels[cid] else 'deterministic_only' if detMap[cid]==labels[cid] else 'jev_only' if cls==labels[cid] else 'neither_match') for cid,(cls,n) in mode.items())
assert all(analysis['comparison'][k]==comparison[k] for k in ['both_match','deterministic_only','jev_only','neither_match'])
measured=[load(p.relative_to(ROOT).as_posix()) for p in sorted((ROOT/P4/'measured-runs').glob('*.json'))]
assert len(measured)==100 and all(r['runtimeEvidenceStatus']=='ATTESTED' and not r['infrastructureInvalid'] for r in measured)
groups=collections.Counter((r['workloadId'],r['runtime']) for r in measured);assert len(groups)==20 and set(groups.values())=={5}
performance=load(P4+'/performance-summary.json');compat=load(P4+'/compatibility-matrix.json');a4=load(P4+'/analysis.json')
timings=[]
for row in performance:
 for runtime in ['runc','runsc']:
  values=[r['result']['durationMs'] for r in measured if r['workloadId']==row['workloadId'] and r['runtime']==runtime and r['semanticSuccess']]
  assert len(values)==row['runtimeStats'][runtime]['n']
  if values:
   assert statistics.median(values)==row['runtimeStats'][runtime]['median'] and statistics.mean(values)==row['runtimeStats'][runtime]['mean']
   assert min(values)==row['runtimeStats'][runtime]['min'] and max(values)==row['runtimeStats'][runtime]['max']
 timings.append({'workloadId':row['workloadId'],'runcMedianMs':row['runtimeStats']['runc']['median'],'runscMedianMs':row['runtimeStats']['runsc']['median'],'medianRatio':row['medianRatio'],'note':row['note']})
assert sum(c['verdict']=='COMPATIBLE' for c in compat)==9
w8=[r for r in measured if r['workloadId']=='W8'];assert all(r['semanticSuccess'] for r in w8 if r['runtime']=='runc')
assert all(not r['semanticSuccess'] and 'dns error' in r['result']['stderr'] for r in w8 if r['runtime']=='runsc')
host=load(P4+'/host-chat-results.json');assert sum(h['stage']=='measured' and h['runtime']=='runc' and h['confirmed'] for h in host['results'])==5
assert sum(h['stage']=='measured' and h['runtime']=='runsc' and h['confirmed'] for h in host['results'])==0
dns=load(P4+'/post-experiment-dns-diagnostic.json');assert dns['directIpHealthSucceeded'] and not dns['primaryMeasurement']
load(P4+'/resource-validation.json');evidenceComparison=load(P4+'/permission-evidence-comparison.json')
load(P4+'/experiment-manifest.json');load(P4+'/environment.json')
p1=load('research-results/phase1/checks.json');p1b=load('research-results/phase1b/summary.json')
p2=load('research-results/phase2/summary.json');controls=load('research-results/phase2/control-matrix.json')
osprobe=load('research-results/phase2/docker-controls.json');resource=load('research-results/phase2/concurrency-runtime.json')
assert resource['memory']['body']['oomKilled'] and resource['memory']['body']['exitCode']==137
advisory=load('research-results/phase2/analysis-failure.json');assert advisory['execution']['status']=='completed' and advisory['risk']['items'][0]['classification'] is None
load('research-results/phase2/startup-blocked.json');load('research-results/phase2/startup-recovered.json');load('research-results/phase2/failure-matrix/cleanup.json')
core=load(P5+'/core-execution-matrix.json');assert len(core)==8 and all(c['verdict']=='PASS' for c in core)
e8=load(P5+'/executions/E8.json');assert e8['hostConfirmed'] and e8['hostCommands'][0]['result']['success']
outage=load(P5+'/collector-outage.json');assert all(outage[k] for k in ['collectorStopped','scriptRestrictionRetained','hostAuthorizationAndPaperConfirmed','postgresEvidencePersisted','exportErrorObservable'])
admission=load(P5+'/admission-regression.json');assert admission['extra']['http']==429 and admission['capacity']==2 and admission['final']['admission']['active']==0
otel=load(P5+'/otel-validation.json');assert all(otel['traces'][c]['collectorTraceReceipt'] for c in ['E1','E8'])
assert not otel['traces']['E8']['latePaperConfirmationInRootExport']
clean=load(P5+'/clean-setup.json');assert clean['status']=='PASS' and len(clean['cases'])==3 and clean['noPreviousVolumesReused']
t5=load(P5+'/tests.json');t6=load(P6+'/test-summary.json');assert t5['testCasesPassed']==217 and t6['passedTestCases']==190
assert t5['testCasesFailed']==t6['failedTestCases']==0
load(P5+'/security-boundaries.json');load(P5+'/final-blocker-assessment.json');b6=load(P6+'/final-blocker-assessment.json');assert not b6['MUST_FIX']
load(P6+'/security-claim-audit.json');load(P6+'/documentation-consistency.json');load(P6+'/validation-history.json')
for path in ['docs/RESEARCH-STATUS.md','docs/ARCHITECTURE.md','docs/RESEARCH-BOUNDARIES.md','docs/PHASE2-EXECUTION-RELIABILITY.md','README.md']:
 sources[path]=sha(ROOT/path)
# Verify sealed packages without comparing old run-time source snapshots to legitimate Phase 6 presentation edits.
seals=[]
for folder,file,key,root in [(P3,'manifest.json','hashes',ROOT),(P4,'result-artifact-hashes.json','files',ROOT/P4),(P5,'result-artifact-hashes.json','files',ROOT/P5),(P6,'result-artifact-hashes.json','files',ROOT/P6)]:
 seal=load(folder+'/'+file)[key];assert all((root/p).is_file() and sha(root/p)==h for p,h in seal.items())
 seals.append({'manifest':folder+'/'+file,'checked':len(seal),'matched':len(seal),'changed':0,'missing':0})
facts={'deterministic':{'cases':len(det),'developmentAgreement':agreements['closed_development'],'developmentN':15,'holdoutAgreement':agreements['holdout_variant'],'holdoutN':10,'combinedAgreement':sum(agreements.values()),'mismatches':misses,'frozenLanguageCounts':languages},
 'jev':{'model':'typesafe-ai/jev-1.14.0','policyVersion':manifest['provenance']['policyVersion'],'policyHash':manifest['provenance']['policyHash'],'cases':25,'repetitions':5,'primaryClassifications':len(raw),'unanimousCases':stable,'ownCaseModeMatches':ownmode,'individualReferenceAgreement':individual,'modalReferenceAgreement':modal,'comparison':analysis['comparison'],'unstableCases':analysis['repeatability']['unstableCases'],'sensitivityCalls':len(sensitivity),'sensitivityClassificationStableCases':sum(x['sameClassAcrossVariants'] for x in analysis['sensitivity']),'sensitivityCases':len(analysis['sensitivity']),'sensitivityVariantDifference':'SCN-010 canonical/reordered review; compact_notes high. These are 3 presentations on each of 5 preselected cases, not 15 independent cases.','historicalProviderFailures':len(failures),'historicalFailureHttp':403,'successfulSmokeCalls':len(smoke),'totalProviderAttempts':len(raw)+len(sensitivity)+len(smoke)+len(failures),'automaticRetries':analysis['accounting']['automaticRetries'],'primaryLatencyMs':analysis['latency']['primarySuccess'],'unstableCaseConfidence':analysis['confidence']['unstableCases'],'denominatorWarning':'125 calls are repeated measurements of 25 cases; 121/125 mode matches are not reference agreement.'},
 'gvisor':{'workloads':len(compat),'repetitionsPerRuntimeWorkload':5,'measuredExecutions':len(measured),'allMeasuredRuntimeAttested':True,'compatibleWorkloads':9,'runcW8Confirmed':a4['hostChat']['runc']['measuredConfirmed'],'runscW8Confirmed':a4['hostChat']['runsc']['measuredConfirmed'],'processStatusCounts':dict(collections.Counter(r['executionStatus'] for r in measured)),'expectedSemanticSuccesses':sum(r['semanticSuccess'] for r in measured),'infrastructureInvalid':0,'reruns':a4['accounting']['reruns'],'timings':timings,'dnsMechanism':'Measured hostname failures plus separate direct-IP health diagnostic support DNS-specific incompatibility; diagnostic uses a different BusyBox image, not successful Host SDK/Paper confirmation.','escapeTesting':'NOT DEMONSTRATED'},
 'finalValidation':{'coreCases':8,'corePassed':8,'paperConfirmed':True,'collectorOutageRestrictionsRetained':True,'admissionCapacity':2,'overflowHttp':429,'freshDataCasesPassed':3,'phase5TestsPassed':217,'phase5TestsFailed':0,'phase6RelevantTestsPassed':190,'phase6TestsFailed':0,'phase5LocalGuardedDbSkip':t5['localApiGuardedTestSkipped'],'phase6LocalGuardedDbSkip':t6['skippedTestCases'],'manualWalkthrough':'UNAVAILABLE','mustFixResearchBlockers':0},
 'scopeClarifications':[{'id':'SC-01','issue':'All 25 frozen classifier records declare language=javascript.','treatment':'Do not present classifier agreement as a dedicated 25-case TypeScript study; W2 typed TypeScript execution is separate direct runtime evidence.'},
 {'id':'SC-02','issue':'Phase 2 records behavioral non-root/read-only/OOM probes, whereas Phase 5 CLM-04/05/06 classify final control claims CONFIGURATION VERIFIED.','treatment':'Preserve authoritative Phase 5 classes. Describe historical controlled OS/OOM observations as bounded supplementary subclaims, not an upgrade to general control effectiveness.'},
 {'id':'SC-03','issue':'W6 is expected termination, W8 runsc is incompatible.','treatment':'Do not describe 100 measured jobs as 100 successful completed scripts; 85 completed, 10 terminated, 5 failed. Exclude W6/W8 from useful-work comparable ratio range.'},
 {'id':'SC-04','issue':'No current official subquestions found in repository text search.','treatment':'Disclose documentation issue; use explicitly analytical themes, not invented official questions.'},
 {'id':'SC-05','issue':'Historical classifier evidence lacks explicit auditCollection; current Jev transformation marks legacy_unknown.','treatment':'Do not retroactively label old quiet records complete; distinguish Phase 5 collection checks.'},
 {'id':'SC-06','issue':'Phase 2 cleanup artifact displays a local admission counter while unit test separately asserts shared blocked flag.','treatment':'Use stored passing failure-matrix test and source mapping for seam claim, not artifact counter as live service blocking proof.'}],
 'expectedNumericDiscrepancies':[],'method':'Only parse saved records and recompute existing descriptive counts/medians; no classifiers, sandbox, services, providers or tests executed.','sealChecks':seals}
save('verified-key-results.json',facts);save('analysis-source-hashes.json',sources)
md('verified-key-results.md','# Verified results — observations, not conclusions\n\nAll values recomputed/read from saved artifacts. No new execution or classifier call.\n\n'+
 '| Finding | Verified value | Source |\n|---|---|---|\n'+
 f'| Deterministic reference agreement | 15/15 development; 9/10 holdout; 24/25 combined; sole miss HOL-008 | `{P3}/deterministic-replay.json` |\n'+
 f'| Jev primary | 25 cases × 5; 125 technically valid classifications | `{P3}/result-primary-*.json` (125 concrete paths in analysis-source-hashes.json) |\n'+
 '| Jev repeatability | 23/25 unanimous; 121/125 match own mode; unstable SCN-010 and SCN-013 | per-case counts checked against raw primary outputs |\n'+
 '| Jev reference agreement | Individual 84/125; modal 16/25; deterministic-only 8; Jev-only 0; neither 1 | raw outputs, labels, analysis.json |\n'+
 '| Sensitivity/accounting | 15 calls / 5 cases × 3 presentations; 4/5 same class across presentations; 3 smoke; 1 prior 403; 144 total attempts, 143 successful classifications, 0 automatic retries | saved result/failure files and manifest |\n'+
 '| Runtime matrix | 10 workloads × 2 runtimes × 5 = 100 measured, all attested; 9/10 compatible; 85 completed, 10 expected timeouts, 5 DNS failures | measured-runs/, compatibility-matrix.json |\n'+
 '| W8 | runc 5/5 Paper confirmed; runsc 0/5; no successful-run ratio | host-chat-results.json and raw measured records |\n'+
 '| CPU / I/O medians | W9: 521→844 ms (1.619962x); W10: 592→1548 ms (2.614865x) | performance-summary.json, recomputed from measured durations |\n'+
 '| Integration | E1–E8 PASS; real Paper confirmation; collector outage retained enforcement; capacity2/429/recovery; 3 fresh-data cases PASS | Phase 5 artifacts |\n'+
 '| Regression evidence | Phase5 217 passed/0 failed; Phase6 190 passed/0 failed; each preserves local guarded DB skip1, separately passed deployed | saved test summaries; not added together as independent experiments |\n\n'+
 '## Scope clarifications\n\n'+''.join(f"- **{x['id']}** {x['issue']} {x['treatment']}\n" for x in facts['scopeClarifications'])+
 '\nNo expected numerical discrepancy was found. Qualifiers above correct possible denominator/evidence interpretations without changing historical artifacts.\n')
print(json.dumps({'status':'VERIFIED','sourceArtifactsRead':len(sources),'sealsVerified':sum(s['checked'] for s in seals),'frozenClassifierLanguages':languages,'numericDiscrepancies':0}))
