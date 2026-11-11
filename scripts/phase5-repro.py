from phase5_common import *
import time,sys,hashlib
C=D+['compose','-p','phase5-repro','--env-file',str(ROOT/'.env.phase5-repro'),'-f',str(ROOT/'compose.yaml'),'-f',str(ROOT/'compose.phase5-repro.yaml')]
mode=sys.argv[1]
if mode=='start':
 before=cmd(D+['volume','ls','--filter','label=com.docker.compose.project=phase5-repro','--format','{{.Name}}']);assert not before['stdout'],'Reproduction volumes already exist'
 build=cmd(C+['build'],1800);save('repro-build.json',build);assert build['exitCode']==0,'See sanitized repro-build.json'
 up=cmd(C+['up','-d','--no-build'],900);save('repro-start.json',up);assert up['exitCode']==0,up['stderr'][-1200:]
 print('Fresh-data Compose project built and started. Readiness still required.',flush=True)
elif mode=='validate':
 ready=False
 for _ in range(120):
  try:
   if http('/health',base='http://localhost:24000')[1]['db']=='ok' and http('/api/host/status',base='http://localhost:24000')[1]['connected']:ready=True;break
  except Exception:pass
  time.sleep(2)
 assert ready,'Fresh stack/Paper did not become ready'
 ids={n:dj(['inspect','phase5-repro-'+n+'-1'])[0]['Image'] for n in ['api','runner','host-gateway','paper','web','sandbox']}
 rows=[]
 for cid,source,profile,needs_host in [('normal','console.log("clean-setup-normal")','none',False),('caught','try{await Deno.readTextFile("/etc/hosts")}catch{console.log("clean-handled")}','none',False),('host','import {host} from "host"; console.log(JSON.stringify(await host.chat.broadcast("Fresh setup research validation")))','host-chat',True)]:
  base='http://localhost:24000';status,s=http('/api/scripts',{'name':'Clean setup '+cid,'source':source,'language':'javascript','status':'ready'},base);assert status==201
  status,x=http('/api/executions',{'scriptId':s['script']['id'],'permissionProfile':profile},base);assert status==201
  for _ in range(300):
   _,details=http('/api/executions/'+x['id'],base=base);e=details['execution']
   if e['status'] in ['completed','failed','terminated'] and e.get('result'):break
   time.sleep(.1)
  assert e['status']=='completed' and e['result']['exitCode']==0 and e['result']['provider']=='docker'
  record={'caseId':cid,'executionId':e['id'],'execution':e,'traceId':details['traceId']}
  if cid=='normal':assert e['result']['stdout'].strip()=='clean-setup-normal'
  if cid=='caught':assert e['result']['permissionEvents'] and e['result']['stdout'].strip()=='clean-handled'
  if needs_host:
   sql="SELECT coalesce(json_agg(row_to_json(t)),'[]'::json) FROM (SELECT id,status,origin,correlation,result FROM host_commands WHERE correlation->>'executionId'='"+e['id']+"') t;"
   commands=[]
   for _ in range(40):
    commands=pg(sql,'phase5-repro-postgres-1')
    if commands and all(c['status']=='completed' for c in commands):break
    time.sleep(.5)
   assert commands and all(c['result']['success'] for c in commands);record['confirmedCommands']=commands
  rows.append(record);save('repro-executions/'+cid+'.json',record);print('Fresh setup '+cid+' PASS',flush=True)
 save('clean-setup.json',{'status':'PASS','mechanism':'Fresh Compose project, fresh DB/Paper/plugin volumes and generated independent local credentials; all application images built from the current working tree.','environment':'Desktop/runc, separate loopback API 24000/web 25174/Paper 25576','sourceIdentity':'Current uncommitted working tree, not a clean published Git checkout.','images':ids,'cases':[{'caseId':r['caseId'],'executionId':r['executionId'],'verdict':'PASS'} for r in rows],'documentedRecipe':'README Docker-only build/start flow, secure credential generation and EXECUTION_PROVIDER=docker; experimental override only isolates image tags/networks/ports.','limitations':['Existing Docker layer/dependency caches and network downloads were used; not an offline/no-cache build.','The current integrated changes are uncommitted; a fresh checkout of recorded HEAD alone does not contain this state.'],'noPreviousVolumesReused':True})
elif mode=='stop':
 p=cmd(C+['stop'],180);save('repro-stop.json',p);assert p['exitCode']==0;print('Disposable reproduction services stopped; fresh evidence volumes retained.',flush=True)
else:raise ValueError(mode)
