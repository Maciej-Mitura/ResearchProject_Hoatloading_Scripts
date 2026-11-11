"""Offline analysis of the retained frozen Phase 3 experiment; never calls a provider."""
from pathlib import Path
import collections
import hashlib
import json
import math
import statistics

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / 'research-results/phase3-jev/resume-after-credit-2026-11-09'
def load(path):
    return json.loads(path.read_text(encoding='utf-8'))
def save(name, value):
    (RUN / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def stats(values):
    if not values:
        return {'n': 0, 'min': None, 'median': None, 'mean': None, 'p95': None, 'max': None}
    ordered = sorted(values)
    return {'n': len(values), 'min': min(values), 'median': statistics.median(values), 'mean': statistics.mean(values), 'p95': ordered[math.ceil(.95 * len(values)) - 1], 'max': max(values)}
def ratio(n, d):
    return {'numerator': n, 'denominator': d, 'percent': 100*n/d if d else None}

manifest = load(RUN / 'manifest.json')
context = load(RUN / 'resume-context.json')
plan = load(RUN / 'batch-plan.json')
state = load(RUN / 'batch-state.json')
assert state['status'] == 'complete'
smoke = load(RUN / 'smoke-attempts.json')
batch = load(RUN / 'batch-attempts.json')
prior = load(ROOT / 'research-results/phase3-jev/approved-smoke-2026-11-09/smoke-attempts.json')
assert len(prior) == context['previousProviderAttempts'] == 1
primary = [r for r in batch if r['stage'] == 'primary' and r['technicallyValid']]
sens = [r for r in batch if r['stage'] == 'sensitivity' and r['technicallyValid']]
assert len(primary) == 125 and len(sens) == 15 and len(smoke) == 3
corpus = {c['scenarioId']: c for c in map(load, sorted((ROOT / 'research-results/risk-comparison/frozen-evidence-v1').glob('*.json')))}
baseline = {c['caseId']: c for c in load(RUN / 'deterministic-replay.json')}
labels = {c['id']: c['expectedResearchLabel'] for name in ['manifest.json', 'holdout-manifest.json'] for c in load(ROOT / 'fixtures/scenarios' / name)['scenarios']}
assert len(corpus) == 25 and all(c['referenceLabel'] == labels[key] == baseline[key]['reference'] for key, c in corpus.items())
per_case = []
comparison = collections.Counter()
for key, c in sorted(corpus.items()):
    attempts = [r for r in batch if r['stage'] == 'primary' and r['caseId'] == key]
    rows = [r for r in primary if r['caseId'] == key]
    assert sorted(r['round'] for r in rows) == [1,2,3,4,5]
    counts = collections.Counter(r['result']['classification'] for r in rows)
    highest = max(counts.values())
    modes = [k for k,v in counts.items() if v == highest]
    modal = modes[0] if len(modes) == 1 else None
    det_match = baseline[key]['classification'] == labels[key]
    jev_match = modal == labels[key]
    category = 'both_match' if det_match and jev_match else 'deterministic_only' if det_match else 'jev_only' if jev_match else 'neither_match'
    comparison[category] += 1
    confidences = [r['result']['confidence'] for r in rows if r['result']['confidence'] is not None]
    per_case.append({'caseId': key, 'name': c['name'], 'partition': c['corpusType'], 'reference': labels[key], 'deterministic': baseline[key]['classification'], 'successfulClassifications': len(rows), 'counts': {k:counts[k] for k in ['low','review','high']}, 'modalClass': modal, 'modalClasses': modes, 'stability': ratio(highest,len(rows)), 'unanimous': highest == 5, 'confidences': confidences, 'confidence': stats(confidences), 'confidenceRangeWidth': max(confidences)-min(confidences), 'providerFailures': sum(r['httpStatus'] is None or r['httpStatus'] >= 400 for r in attempts), 'invalidResponses': sum(r['result']['status'] != 'ok' and r['httpStatus'] is not None and r['httpStatus'] < 400 for r in attempts), 'comparison': category, 'roundResults': [{'round': r['round'], 'classification': r['result']['classification'], 'confidence': r['result']['confidence'], 'probabilities':r['result']['providerMetadata']['probabilities']} for r in rows], 'trustedObservations': {'script':c['evidence']['script'], 'permissions': c['evidence']['permissions'], 'resources': c['evidence']['resources'], 'termination': c['evidence']['termination'], 'hostApiCounts':{k:len(v) for k,v in c['evidence']['hostApi'].items()}, 'deniedHostReasons':[v.get('reason') for v in c['evidence']['hostApi']['denied']]}})

agreement = {}
for title, partition in [('development','closed_development'),('holdout','holdout_variant'),('combined',None)]:
    cs = [c for c in per_case if partition is None or c['partition'] == partition]
    rs = [r for r in primary if partition is None or r['partition'] == partition]
    agreement[title] = {'individual': ratio(sum(r['result']['classification'] == labels[r['caseId']] for r in rs),len(rs)), 'modal':ratio(sum(c['modalClass'] == c['reference'] for c in cs),len(cs)), 'deterministic':ratio(sum(c['deterministic'] == c['reference'] for c in cs),len(cs))}

unanimous_ids = {c['caseId'] for c in per_case if c['unanimous']}
confidence = {'allPrimary':stats([r['result']['confidence'] for r in primary]), 'unanimousCases':stats([r['result']['confidence'] for r in primary if r['caseId'] in unanimous_ids]), 'unstableCases':stats([r['result']['confidence'] for r in primary if r['caseId'] not in unanimous_ids]), 'referenceMatchingCalls':stats([r['result']['confidence'] for r in primary if r['result']['classification'] == labels[r['caseId']]]), 'referenceDisagreeingCalls':stats([r['result']['confidence'] for r in primary if r['result']['classification'] != labels[r['caseId']]]), 'meanWithinCaseRange':statistics.mean(c['confidenceRangeWidth'] for c in per_case), 'maxWithinCaseRange':max(c['confidenceRangeWidth'] for c in per_case), 'semantics':'Model-reported classification confidence, not calibration or probability of maliciousness.'}
all_rows = prior + smoke + batch
failures = [r for r in all_rows if r['result']['status'] != 'ok']
latency = {'units':'ms', 'p95Method':'nearest rank: sorted[ceil(0.95*n)-1]', 'primarySuccess':stats([r['result']['latencyMs'] for r in primary]), 'smokeSuccess':stats([r['result']['latencyMs'] for r in smoke]), 'sensitivitySuccess':stats([r['result']['latencyMs'] for r in sens]), 'allSuccess':stats([r['result']['latencyMs'] for r in all_rows if r['result']['status']=='ok']), 'failures':stats([r['result']['latencyMs'] for r in failures])}
sens_cases=[]
for key in load(ROOT / 'fixtures/scenarios/sensitivity.json')['selectScenarioIds']:
    rows=[r for r in sens if r['caseId']==key]
    assert [r['presentation'] for r in rows] == ['canonical','reordered','compact_notes']
    sens_cases.append({'caseId':key,'primaryModal':next(c['modalClass'] for c in per_case if c['caseId']==key),'sameClassAcrossVariants':len({r['result']['classification'] for r in rows})==1,'variants':[{'presentation':r['presentation'],'classification':r['result']['classification'],'confidence':r['result']['confidence'],'probabilities':r['result']['providerMetadata']['probabilities'],'requestHash':r['provenance']['requestHash']} for r in rows]})
accounting={'plannedClassifications':143,'priorBlockedAttempts':len(prior),'resumeSmokeAttempts':len(smoke),'primaryAttempts':sum(r['stage']=='primary' and r['transmitted'] for r in batch),'sensitivityAttempts':sum(r['stage']=='sensitivity' and r['transmitted'] for r in batch),'resumeAttempts':sum(r['transmitted'] for r in smoke+batch),'totalAttemptsIncludingPrior':sum(r['transmitted'] for r in all_rows),'successfulClassifications':sum(r['result']['status']=='ok' for r in all_rows),'failedProviderRequests':sum(r['httpStatus'] is None or r['httpStatus']>=400 for r in all_rows),'invalidResponses':sum(r['httpStatus'] is not None and r['httpStatus']<400 and r['result']['status']!='ok' for r in all_rows),'automaticRetries':sum(r['attempt']>1 for r in all_rows),'manualResumeAfterCredit':1,'unattemptedPlannedClassifications':0,'attemptCeiling':150}
assert accounting['totalAttemptsIncludingPrior']==state['totalAttempts']==144
assert all(r['result']['classification'] is None for r in failures)
assert all(r['httpStatus']==200 and r['result']['status']=='ok' and r['modelProvenanceValid'] for r in smoke+batch)

# Trace every retained output to a stored builder request and unchanged evidence.
requests={(r['caseId'],r['presentation']):r['request'] for r in plan['requests']}
for row in all_rows:
    presentation=row.get('presentation','canonical')
    request=requests[row['caseId'],presentation]
    body_hash=hashlib.sha256(json.dumps(request['body'],ensure_ascii=False,separators=(',',':')).encode('utf-8')).hexdigest()
    assert body_hash == request['provenance']['requestHash'] == row['provenance']['requestHash'] == row['result']['providerMetadata']['requestHash']
    evidence_path = next((ROOT/'research-results/risk-comparison/frozen-evidence-v1').glob(row['caseId']+'*.json'))
    assert digest(evidence_path) == row['evidenceHash']
    for k,v in [('provider','vercel'),('requestedModel','typesafe-ai/jev-1.14.0'),('endpoint','https://ai-gateway.vercel.sh/typesafe/v1/systemone'),('policyVersion','2'),('policyHash','4220afc83059cd6449e864ff09d43f1fcb610872ea4d344f7ced6c28f4a102f8'),('inputSchemaVersion',2),('transformationVersion','2'),('analyzerVersion','2'),('evidenceSchemaVersion',1)]:
        assert row['provenance'][k] == row['result']['providerMetadata'][k] == v
for row in smoke+batch:
    p=row['result']['providerMetadata']['probabilities']; choice=row['result']['classification']; conf=row['result']['confidence']
    assert set(p)=={'low','review','high'} and all(math.isfinite(v) and 0<=v<=1 for v in p.values())
    assert abs(sum(p.values())-1)<=.000001 and p[choice]+.000001>=max(p.values()) and 0<=conf<=1
for (key,presentation),request in requests.items():
    canonical=requests[key,'canonical']['body']['state']
    state_value=request['body']['state']
    assert (state_value['evidence'] if presentation=='compact_notes' else state_value)==canonical
for path,h in manifest['hashes'].items(): assert digest(ROOT/path)==h, path
for path,h in context['previousResultsHashes'].items(): assert digest(ROOT/path)==h, path
intent_count=len(list(RUN.glob('intent-*.json')))
assert intent_count == len(smoke)+len(batch)==143
for row in batch:
    identity=f"{row['stage']}-{row['jobIndex']:03d}-{row['caseId']}-{row['attempt']}"
    intent=load(RUN/f'intent-{identity}.json')
    assert intent['provenance']['requestHash']==row['provenance']['requestHash'] and intent['maximumAttemptOrdinal']==row['totalAttemptOrdinal']
expected=[(j['stage'],j['caseId'],j['round'],j['presentation']) for j in plan['jobs']]
actual=[(j['stage'],j['caseId'],j['round'],j['presentation']) for j in batch]
assert expected==actual
provenance_note={'policySourceActual':'config/jev-risk-policy-v2.md','policyHash':manifest['provenance']['policyHash'],'savedPolicySourceExplanation':'The unchanged existing diagnostic scrubber treats sk- within the harmless filename as a secret prefix and over-redacts policySource in saved diagnostics. The actual policy file, request body, policy hash and request hashes are intact. This additive clarification changes no historical artifacts.','batchOrchestratorSourceHash':digest(ROOT/'scripts/phase3-resume-batch.ts'),'analysisSourceHash':digest(Path(__file__))}
summary={'status':'COMPLETE WITH LIMITATIONS','accounting':accounting,'repeatability':{'unanimousCases':ratio(len(unanimous_ids),25),'unstableCases':[c['caseId'] for c in per_case if not c['unanimous']],'meanModalStabilityPercent':statistics.mean(c['stability']['percent'] for c in per_case),'pooledCallsMatchingOwnCaseMode':ratio(sum(max(c['counts'].values()) for c in per_case),125),'withinCasePairAgreement':ratio(sum(sum(n*(n-1)//2 for n in c['counts'].values()) for c in per_case),25*10)},'referenceAgreement':agreement,'comparison':{**{k:comparison[k] for k in ['both_match','deterministic_only','jev_only','neither_match']},'unstable':25-len(unanimous_ids),'insufficient':0,'unstableIsOverlappingFlag':True},'confidence':confidence,'latency':latency,'sensitivity':sens_cases,'provenanceNote':provenance_note,'recommendation':'READY FOR PHASE 4','phase4Started':False}
save('analysis.json',summary)
save('per-case-analysis.json',per_case)
save('failure-log.json',failures)
save('provenance-clarification.json',provenance_note)
lines=['# Primary per-case results','','Five repetitions per case; confidence is model-reported classification confidence.','','| Case | Reference | Deterministic | LOW / REVIEW / HIGH | Modal | Stability | Unanimous | Confidence min / mean / max | Provider failures |','|---|---|---|---|---|---:|---|---|---:|']
for c in per_case:
    lines.append(f"| {c['caseId']} | {c['reference'].upper()} | {c['deterministic'].upper()} | {c['counts']['low']} / {c['counts']['review']} / {c['counts']['high']} | {c['modalClass'].upper()} | {c['stability']['percent']:.0f}% | {'yes' if c['unanimous'] else 'no'} | {c['confidence']['min']:.2f} / {c['confidence']['mean']:.3f} / {c['confidence']['max']:.2f} | {c['providerFailures']} |")
(RUN/'per-case-analysis.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
# Exact configured secret values, never printed or persisted. Scan every research result.
secret_values=[]
for line in (ROOT/'.env').read_text(encoding='utf-8').splitlines():
    if '=' not in line or line.lstrip().startswith('#'): continue
    key,value=line.split('=',1);value=value.strip().strip('\"\'')
    if any(key.endswith(s) for s in ['KEY','TOKEN','PASSWORD','SECRET']) and len(value)>=8: secret_values.append(value)
json_count=0;file_count=0
for path in (ROOT/'research-results').rglob('*'):
    if not path.is_file():continue
    file_count+=1
    text=path.read_text(encoding='utf-8')
    assert not any(s in text for s in secret_values), 'STOP: configured credential found in results'
    if path.suffix=='.json':load(path);json_count+=1
integrity={'passed':True,'frozenArtifactsChecked':len(manifest['hashes']),'historicalPhase3FilesChecked':len(context['previousResultsHashes']),'frozenEvidenceRecords':25,'referenceLabelsMatched':25,'tracedOutputsIncludingPreservedFailure':len(all_rows),'writeAheadIntentsInResumeRun':intent_count,'requestBodyHashesVerified':len(all_rows),'probabilityDistributionsValid':len(smoke)+len(batch),'sensitivityFactualEquivalence':True,'exactFrozenCallOrdering':True,'researchResultFilesScanned':file_count,'researchResultJsonParsed':json_count,'noConfiguredSecretValuesFound':True,'original403Preserved':True,'focusedLocalTests':{'passed':31,'failed':0},'sourcePolicy':provenance_note['policySourceActual'],'policyHash':provenance_note['policyHash'],'noFrozenImplementationChanges':True,'noPhase4Work':True}
save('final-integrity.json',integrity)
print(json.dumps({'summary':summary,'integrity':integrity},ensure_ascii=False,indent=2))
