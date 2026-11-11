from common import *
import time,hashlib
status,scripts=http('/api/scripts');assert status==200
records=[]
for cid,expected,profile in [('A','42','none'),('C','Hello World','host-chat')]:
 answer=json.loads((OUT/('assistant-'+cid+'.json')).read_text());conversation=answer['conversationId'];message=answer['body']['assistantMessage']['id']
 script=next(s for s in scripts['items'] if s['conversationId']==conversation and s['sourceMessageId']==message)
 status,detail=http('/api/scripts/'+script['id']);assert status==200
 status,history=http('/api/executions/history?scriptId='+script['id']);assert status==200 and history['items']
 eid=history['items'][0]['id'];status,execution=http('/api/executions/'+eid);assert status==200
 run=execution['execution'];version=next(v for v in detail['versions'] if v['id']==run['scriptVersionId'])
 assert version['source'].strip()==answer['codeBlocks'][0].strip(),'Generated source changed before original execution'
 assert run['status']=='completed' and expected in run['result']['stdout'] and run['result']['manifest']['permissionProfile']==profile
 row={'caseId':cid,'script':script,'versions':detail['versions'],'executedVersionId':version['id'],'sourceMatchesModel':True,'execution':execution,'history':history,'verdict':'PASS'}
 status,security=http('/api/security/events?executionId='+eid);assert status==200;row['securityEvents']=security['items']
 if cid=='C':
  commands=pg("SELECT COALESCE(json_agg(t),'[]'::json) FROM (SELECT id,status,origin,result,correlation FROM host_commands WHERE correlation->>'executionId'='"+eid+"') t")
  assert commands and all(c['status']=='completed' and c['origin']=='sandbox_capability' and c['result']['success'] for c in commands)
  assert any(e['eventType']=='host.command.result' and e['metadata'].get('source')=='secure_bridge' and e['metadata'].get('success') for e in security['items'])
  row['hostCommands']=commands;row['paperConfirmed']=True
 if cid=='A':assert len(detail['versions'])==2
 records.append(row)
save('generated-execution-evidence.json',records)
status,settings=http('/api/project/settings');assert status==200
if not (OUT/'settings-before.json').exists():save('settings-before.json',{'overrides':settings['overrides'],'networkIntent':next(f['value'] for f in settings['fields'] if f['path']=='security.defaultNetworkAccess')})
print('A/C exact generated source executed; A versioning and C Paper acknowledgement PASS. Saved settings baseline.')
