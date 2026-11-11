from common import *
import hashlib
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before=json.loads((OUT/'before-fingerprints.json').read_text(encoding='utf-8'))
old={n:h for n,h in before.items() if n.startswith('research-results/')}
changed=[n for n,h in before.items() if (ROOT/n).is_file() and hashfile(ROOT/n)!=h]
missing=[n for n in before if not (ROOT/n).is_file()]
assert not missing and not any(n.startswith('research-results/') for n in changed)
seals=[]
for p in (ROOT/'research-results').rglob('result-artifact-hashes.json'):
 if OUT in p.parents:continue
 data=json.loads(p.read_text(encoding='utf-8'));files=data['files'];errors=[n for n,h in files.items() if not (p.parent/n).is_file() or hashfile(p.parent/n)!=h]
 assert not errors,(str(p),errors)
 seals.append({'path':str(p.relative_to(ROOT)),'files':len(files),'mismatches':errors})
new=[str(p.relative_to(ROOT)).replace('\\','/') for p in (ROOT/'apps/web/src').rglob('*') if p.is_file() and str(p.relative_to(ROOT)).replace('\\','/') not in before]
source=changed+new
save('integrity-and-scope.json',{'baselineFiles':len(before),'priorResearchFiles':len(old),'priorResearchChanged':[],'missing':missing,'priorSeals':seals,'modifiedSourceFiles':changed,'newSourceFiles':new,'sourceHashes':{n:hashfile(ROOT/n) for n in source}})
rows=json.loads((OUT/'all-local-regressions.json').read_text(encoding='utf-8'));projection=json.loads((OUT/'postgres-regression-projection.json').read_text(encoding='utf-8'))
checks=[]
for row in rows:
 d=row['detail'];x=d['execution'];r=x['result'];name=row['scriptName'].split(' · ')[-1];a=next(z for z in row['assessments']['items'] if z['id']==x['riskAssessmentId']);events=d['securityEvents'];dbcount=next(v['count'] for v in projection['securityCounts'] if v['execution_id']==x['id']);assert len(events)==dbcount
 assert r['manifest']['permissionProfile'] in ['none','host-chat'];assert a['assessmentStatus']=='ok'
 if name=='controlled timeout':
  assert x['status']=='terminated' and r['timedOut'] and r['failureCategory']=='timeout';assert 10000<=r['durationMs']<15000;assert r['auditCollection']['status']=='unavailable' and set(r['auditCollection']['reasons'])=={'job_wall_timeout','missing_audit_frame'};assert not r['permissionEvents'] and not r['hostApiEvents'];assert a['classification']=='high' and len(a['reasons'])==1 and '[R006]' in a['reasons'][0]
 elif name=='failed':assert x['status']=='failed' and r['exitCode']==1 and r['auditCollection']['status']=='complete' and a['classification']=='low'
 else:assert x['status']=='completed' and r['auditCollection']['status']=='complete'
 if name=='host-chat':
  commands=[c for c in projection['hostCommands'] if c['correlation'].get('executionId')==x['id']];assert len(commands)==1 and commands[0]['status']=='completed' and commands[0]['result']['success'] is True
 checks.append({'case':name,'executionId':x['id'],'status':x['status'],'durationMs':r['durationMs'],'exitCode':r['exitCode'],'auditCollection':r['auditCollection'],'permissionObservations':len(r['permissionEvents']),'hostApiEvents':len(r['hostApiEvents']),'assessment':a['classification'],'reasons':a['reasons'],'projectionMatchesPostgres':True})
original=json.loads((OUT/'original-execution.json').read_text(encoding='utf-8'));assert len(original['commands'])==4 and all(c['result']['success'] is True for c in original['commands'])
status,settings=http('/api/project/settings');oldsettings=json.loads((OUT/'settings-preserved.json').read_text())['settings'];assert settings['overrides']==oldsettings['overrides'] and settings['effective']==oldsettings['effective']
for name,expected in [('api',116),('frontend',68),('history-postgres',1),('postgres',1)]:
 d=json.loads((OUT/(name+'-tests.json')).read_text());assert d['exitCode']==0 and d['counts']['passed']==expected and not d['counts']['failed']
for name in ['frontend-typecheck-tests.json','application-build.json','application-redeploy.json']:assert json.loads((OUT/name).read_text())['exitCode']==0
save('validation-summary.json',{'caseCount':len(checks),'cases':checks,'originalHostConfirmations':4,'settingsPreserved':True,'priorResearchUnchanged':len(old),'passedTests':186,'failedTests':0,'locallyIgnoredOptInDatabaseTests':2,'deployedDatabasePassed':2,'typecheck':True,'productionBuild':True,'phase8Started':False})
print(json.dumps({'checks':len(checks),'priorResearchUnchanged':len(old),'priorSealFiles':sum(s['files'] for s in seals),'sourceFiles':len(source),'testsPassed':186},indent=2))
