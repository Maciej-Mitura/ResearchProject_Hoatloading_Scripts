from phase5_common import *
import hashlib,statistics,re
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
p3=ROOT/'research-results/phase3-jev/resume-after-credit-2026-11-09';p4=ROOT/'research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched'
manifest=json.loads((p3/'manifest.json').read_text());assert all(sha(ROOT/p)==h for p,h in manifest['hashes'].items())
a3=json.loads((p3/'analysis.json').read_text());assert a3['referenceAgreement']['combined']['modal']['numerator']==16 and a3['repeatability']['unanimousCases']['numerator']==23
save('jev-package-integrity.json',{'status':'PASS','frozenHashesVerified':len(manifest['hashes']),'savedModalReferenceAgreement':a3['referenceAgreement']['combined']['modal'],'savedUnanimousCases':a3['repeatability']['unanimousCases'],'savedDeterministicAgreement':a3['referenceAgreement']['combined']['deterministic'],'currentCompatibility':'jev-current-compatibility.json','liveProviderCalls':0})
seal=json.loads((p4/'result-artifact-hashes.json').read_text())['files'];assert all(sha(p4/p)==h for p,h in seal.items())
rows=[json.loads(p.read_text()) for p in (p4/'measured-runs').glob('*.json')];assert len(rows)==100 and all(r['runtimeEvidenceStatus']=='ATTESTED' and not r['infrastructureInvalid'] for r in rows)
performance=json.loads((p4/'performance-summary.json').read_text())
for row in performance:
 for rt in ['runc','runsc']:
  values=[r['result']['durationMs'] for r in rows if r['workloadId']==row['workloadId'] and r['runtime']==rt and r['semanticSuccess']]
  stored=row['runtimeStats'][rt];assert stored['n']==len(values)
  if values:assert stored['min']==min(values) and stored['max']==max(values) and stored['median']==statistics.median(values) and stored['mean']==statistics.mean(values)
compat=json.loads((p4/'compatibility-matrix.json').read_text());assert sum(r['verdict']=='COMPATIBLE' for r in compat)==9
host=[r for r in rows if r['workloadId']=='W8'];assert sum(r['runtime']=='runc' and r['hostChat']['confirmed'] for r in host)==5
assert all(not r['hostChat']['confirmed'] and 'dns error' in r['result']['stderr'] for r in host if r['runtime']=='runsc')
save('gvisor-package-integrity.json',{'status':'PASS','sealedArtifactsVerified':len(seal),'measuredExecutions':100,'allAttested':True,'infrastructureInvalid':0,'compatibleWorkloads':9,'runcHostConfirmed':5,'runscHostConfirmed':0,'runscDnsFailures':5,'allStoredDurationStatisticsReproduced':True,'nativeEnvironmentCurrentState':'Previously intentionally stopped; no need to restart or reinterpret frozen findings.','newBenchmarkRuns':0,'optionalLiveRunscProbe':'SKIPPED — saved trusted runtime evidence is sufficient for this phase.'})
# Read deployed public assets, not the unavailable native browser UI.
with urllib.request.urlopen('http://localhost:15173',timeout=10) as r:html=r.read().decode()
scripts=re.findall(r'<script[^>]*src="([^"]+)"',html);assets=''
for s in scripts:
 with urllib.request.urlopen('http://localhost:15173'+s,timeout=10) as r:assets+=r.read().decode()
checks={s:s in assets for s in ['auditCollection','assessmentStatus','Permission profile','Advisory','mocked','Direct broadcast disabled']}
save('ui-truthfulness.json',{'browserWalkthrough':'UNAVAILABLE: computer-use app approval timed out; no bypass attempted.','method':'Current deployed HTML/JS asset inspection + current React source/contracts + real E1-E8 API records + 13 frontend tests and type check. Not a manual visual acceptance pass.','frontendHttpAvailable':True,'deployedAssetPaths':scripts,'deployedContractStrings':checks,'truthfulCoreCapabilities':['Execution provider/status and profile are separate from advisory risk.','Permission observations and auditCollection uncertainty are represented.','assessmentStatus failed/unavailable is separate from execution outcome.','Server activity distinguishes Paper-confirmed broadcasts.','Direct broadcast is already disabled in the current Inspector; no active public bypass control was found.'],'phase6Issues':['Inspector.tsx and ProjectSettingsPanel.tsx retain mocked-enforcement caveats that need live-provider-specific wording.','Optional removal of dead direct-broadcast callback wiring; the visible control is already disabled.','Telemetry/security event wording should distinguish PostgreSQL reconstruction from collector receipt.'],'cosmeticChangesMade':False})
print('Frozen Jev/gVisor packages and all saved Phase 4 timing summaries verify; deployed frontend assets inspected.')
