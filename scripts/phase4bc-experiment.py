"""Frozen matched experiment orchestration. Native daemon only; serialized jobs.

No production code changes. Host event/inspection evidence is independent of stdout.
"""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,os,platform,subprocess,sys,threading,time,urllib.request,urllib.error,re

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched'
D=['/usr/bin/docker','--host','unix:///var/run/docker.sock']
ENV={k:v for k,v in os.environ.items() if k not in {'DOCKER_HOST','DOCKER_CONTEXT'}}
IMAGE='sha256:90ab4f290356c3b4d307775656227f1b4a2fff68bf64ae0082705d7d98f82efc'
ENGINE='a82ddab9-8f47-4bd6-bc17-3bb5d18d08b1'
SECRET_VALUES=[]
for file in ['.env','.env.phase4bc']:
 for line in (ROOT/file).read_text().splitlines():
  if '=' in line and not line.lstrip().startswith('#'):
   key,val=line.split('=',1);val=val.strip().strip('\"\'')
   if key.endswith(('KEY','TOKEN','PASSWORD','SECRET')) and len(val)>=8:SECRET_VALUES.append(val)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def clean(text):
 for value in SECRET_VALUES:text=text.replace(value,'REDACTED')
 return text
def save(name,value):
 p=OUT/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(clean(json.dumps(value,indent=2))+'\n',encoding='utf-8')
def load(name):return json.loads((OUT/name).read_text())
def cmd(args,timeout=30):
 p=subprocess.run(args,cwd=ROOT,env=ENV,capture_output=True,text=True,timeout=timeout)
 return {'exitCode':p.returncode,'stdout':clean(p.stdout.strip()),'stderr':clean(p.stderr.strip())}
def dj(args):
 p=cmd(D+args);assert p['exitCode']==0,p['stderr'];return json.loads(p['stdout'])
def http(path,body=None,runtime='runc',timeout=10):
 base='http://127.0.0.1:'+('23000' if runtime=='runc' else '23001')
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=timeout) as res:return res.status,json.load(res)
 except urllib.error.HTTPError as error:return error.code,json.load(error)
def native_check():
 i=dj(['info','--format','{{json .}}']);assert i['ID']==ENGINE and i['ServerVersion']=='29.9.3' and i['DefaultRuntime']=='runc' and 'runsc' in i['Runtimes']
 assert dj(['image','inspect','research-poc-sandbox:local'])[0]['Id']==IMAGE
 assert json.loads(Path('/etc/docker/daemon.json').read_text())=={'runtimes':{'runsc':{'path':'/usr/bin/runsc','runtimeArgs':['--platform=systrap']}}}
 return i
def service_health():
 for rt in ['runc','runsc']:
  status,body=http('/health',runtime=rt);assert status==200 and body['db']=='ok'
  r=cmd(D+['exec','phase4bc-'+('runner' if rt=='runc' else 'runner-runsc')+'-1','deno','eval','console.log(JSON.stringify(await (await fetch("http://127.0.0.1:3100/health")).json()))'])
  assert r['exitCode']==0,r['stderr'];h=json.loads(r['stdout']);assert h['status']=='ok' and h['admission']['active']==0 and not h['admission']['blocked'] and h['dockerRuntime']==rt
 status,host=http('/api/host/status');assert status==200 and host['connected'],'Paper bridge not healthy'
 return host

class Observer:
 def __init__(self):
  self.records={};self.errors=[];self.lock=threading.Lock()
  self.p=subprocess.Popen(D+['events','--since',datetime.now(timezone.utc).isoformat(),'--filter','type=container','--format','{{json .}}'],env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  self.thread=threading.Thread(target=self.consume,daemon=True);self.thread.start()
 def consume(self):
  for line in self.p.stdout:
   try:
    e=json.loads(line);actor=e.get('Actor',{});cid=actor.get('ID');name=actor.get('Attributes',{}).get('name','');action=e.get('Action',e.get('status'))
    if not name.startswith('poc-exec-'):continue
    with self.lock:row=self.records.setdefault(cid,{'containerId':cid,'containerName':name,'events':[]});row['events'].append({'action':action,'timeNano':e.get('timeNano'),'attributes':actor.get('Attributes')})
    if action in ['create','start']:
     try:
      obj=dj(['inspect',cid])[0];h=obj['HostConfig'];s=obj['State']
      observed={'containerId':cid,'imageId':obj['Image'],'observedRuntime':h['Runtime'],'user':obj['Config']['User'],'state':{k:s.get(k) for k in ['Status','Running','Pid','ExitCode','OOMKilled','Error']},'controls':{k:h.get(k) for k in ['ReadonlyRootfs','NetworkMode','CapDrop','SecurityOpt','NanoCpus','Memory','MemorySwap','PidsLimit','Tmpfs']}}
      with self.lock:row[action+'Inspection']=observed
     except Exception as error:
      with self.lock:row.setdefault('inspectionErrors',[]).append(clean(str(error)))
    with self.lock:save('runtime-evidence/'+cid+'.json',row)
   except Exception as error:self.errors.append(clean(str(error)))
 def keys(self):
  with self.lock:return set(self.records)
 def new(self,before):
  with self.lock:return json.loads(json.dumps([v for k,v in self.records.items() if k not in before]))
 def close(self):
  self.p.terminate();self.thread.join(timeout=5)

def host_command(execution_id):
 assert re.fullmatch('[0-9a-f-]{36}',execution_id)
 sql="SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT id,status,origin,correlation,result,created_at,updated_at FROM host_commands WHERE correlation->>'executionId'='"+execution_id+"') t;"
 p=cmd(D+['exec','phase4bc-postgres-1','psql','-U','poc','-d','research_poc','-At','-c',sql]);assert p['exitCode']==0,p['stderr'];return json.loads(p['stdout'])
def w8_details(eid,result):
 events=result.get('hostApiEvents',[]);commands=host_command(eid)
 if commands:
  for _ in range(40):
   if all(c['status'] in ['completed','failed'] for c in commands):break
   time.sleep(.5);commands=host_command(eid)
 _,host=http('/api/host/status')
 gateway=cmd(D+['exec','phase4bc-host-gateway-1','deno','eval','console.log(JSON.stringify(await (await fetch("http://127.0.0.1:3200/health")).json()))'])
 _,activity=http('/api/host/events?filter=commands&limit=200')
 command_ids={c['id'] for c in commands};confirmations=[v for v in activity.get('items',[]) if v.get('payload',{}).get('commandId') in command_ids]
 confirmed=any(c['status']=='completed' and c.get('result',{}).get('success') for c in commands)
 return {'endpointAttempted':'http://host-gateway:3200/v1/capabilities/chat.broadcast','dockerNetwork':'phase4bc-sandbox-host','scriptAttemptedHostCall':True,'gatewayRequested':any(e['eventType']=='host_api.requested' for e in events),'authorized':any(e['eventType']=='host_api.allowed' for e in events),'queued':any(e['eventType']=='host_api.queued' for e in events),'delivered':any(c['status'] in ['delivered','completed','failed'] for c in commands),'deliveryEvidenceNote':'Completed/failed is reachable only through the guarded delivered->result bridge transition; delivery timestamp is not separately retained.','confirmed':confirmed,'commands':commands,'bridgeEvents':confirmations,'gatewayHealth':json.loads(gateway['stdout']) if gateway['exitCode']==0 else gateway,'bridgeConnected':host.get('connected'),'callIds':sorted({e['callId'] for e in events if e.get('callId')}),'commandIds':sorted(command_ids),'queueToConfirmationMs':[(datetime.fromisoformat(c['updated_at'])-datetime.fromisoformat(c['created_at'])).total_seconds()*1000 for c in commands if c['status']=='completed' and c.get('result',{}).get('success')]}

def semantics(workload,row):
 result=row.get('result') or {};wid=workload['workloadId']
 if wid=='W6':return row.get('executionStatus')=='terminated' and result.get('timedOut') and not result.get('cleanupErrors')
 basic=row.get('executionStatus')=='completed' and result.get('exitCode')==0 and not result.get('timedOut') and not result.get('cleanupErrors')
 if wid=='W7':return basic and result.get('outputTruncated') is True
 if wid=='W8':return basic and row.get('hostChat',{}).get('confirmed') is True
 return basic and result.get('stdout','').strip()==workload['expectedStdout']

def run_one(workload,runtime,stage,round_number,sequence,observer,script_id):
 wid=workload['workloadId'];key=f'{sequence:03d}-{wid}-{runtime}'
 if stage=='preflight':folder='functional-preflight'
 elif stage=='warmup':folder='warmups'
 else:folder='measured-runs'
 assert not (OUT/folder/(key+'.json')).exists(),'Attempt already recorded; do not repeat silently'
 assert sha(ROOT/workload['sourcePath'])==workload['sourceHash']
 service_health();assert not cmd(D+['ps','-aq','--filter','name=^/poc-exec-'])['stdout']
 before=observer.keys();timestamp=datetime.now(timezone.utc).isoformat()
 row={'workloadId':wid,'runtime':runtime,'requestedRuntime':runtime,'stage':stage,'round':round_number,'sequence':sequence,'timestamp':timestamp,'sourceHash':workload['sourceHash'],'permissionProfile':workload['permissionProfile'],'imageId':IMAGE,'nativeDockerEngineId':ENGINE,'scriptId':script_id}
 save('intents/'+stage+'-'+key+'.json',row)
 try:
  status,created=http('/api/executions',{'scriptId':script_id,'permissionProfile':workload['permissionProfile']},runtime)
  row['submissionHttpStatus']=status;assert status==201,created;eid=created['id'];row['executionId']=eid
  deadline=time.monotonic()+90;details=None
  while time.monotonic()<deadline:
   _,details=http('/api/executions/'+eid,runtime=runtime)
   execution=details['execution']
   if execution['status'] in ['completed','failed','terminated','blocked'] and execution.get('result') is not None:break
   time.sleep(.1)
  assert details and details['execution']['status'] in ['completed','failed','terminated','blocked'],'API execution did not finalize'
  execution=details['execution'];result=execution['result'];row.update({'executionStatus':execution['status'],'result':result,'traceId':details.get('traceId'),'timeline':details.get('timeline')})
  for _ in range(20):
   evidence=observer.new(before)
   if len(evidence)==1 and any(e['action']=='start' for e in evidence[0]['events']) and any(e['action']=='destroy' for e in evidence[0]['events']):break
   time.sleep(.05)
  evidence=observer.new(before);row['runtimeEvidence']=evidence
  valid=len(evidence)==1 and any(e['action']=='start' for e in evidence[0]['events']) and ('createInspection' in evidence[0] or 'startInspection' in evidence[0])
  inspection=(evidence[0].get('createInspection') or evidence[0].get('startInspection')) if valid else None
  valid=valid and inspection['observedRuntime']==runtime and inspection['imageId']==IMAGE
  row['runtimeEvidenceStatus']='ATTESTED' if valid else 'UNATTESTED';row['observedRuntime']=inspection['observedRuntime'] if valid else None;row['containerId']=evidence[0]['containerId'] if len(evidence)==1 else None
  row['cleanupConfirmed']=not cmd(D+['ps','-aq','--filter','name=^/poc-exec-'])['stdout']
  if wid=='W8':row['hostChat']=w8_details(eid,result)
  row['semanticSuccess']=bool(semantics(workload,row));row['infrastructureInvalid']=not valid or not row['cleanupConfirmed'] or result.get('provider')!='docker' or result.get('failureCategory') in ['supervisor_error','docker_operation_timeout','gateway_admin_timeout']
 except Exception as error:
  row['infrastructureInvalid']=True;row['error']=clean(str(error));row['semanticSuccess']=False
 save(folder+'/'+key+'.json',row)
 print(f'{stage} {sequence} {wid} {runtime}: status={row.get("executionStatus")} expected={row["semanticSuccess"]} evidence={row.get("runtimeEvidenceStatus")} invalid={row["infrastructureInvalid"]}',flush=True)
 if row['infrastructureInvalid']:raise RuntimeError('STOP: infrastructure-invalid or unattested job retained at '+folder+'/'+key+'.json')
 return row

def preflight():
 assert not (OUT/'experiment-manifest.json').exists()
 native_check();service_health();workloads=load('draft-workloads.json')
 scripts=load('script-records.json') if (OUT/'script-records.json').exists() else {}
 for w in workloads:
  if w['workloadId'] not in scripts:
   status,created=http('/api/scripts',{'name':'Phase4 '+w['workloadId'],'source':(ROOT/w['sourcePath']).read_text(),'language':w['language'],'status':'ready'})
   assert status==201,created;scripts[w['workloadId']]=created['script']['id'];save('script-records.json',scripts)
 observer=Observer();rows=[]
 try:
  for n,w in enumerate(workloads,1):
   row=run_one(w,'runc','preflight',0,n,observer,scripts[w['workloadId']]);rows.append(row)
   if not row['semanticSuccess']:raise RuntimeError('STOP: runc functional preflight failed '+w['workloadId'])
 finally:observer.close();save('runc-functional-preflight.json',{'complete':len(rows)==10 and all(r['semanticSuccess'] for r in rows),'attempts':len(rows),'results':[{'workloadId':r['workloadId'],'executionId':r.get('executionId'),'semanticSuccess':r['semanticSuccess'],'runtimeEvidenceStatus':r.get('runtimeEvidenceStatus')} for r in rows]})

def freeze():
 assert not (OUT/'experiment-manifest.json').exists(),'Manifest already frozen'
 assert load('runc-functional-preflight.json')['complete'];native=native_check();service_health();workloads=load('draft-workloads.json');scripts=load('script-records.json')
 for w in workloads:
  assert sha(ROOT/w['sourcePath'])==w['sourceHash']
  _,s=http('/api/scripts/'+scripts[w['workloadId']]);assert hashlib.sha256(s['currentVersion']['source'].encode()).hexdigest()==w['sourceHash']
 old=load('historical-fingerprints-before.json');assert all(sha(ROOT/p)==h for p,h in old.items())
 ids={};safe_services={}
 for name in ['api','api-runsc','runner','runner-runsc','host-gateway','paper','postgres','otel-collector','bridge-builder']:
  obj=dj(['inspect','phase4bc-'+name+'-1'])[0];ids[name]=obj['Image'];safe_services[name]={'imageId':obj['Image'],'networks':list(obj['NetworkSettings']['Networks']),'dockerRuntime':obj['HostConfig']['Runtime']}
 uid=cmd(D+['run','--rm','--runtime=runc','--network=none','--read-only','--user=deno','--entrypoint=/bin/sh',IMAGE,'-c','id -u; id -g']);assert uid['exitCode']==0
 env={'ubuntu':Path('/etc/os-release').read_text(),'kernel':platform.release(),'architecture':platform.machine(),'cpuModel':next((l.split(':',1)[1].strip() for l in Path('/proc/cpuinfo').read_text().splitlines() if l.startswith('model name')),None),'cpuCount':os.cpu_count(),'memory':Path('/proc/meminfo').read_text(),'nativeEngineId':native['ID'],'dockerVersion':dj(['version','--format','{{json .}}']),'runscVersion':cmd(['/usr/bin/runsc','--version']),'runscConfiguration':json.loads(Path('/etc/docker/daemon.json').read_text()),'registeredRuntimes':list(native['Runtimes']),'sandboxImage':dj(['image','inspect',IMAGE])[0]['Id'],'effectiveUidGid':uid['stdout'].splitlines(),'serviceImages':ids,'services':safe_services,'hostBridge':http('/api/host/status')[1]}
 env['wslHostConstraints']=load('wsl-host-constraints.json');env['sandboxDenoVersion']='2.9.7'
 save('environment.json',env);save('frozen-workloads.json',workloads)
 frozen_paths=[w['sourcePath'] for w in workloads]+['compose.yaml','compose.phase4bc.yaml','scripts/phase4bc-experiment.py','services/runner/src/docker.ts','services/runner/src/config.ts','services/runner/src/permissions.ts','services/sandbox/entrypoint.sh','services/sandbox/import_map.json','services/sandbox/host/chat.ts']
 plan=[]
 for stage,rounds in [('warmup',[0]),('measured',range(1,6))]:
  for rnd in rounds:
   for w in workloads:
    for rt in (['runsc','runc'] if rnd and rnd%2==0 else ['runc','runsc']):plan.append({'stage':stage,'round':rnd,'workloadId':w['workloadId'],'runtime':rt})
 manifest={'status':'FROZEN_BEFORE_FIRST_WARMUP','frozenAt':datetime.now(timezone.utc).isoformat(),'hashes':{p:sha(ROOT/p) for p in frozen_paths},'environmentHash':sha(OUT/'environment.json'),'workloadsHash':sha(OUT/'frozen-workloads.json'),'privateConfigurationHash':sha(ROOT/'.env.phase4bc'),'imageId':IMAGE,'nativeDockerEngineId':ENGINE,'repetitions':5,'warmupsPerWorkloadRuntime':1,'plannedWarmups':20,'plannedMeasured':100,'order':plan,'policy':{'cpus':.5,'memoryBytes':268435456,'pidsLimit':64,'readOnlyRoot':True,'user':'deno','tmpfs':{'workspace':'64m','tmp':'16m'},'dropCapabilities':['ALL'],'noNewPrivileges':True,'timeoutMs':10000,'outputLimitBytes':1048576,'auditMaxEvents':200,'auditMaxBytes':65536,'admissionCapacityPerRunner':2,'experimentConcurrency':1,'hostChatBudget':5,'hostChatMaxLength':256,'sessionTtlMs':40000,'gatewayHostname':'host-gateway','gatewayTransport':'host-gateway:3200','sandboxHostNetwork':'phase4bc-sandbox-host','sandboxHostNetworkInternal':True},'topologyNote':'Two identically built API/supervisor pairs remain running, fixed to explicit runc/runsc; common database, gateway, Paper and collector. API ports 23000/23001; Paper 25575, all loopback. Metrics use supervisor duration, not API-instance latency.','measurementDefinitions':{'duration':'result.durationMs: trusted runner entry through Docker create/attached start/source transfer/capture/inspection/cleanup/session revocation; excludes API queue/poll and later Paper confirmation. Not pure JS time.','stages':'startup-only and script-only unavailable; do not infer them from whole duration.','hostCompletion':'Queue-to-confirmation wall timestamp delta from trusted host_commands created_at/updated_at, separate from supervisor duration.','validComparable':'Attested job with expected workload semantics. W6 expected timeout is a successful semantic outcome. W8 requires Paper confirmation. Failures reported separately, no invented ratio.','statistics':'n,min,median,mean,max; ratios of medians per workload only, warmups and preflights excluded.'},'compatibilityDefinitions':{'COMPATIBLE':'Expected task semantics in all five runs under both runtimes; timing alone is not incompatibility.','COMPATIBLE WITH OBSERVED DIFFERENCE':'Both perform intended task, with a material evidence/outcome difference.','INCOMPATIBLE':'Defined runc baseline works but runsc does not perform intended task under unchanged policy.','INCONCLUSIVE':'Missing runtime evidence or unrelated infrastructure prevents comparison.'},'invalidRunRule':'No automatic reruns. Persist infrastructure-invalid/unattested outcome and stop. Runtime incompatibility, timeout, slow output, or DNS failure is not infrastructure invalidity.','knownDnsLimitationPreserved':True,'postExperimentOnly':'Optional separate direct-IP diagnostic and selected resource probe, never primary results.'}
 save('experiment-manifest.json',manifest);save('manifest-fingerprint.json',{'sha256':sha(OUT/'experiment-manifest.json')});print('Manifest frozen; next step is exactly 20 warmups then 100 ordered measurements.',flush=True)

def execute():
 m=load('experiment-manifest.json');assert sha(OUT/'experiment-manifest.json')==load('manifest-fingerprint.json')['sha256'];assert not (OUT/'execution-state.json').exists(),'Already started; inspect persisted records before recovery'
 workloads={w['workloadId']:w for w in load('frozen-workloads.json')};scripts=load('script-records.json');observer=Observer();done=0;stopped=None
 save('execution-state.json',{'status':'started','completed':0})
 try:
  for index,job in enumerate(m['order'],1):
   assert all(sha(ROOT/p)==h for p,h in m['hashes'].items());assert sha(ROOT/'.env.phase4bc')==m['privateConfigurationHash']
   if index in [1,21,41,61,81,101]:native_check()
   run_one(workloads[job['workloadId']],job['runtime'],job['stage'],job['round'],index,observer,scripts[job['workloadId']]);done+=1
   save('execution-state.json',{'status':'running','completed':done,'lastJob':job})
 except Exception as e:stopped=clean(str(e))
 finally:observer.close()
 save('execution-state.json',{'status':'stopped' if stopped else 'complete','completed':done,'stopped':stopped,'observerErrors':observer.errors,'finishedAt':datetime.now(timezone.utc).isoformat()});print('Experiment '+('STOPPED: '+stopped if stopped else 'COMPLETE'),flush=True)

if __name__=='__main__':
 {'preflight':preflight,'freeze':freeze,'execute':execute}[sys.argv[1]]()
