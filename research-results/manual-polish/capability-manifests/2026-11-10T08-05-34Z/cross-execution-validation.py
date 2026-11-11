from common import *
import time
# Credential inspection is confined to trusted harness memory. Never export tokens or env.
def start(label,requests):
 source='await new Promise(resolve=>setTimeout(resolve,8000)); console.log("Isolation validation complete");'
 status,s=http('/api/scripts',{'name':'[Capability isolation validation] '+label,'source':source,'language':'typescript','requestedCapabilities':requests});assert status==201,s
 sid=s['script']['id'];vid=s['version']['id'];_,m=http(f'/api/scripts/{sid}/versions/{vid}/manifest')
 if requests:
  status,_=http(f'/api/scripts/{sid}/versions/{vid}/manifest/reviews',{'manifestId':m['manifest']['id'],'selected':[r['capability'] for r in requests]});assert status==201
 status,e=http('/api/executions',{'scriptId':sid,'scriptVersionId':vid,'permissionProfile':'host-capabilities'});assert status==201,e
 return e['id']
a=start('A approved spawn',[{'capability':'world.spawnEntity','required':True,'reason':'Bounded isolation validation','constraints':{'maxCalls':1,'entityTypes':['ZOMBIE']}}]);b=start('B no grants',[])
containers={};until=time.monotonic()+5
while time.monotonic()<until and len(containers)<2:
 names=cmd(D+['ps','--filter','name=poc-exec-','--format','{{.Names}}'])['stdout'].splitlines()
 for name in names:
  env=json.loads(cmd(D+['inspect','--format','{{json .Config.Env}}',name])['stdout'])
  credential=next((v.split('=',1)[1] for v in env if v.startswith('HOST_CAPABILITY_TOKEN=')),None)
  if credential and ':' in credential:
   execution,token=credential.split(':',1)
   if execution in [a,b]:containers[execution]=(name,token)
 time.sleep(.05)
assert len(containers)==2,'Both sandbox sessions must be active for isolation validation'
# This transient stdin program is never written to a script, DB, file, argument or report.
program='const cases=INPUT;const out=[];for(const c of cases){const r=await fetch("http://host-gateway:3200/v1/capabilities/world.spawnEntity",{method:"POST",headers:{Authorization:"Bearer "+c.token,"X-Execution-Id":c.execution,"Content-Type":"application/json"},body:JSON.stringify({type:"ZOMBIE",x:0,y:104,z:0})});const b=await r.json();out.push({name:c.name,status:r.status,code:b.error?.code});}console.log(JSON.stringify(out));'
program=program.replace('INPUT',json.dumps([{'name':'B own unapproved session','token':containers[b][1],'execution':b},{'name':'A token with B execution ID','token':containers[a][1],'execution':b},{'name':'A token with forged A execution ID from B sandbox','token':containers[a][1],'execution':a}]))
p=subprocess.run(D+['exec','-i',containers[b][0],'deno','run','--no-check','--allow-net=host-gateway:3200','-'],input=program.encode(),capture_output=True,timeout=8)
assert p.returncode==0,'Isolation probe process failed'
checks=json.loads(p.stdout);assert [r['status'] for r in checks]==[403,403,403],checks
assert checks[-1]['code']=='CAPABILITY_EXECUTION_MISMATCH',checks
for execution in [a,b]:
 until=time.monotonic()+20
 while time.monotonic()<until:
  _,detail=http('/api/executions/'+execution)
  if detail['execution']['status'] in ['completed','failed','terminated']:break
  time.sleep(.2)
 save('runtime-H-'+execution+'.json',detail)
# Verify revocation after the execution with A's credential; emit only status/code.
program='const r=await fetch("http://localhost:3200/v1/capabilities/world.spawnEntity",{method:"POST",headers:{Authorization:"Bearer "+TOKEN,"X-Execution-Id":EXEC,"Content-Type":"application/json"},body:"{}"});const b=await r.json();console.log(JSON.stringify({status:r.status,code:b.error?.code}));'
program=program.replace('TOKEN',json.dumps(containers[a][1])).replace('EXEC',json.dumps(a))
p=subprocess.run(D+['exec','-i','research-poc-host-gateway-1','deno','run','--no-check','--allow-net=localhost:3200','-'],input=program.encode(),capture_output=True,timeout=8)
assert p.returncode==0
revoked=json.loads(p.stdout)
save('runtime-H-summary.json',{'executionA':a,'executionB':b,'activeCredentialChecks':checks,'postExecutionRevocation':revoked,'credentialsRetained':False})
assert revoked['status']==401,revoked
print(json.dumps({'activeCredentialChecks':checks,'postExecutionRevocation':revoked}),flush=True)
