from phase75_common import *
from datetime import datetime,timezone
import hashlib,re,time
result={"at":datetime.now(timezone.utc).isoformat()}
# Only summaries of configured services; never persist rendered Compose credentials.
r=cmd(D+['compose','config','--quiet']);result['composeValidation']={"exitCode":r['exitCode'],"stderr":r['stderr']}
result['services']=cmd(D+['compose','ps','--format','json'])
status,scripts=http('/api/scripts');assert status==200
result['scriptCount']=len(scripts['items'])
for name in ['Phase7.5 A','Phase7.5 B','Phase7.5 C','Phase7.5 D','Phase7.5 E']:
 script=next(x for x in scripts['items'] if x['name']==name)
 status,history=http('/api/executions/history?scriptId='+script['id']+'&limit=100');assert status==200 and history['total']>=1
 for row in history['items']:
  assert row['scriptId']==script['id'] and 'stdout' not in row and 'source' not in row
 result.setdefault('historyChecks',[]).append({'scriptId':script['id'],'name':name,'history':history,'verdict':'PASS'})
# Reversible metadata/version workflow using a newly created disposable local test script.
status,created=http('/api/scripts',{'name':'Phase7.5 metadata regression','language':'javascript','source':'console.log(1)','status':'draft'});assert status==201
sid=created['script']['id']
def patch(path,body):
 req=urllib.request.Request('http://localhost:13000'+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'},method='PATCH')
 with urllib.request.urlopen(req,timeout=15) as response:return response.status,json.load(response)
status,edited=patch('/api/scripts/'+sid,{'name':'Phase7.5 metadata regression updated','status':'disabled'});assert status==200 and edited['status']=='disabled'
status,version=http('/api/scripts/'+sid+'/versions',{'source':'console.log(2)','language':'typescript','changelog':'Phase7.5 regression'});assert status==201 and version['versionNumber']==2
status,detail=http('/api/scripts/'+sid);assert status==200 and len(detail['versions'])==2 and detail['script']['currentVersionId']==version['id']
result['scriptWorkflow']={'verdict':'PASS','scriptId':sid,'create':True,'read':True,'update':True,'version':True,'disable':True,'delete':'UNSUPPORTED existing API; no deletion endpoint introduced'}
# No preference mutation: component test verifies autosave writes; here verify current deployed contract.
status,settings=http('/api/project/settings');assert status==200 and settings['fields'] and settings['preview']
result['settingsRead']={'verdict':'PASS','fieldCount':len(settings['fields'])}
status,host=http('/api/host/status');assert status==200 and host['connected'];result['hostStatus']={'connected':host['connected'],'pendingCommands':host['pendingCommands']}
# Compare every pre-existing frozen research file against the before-implementation baseline.
before=json.loads((OUT/'before-fingerprints.json').read_text(encoding='utf-8'))
frozen={k:v for k,v in before.items() if k.startswith('research-results/') and not k.startswith('research-results/phase7-5-ui-polish/')}
changed=[];missing=[]
for rel,digest in frozen.items():
 p=ROOT/rel
 if not p.exists():missing.append(rel)
 elif hashlib.sha256(p.read_bytes()).hexdigest()!=digest:changed.append(rel)
result['frozenIntegrity']={'checked':len(frozen),'changed':changed,'missing':missing,'verdict':'PASS' if not changed and not missing else 'FAIL'}
assert not changed and not missing
currentChanges=[]
for rel,digest in before.items():
 p=ROOT/rel
 if not p.exists():currentChanges.append({'path':rel,'change':'deleted'})
 elif hashlib.sha256(p.read_bytes()).hexdigest()!=digest:currentChanges.append({'path':rel,'change':'modified'})
for folder in ['apps/web/src','apps/api/src','apps/api/tests']:
 for p in (ROOT/folder).rglob('*'):
  if p.is_file() and p.relative_to(ROOT).as_posix() not in before:currentChanges.append({'path':p.relative_to(ROOT).as_posix(),'change':'added'})
result['changedFiles']=currentChanges
save('final-validation.json',result)
print(json.dumps({'compose':result['composeValidation']['exitCode'],'historyChecks':len(result['historyChecks']),'scriptWorkflow':'PASS','frozenIntegrity':result['frozenIntegrity'],'changedSourceFiles':len(currentChanges)}))
