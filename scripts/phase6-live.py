from phase6_common import *
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
 before=observer.keys();created_status,created=http('/api/scripts',{'name':'Phase6 '+cid,'language':'javascript','source':source,'status':'ready'},base);assert created_status==201,created
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


if __name__=='__main__':
 observer=Observer();rows=[]
 try:
  for cid,filename,profile in [('A','simple-calculation.js','none'),('B','caught-restricted-read.js','none'),('C','welcome-message.js','host-chat'),('D','allowed-fixture.ts','read-fixture'),('E','demo-environment.ts','env-demo')]:
   source=(ROOT/'samples/scripts'/filename).read_text(encoding='utf-8')
   case=run_case(cid,source,profile,observer,host_required=cid=='C')
   x=case['execution']['result'];assert case['execution']['status']=='completed' and x['exitCode']==0
   assert x['auditCollection']['status']=='complete' and not x['cleanupErrors']
   if cid=='A':assert '4' in x['stdout'] and 'Hello' in x['stdout']
   if cid=='B':assert 'script continued' in x['stdout'] and x['permissionEvents']
   if cid=='C':assert case['hostConfirmed']
   if cid=='D':assert 'intentionally readable' in x['stdout']
   if cid=='E':assert 'hello-from-supervisor' in x['stdout']
   rows.append({'caseId':cid,'sample':filename,'profile':profile,'executionId':case['executionId'],'traceId':case['traceId'],'verdict':'PASS','hostConfirmed':case.get('hostConfirmed')})
 finally:observer.close();save('live-demo-regression.json',rows)
 assert len(rows)==5
 print('Five current samples passed real runc execution; C Paper-confirmed. No paid provider calls.')
