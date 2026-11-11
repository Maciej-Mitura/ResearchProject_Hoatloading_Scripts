from phase5_common import *
import time,threading,hashlib,re,uuid,sys
from datetime import datetime,timezone

def runner_health():
 p=cmd(D+['exec','research-poc-runner-1','deno','eval','console.log(JSON.stringify(await (await fetch("http://127.0.0.1:3100/health")).json()))']);assert p['exitCode']==0,p['stderr'];return json.loads(p['stdout'])
class Observer:
 def __init__(self):
  self.records={};self.lock=threading.Lock();self.p=subprocess.Popen(D+['events','--since',datetime.now(timezone.utc).isoformat(),'--filter','type=container','--format','{{json .}}'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  self.t=threading.Thread(target=self.consume,daemon=True);self.t.start()
 def consume(self):
  for line in self.p.stdout:
   try:
    e=json.loads(line);a=e.get('Actor',{});name=a.get('Attributes',{}).get('name','');cid=a.get('ID');action=e.get('Action')
    if not name.startswith('poc-exec-'):continue
    with self.lock:r=self.records.setdefault(cid,{'containerId':cid,'name':name,'events':[]});r['events'].append({'action':action,'timeNano':e.get('timeNano')})
    if action in ['create','start']:
     try:
      obj=dj(['inspect',cid])[0];h=obj['HostConfig'];inspection={'observedRuntime':h['Runtime'],'imageId':obj['Image'],'user':obj['Config']['User'],'controls':{k:h.get(k) for k in ['ReadonlyRootfs','NetworkMode','CapDrop','SecurityOpt','Memory','MemorySwap','NanoCpus','PidsLimit','Tmpfs']}}
      with self.lock:r[action+'Inspection']=inspection
     except Exception:pass
    with self.lock:save('runtime-evidence/'+cid+'.json',r)
   except Exception:pass
 def keys(self):
  with self.lock:return set(self.records)
 def new(self,old):
  with self.lock:return json.loads(json.dumps([v for k,v in self.records.items() if k not in old]))
 def close(self):self.p.terminate();self.t.join(timeout=5)

def run_case(cid,source,profile,observer,base='http://localhost:13000',host_required=False):
 before=observer.keys();created_status,created=http('/api/scripts',{'name':'Phase5 '+cid,'language':'javascript','source':source,'status':'ready'},base);assert created_status==201,created
 status,started=http('/api/executions',{'scriptId':created['script']['id'],'permissionProfile':profile},base);assert status==201,started;eid=started['id']
 save('intents/'+cid+'.json',{'caseId':cid,'executionId':eid,'sourceHash':hashlib.sha256(source.encode()).hexdigest(),'profile':profile})
 deadline=time.monotonic()+90
 while time.monotonic()<deadline:
  _,details=http('/api/executions/'+eid,base=base);e=details['execution']
  if e['status'] in ['completed','failed','terminated','blocked'] and e.get('result') is not None:break
  time.sleep(.15)
 assert e['status'] in ['completed','failed','terminated','blocked'] and e.get('result')
 for _ in range(20):
  evidence=observer.new(before)
  if len(evidence)==1 and any(x['action']=='destroy' for x in evidence[0]['events']):break
  time.sleep(.05)
 evidence=observer.new(before);assert len(evidence)==1 and ('createInspection' in evidence[0] or 'startInspection' in evidence[0]),'Runtime observation missing'
 ins=evidence[0].get('createInspection') or evidence[0]['startInspection'];assert ins['observedRuntime']=='runc'
 _,risk=http('/api/risk-assessments?executionId='+eid,base=base);_,sec=http('/api/security/events?executionId='+eid,base=base)
 record={'caseId':cid,'source':source,'sourceHash':hashlib.sha256(source.encode()).hexdigest(),'profile':profile,'executionId':eid,'traceId':details['traceId'],'execution':e,'riskAssessments':risk['items'],'securityEvents':sec['items'],'timeline':details['timeline'],'runtimeEvidence':evidence,'admissionAfter':runner_health()}
 if host_required:
  assert re.fullmatch('[0-9a-f-]{36}',eid)
  sql="SELECT COALESCE(json_agg(row_to_json(t)),'[]'::json) FROM (SELECT id,status,origin,correlation,result,created_at,updated_at FROM host_commands WHERE correlation->>'executionId'='"+eid+"') t;"
  commands=[]
  for _ in range(40):
   commands=pg(sql)
   if commands and all(c['status'] in ['completed','failed'] for c in commands):break
   time.sleep(.5)
  _,sec=http('/api/security/events?executionId='+eid,base=base);record['securityEvents']=sec['items'];_,activity=http('/api/host/events?filter=commands&limit=200',base=base)
  ids={c['id'] for c in commands};record['hostCommands']=commands;record['paperEvents']=[x for x in activity['items'] if x.get('payload',{}).get('commandId') in ids]
  record['hostConfirmed']=bool(commands) and all(c['status']=='completed' and c['result']['success'] for c in commands)
 save('executions/'+cid+'.json',record)
 print(cid,e['status'],e['result']['auditCollection']['status'],risk['items'][0]['classification'] if risk['items'] else None,'host='+str(record.get('hostConfirmed')),flush=True)
 return record

def environment():
 info=dj(['info','--format','{{json .}}']);assert info['OperatingSystem']=='Docker Desktop' and info['DefaultRuntime']=='runc'
 cfg=http('/api/config/public')[1];assert cfg['executionProvider']=='docker' and cfg['riskAnalyzer']=='deterministic'
 health=http('/health')[1];assert health['db']=='ok';assert http('/api/host/status')[1]['connected']
 assert not cmd(D+['ps','-aq','--filter','name=^/poc-exec-'])['stdout'];h=runner_health();assert h['admission']['active']==0 and not h['admission']['blocked']
 migration=cmd(D+['exec','research-poc-api-1','deno','run','--no-lock','--allow-net','--allow-read','--allow-env','src/db/migrate.ts']);save('migration-process.json',migration);assert migration['exitCode']==0
 db=pg("SELECT json_build_object('migrations',(SELECT json_agg(id ORDER BY id) FROM schema_migrations),'host_command_columns',(SELECT json_agg(column_name) FROM information_schema.columns WHERE table_name='host_commands'),'risk_columns',(SELECT json_agg(column_name) FROM information_schema.columns WHERE table_name='risk_assessments'),'nonterminal_executions',(SELECT count(*) FROM executions WHERE status NOT IN ('completed','failed','terminated','blocked')),'pending_commands',(SELECT count(*) FROM host_commands WHERE status IN ('pending','delivered')));")
 assert '009_host_command_provenance.sql' in db['migrations'] and {'origin','correlation'}<=set(db['host_command_columns'])
 save('database-schema.json',db)
 services={}
 for name in ['api','runner','host-gateway','paper','postgres','otel-collector','web']:
  obj=dj(['inspect','research-poc-'+name+'-1'])[0];services[name]={'containerId':obj['Id'],'imageId':obj['Image'],'state':obj['State']['Status'],'health':obj['State'].get('Health',{}).get('Status'),'runtime':obj['HostConfig']['Runtime']}
 save('environment.json',{'selected':'Normal Docker Desktop/runc application','reason':'Normal supported host-chat path; runsc empirical result remains separate.','docker':{k:info.get(k) for k in ['ID','OperatingSystem','ServerVersion','KernelVersion','DefaultRuntime','Runtimes']},'publicConfiguration':cfg,'apiHealth':health,'runnerHealth':h,'services':services,'startedAt':datetime.now(timezone.utc).isoformat()})

def core():
 if not (OUT/'environment.json').exists():environment()
 else:assert http('/health')[1]['db']=='ok' and runner_health()['admission']['active']==0
 observer=Observer()
 cases=[('E1','console.log("final-e2e-normal");','none'),('E2','await Deno.readTextFile("/etc/hosts");','none'),('E3','try { await Deno.readTextFile("/etc/hosts"); } catch { console.log("handled"); }','none'),('E4','console.log((await Deno.readTextFile("/fixtures/allowed.txt")).includes("intentionally readable")); try { await Deno.readTextFile("/etc/hosts"); } catch { console.log("outside-denied"); }','read-fixture'),('E5','console.log(Deno.env.get("SANDBOX_DEMO_VALUE")); try { Deno.env.get("HOME"); } catch { console.log("env-denied"); }','env-demo'),('E6','while(true) {}','none'),('E7',(ROOT/'fixtures/scenarios/scripts/large-output-fast.js').read_text(),'none'),('E8','import { host } from "host"; console.log(JSON.stringify(await host.chat.broadcast("Final research validation")));','host-chat')]
 summary=[]
 try:
  for cid,source,profile in cases:
   existing=OUT/'executions'/(cid+'.json')
   r=json.loads(existing.read_text()) if existing.exists() else run_case(cid,source,profile,observer,host_required=cid=='E8');x=r['execution']['result']
   expected={'E1':'completed','E2':'failed','E3':'completed','E4':'completed','E5':'completed','E6':'terminated','E7':'completed','E8':'completed'}[cid]
   assert r['execution']['status']==expected
   assert r['riskAssessments'] and r['riskAssessments'][0]['assessmentStatus']=='ok'
   if cid in ['E1','E3','E4','E5','E8']:assert x['auditCollection']['status']=='complete'
   if cid in ['E2','E3','E4','E5']:assert x['permissionEvents']
   if cid=='E1':assert x['stdout'].strip()=='final-e2e-normal'
   if cid=='E6':assert x['timedOut'] and x['auditCollection']['status']!='complete'
   if cid=='E7':assert x['outputTruncated'] and len((x['stdout']+x['stderr']).encode())<=1048576 and x['auditCollection']['status']!='complete'
   if cid=='E8':assert r['hostConfirmed']
   assert not x['cleanupErrors'] and r['admissionAfter']['admission']['active']==0
   summary.append({'caseId':cid,'profile':profile,'executionId':r['executionId'],'traceId':r['traceId'],'outcome':expected,'auditCollection':x['auditCollection'],'risk':r['riskAssessments'][0]['classification'],'verdict':'PASS'})
 finally:observer.close();save('core-execution-matrix.json',summary)

def boundaries():
 observer=Observer()
 try:
  s='const r=await fetch("http://host-gateway:3200/internal/sessions",{method:"POST",body:"{}"});console.log("public-admin="+r.status);await r.body?.cancel();for(const u of ["http://host-gateway:3201/internal/sessions","http://api:3000/api/host/commands"]){try{const r=await fetch(u,{method:"POST",body:"{}"});console.log("REACHED "+u+" "+r.status)}catch{console.log("DENIED "+u)}}'
  case=run_case('negative-host-boundaries',s,'host-chat',observer)
 finally:observer.close()
 stdout=case['execution']['result']['stdout'];assert 'public-admin=404' in stdout and 'REACHED' not in stdout and stdout.count('DENIED ')==2
 public=http('/api/host/commands',{'commandType':'broadcast_message','payload':{'message':'must not broadcast','_meta':{'executionId':str(uuid.uuid4()),'traceId':'f'*32,'callId':str(uuid.uuid4())}}});assert public[0]==403
 forged={'message':'must not enqueue','executionId':str(uuid.uuid4()),'traceId':'f'*32,'callId':str(uuid.uuid4())}
 noauth=http('/api/internal/host-commands',forged);assert noauth[0]==401
 values=dict(l.split('=',1) for l in (ROOT/'.env').read_text().splitlines() if '=' in l and not l.lstrip().startswith('#'))
 req=urllib.request.Request('http://localhost:13000/api/internal/host-commands',data=json.dumps(forged).encode(),headers={'Content-Type':'application/json','X-Internal-Token':values['HOST_GATEWAY_SERVICE_TOKEN'].strip().strip('\"\'')})
 try:
  with urllib.request.urlopen(req) as res:trusted=(res.status,json.load(res))
 except urllib.error.HTTPError as e:trusted=(e.code,json.load(e))
 assert trusted[0]==403 and trusted[1]['error']['code']=='untrusted_correlation'
 save('security-boundaries.json',{'sandboxAdminAndDirectTransport':'PASS','sandboxExecutionId':case['executionId'],'publicDirectRoute':public,'internalWithoutCredential':noauth,'authenticatedHarnessForgedCorrelation':trusted,'note':'Service credential used only by trusted test harness, never passed to a sandbox. No command was enqueued.'})

def admission():
 assert runner_health()['admission']['active']==0
 code='''const base="http://127.0.0.1:3100";const get=async()=>await(await fetch(base+"/health")).json();const run=(source)=>fetch(base+"/execute",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({executionId:crypto.randomUUID(),language:"javascript",permissionProfile:"none",source})}).then(async r=>({http:r.status,body:await r.json()}));const cap=(await get()).admission.capacity;const jobs=Array.from({length:cap},()=>run('await new Promise(r=>setTimeout(r,4000));console.log("capacity-held")'));let occupied;for(let i=0;i<100;i++){occupied=await get();if(occupied.admission.active===cap)break;await new Promise(r=>setTimeout(r,25))}const extra=await run('console.log("must-not-run")');const held=await Promise.all(jobs);const after=await get();const recovery=await run('console.log("admission-recovered")');console.log(JSON.stringify({capacity:cap,occupied,extra,held,after,recovery,final:await get()}));'''
 p=cmd(D+['exec','research-poc-runner-1','deno','eval',code],90);assert p['exitCode']==0,p['stderr'];v=json.loads(p['stdout']);save('admission-regression.json',v)
 assert v['occupied']['admission']['active']==v['capacity']==2 and v['extra']['http']==429
 assert all(r['http']==200 and r['body']['exitCode']==0 for r in v['held'])
 assert v['recovery']['body']['stdout'].strip()=='admission-recovered' and v['final']['admission']['active']==0 and not v['final']['admission']['blocked']
 print('Admission capacity 2 / extra 429 / recovery / active zero PASS.',flush=True)

def outage():
 since=datetime.now(timezone.utc).isoformat();stop=cmd(D+['stop','research-poc-otel-collector-1']);assert stop['exitCode']==0
 observer=Observer()
 try:
  source='try{await Deno.readTextFile("/etc/hosts")}catch{console.log("outage-read-denied")} const bad=await fetch("http://host-gateway:3200/v1/capabilities/chat.broadcast",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:"must-not-broadcast"})});console.log("outage-unauthorized="+bad.status);await bad.body?.cancel();import {host} from "host";console.log(JSON.stringify(await host.chat.broadcast("Final validation collector outage")));'
  result=run_case('collector-outage',source,'host-chat',observer,host_required=True)
  assert result['execution']['status']=='completed' and result['hostConfirmed'] and 'outage-read-denied' in result['execution']['result']['stdout'] and 'outage-unauthorized=401' in result['execution']['result']['stdout']
  assert any(e['target']=='/etc/hosts' for e in result['execution']['result']['permissionEvents'])
  time.sleep(3);logs=cmd(D+['logs','--since',since,'research-poc-api-1']);assert '[otel] export error (ignored)' in logs['stderr']+logs['stdout']
  save('collector-outage.json',{'executionId':result['executionId'],'traceId':result['traceId'],'collectorStopped':True,'scriptRestrictionRetained':True,'hostAuthorizationAndPaperConfirmed':True,'postgresEvidencePersisted':True,'exportErrorObservable':True,'apiLogs':logs,'runtimeControls':result['runtimeEvidence']})
 finally:
  observer.close();restore=cmd(D+['start','research-poc-otel-collector-1']);save('collector-restoration.json',restore);assert restore['exitCode']==0

def recovery():
 observer=Observer()
 try:r=run_case('collector-restored','console.log("collector-restored")','none',observer)
 finally:observer.close()
 assert r['execution']['status']=='completed'
 received=False
 for _ in range(20):
  logs=cmd(D+['logs','--since',json.loads((OUT/'environment.json').read_text())['startedAt'],'research-poc-otel-collector-1'])
  if r['traceId'] in logs['stdout']+logs['stderr']:received=True;break
  time.sleep(.5)
 assert received;save('collector-recovery.json',{'executionId':r['executionId'],'traceId':r['traceId'],'collectorReceivedAfterRestoration':True})

if __name__=='__main__':{'core':core,'boundaries':boundaries,'admission':admission,'outage':outage,'recovery':recovery}[sys.argv[1]]()
