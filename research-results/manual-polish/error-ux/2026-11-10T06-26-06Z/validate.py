from common import *
import hashlib
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before=json.loads((OUT/'before-fingerprints.json').read_text(encoding='utf-8'))
missing=[n for n in before if not (ROOT/n).is_file()];changed=[n for n,h in before.items() if (ROOT/n).is_file() and sha(ROOT/n)!=h]
assert not missing and all(n.startswith('apps/web/') for n in changed)
new=[p.relative_to(ROOT).as_posix() for p in (ROOT/'apps/web/src').rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in before]
seals=[]
for p in (ROOT/'research-results').rglob('result-artifact-hashes.json'):
 if OUT in p.parents:continue
 d=json.loads(p.read_text(encoding='utf-8'));errors=[n for n,h in d['files'].items() if not (p.parent/n).is_file() or sha(p.parent/n)!=h];assert not errors,(str(p),errors)
 seals.append({'path':p.relative_to(ROOT).as_posix(),'files':len(d['files']),'mismatches':errors})
m=json.loads((ROOT/'research-results/phase3-jev/resume-after-credit-2026-11-09/manifest.json').read_text());assert all(sha(ROOT/n)==h for n,h in m['hashes'].items())
save('integrity-and-scope.json',{'baselineFiles':len(before),'priorResearchFiles':sum(n.startswith('research-results/') for n in before),'priorResearchChanged':[],'missing':missing,'modifiedFiles':changed,'newFiles':new,'sourceHashes':{n:sha(ROOT/n) for n in changed+new},'priorResultSeals':seals,'phase3ManifestFiles':len(m['hashes']),'totalPriorSealedEntries':sum(s['files'] for s in seals)+len(m['hashes'])})
rows=json.loads((OUT/'final-live-executions.json').read_text());assert len(rows)==5
pair=[r for r in rows if r['scriptName']=='Error UX · paired host import'];assert len(pair)==2 and pair[0]['source']==pair[1]['source'] and pair[0]['scriptVersionId']==pair[1]['scriptVersionId']
for row in rows:
 x=row['detail']['execution'];r=x['result'];a=next(a for a in row['assessments']['items'] if a['id']==x['riskAssessmentId']);assert r['auditCollection']['status']=='complete' and a['classification']=='low' and a['assessmentStatus']=='ok'
 if row in pair:
  if r['manifest']['permissionProfile']=='none':assert x['status']=='failed' and r['exitCode']==1 and 'Import "host" not a dependency' in r['stderr'] and not r['hostApiEvents']
  else:assert r['manifest']['permissionProfile']=='host-chat' and x['status']=='completed' and 'Hello world' in r['stdout'] and r['hostApiEvents']
 elif 'generic-error' in row['scriptName']:assert x['status']=='failed' and r['exitCode']==1 and 'Controlled error UX regression' in r['stderr']
 else:assert x['status']=='completed' and r['exitCode']==0
assert len(json.loads((OUT/'paired-paper-confirmation.json').read_text()))==1
front=json.loads((OUT/'frontend-tests.json').read_text());assert front['exitCode']==0 and front['counts']=={'passed':107,'failed':0,'skipped':0}
for name in ['frontend-typecheck-tests.json','application-build.json','application-redeploy.json']:assert json.loads((OUT/name).read_text())['exitCode']==0
cfg=json.loads((OUT/'final-public-config.json').read_text());assert cfg['chatProvider']=='gemini' and cfg['executionProvider']=='docker' and cfg['riskAnalyzer']=='deterministic'
for p in ['browser-none-final.txt','browser-generic-error.txt','browser-historical-error.txt','browser-running.txt']:
 assert '\x1b' not in (OUT/p).read_text(encoding='utf-8')
assert 'Run this host script with the host-chat profile.' in (OUT/'browser-assistant.txt').read_text(encoding='utf-8')
assert 'Create script' in (OUT/'browser-new-script-race-fixed.txt').read_text(encoding='utf-8')
metrics=json.loads((OUT/'responsive-checks.json').read_text());assert all(v['pageWidth']<=v['viewport'] and len(set(n['x'] for n in v['nodes']))==1 for v in metrics.values())
git=cmd([r'C:\Program Files\Git\cmd\git.exe','diff','--check','--','apps/web']);save('whitespace-check.json',git);assert git['exitCode']==0
save('validation-summary.json',{'frontend':front['counts'],'typecheck':True,'productionBuild':True,'redeployed':True,'apiChanged':False,'apiTests':'not repeated; no API/provider change','pairedSameSourceAndVersion':True,'liveExecutions':len(rows),'paperConfirmations':1,'historicalAnsiPreserved':True,'responsive':metrics,'priorResearchUnchanged':sum(n.startswith('research-results/') for n in before),'changedFiles':len(changed)+len(new),'phase8Started':False,'commitOrPush':False})
print(json.dumps({'passed':107,'failed':0,'skipped':0,'liveExecutions':5,'priorResearchUnchanged':sum(n.startswith('research-results/') for n in before),'changedFiles':len(changed)+len(new),'priorSealedEntries':sum(s['files'] for s in seals)+len(m['hashes'])},indent=2))
