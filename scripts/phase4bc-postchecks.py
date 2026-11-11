"""Separate post-experiment resource and explanatory IP diagnostic. No primary edits."""
from pathlib import Path
import json,subprocess,os
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched'
D=['/usr/bin/docker','--host','unix:///var/run/docker.sock']
ENV={k:v for k,v in os.environ.items() if k not in {'DOCKER_HOST','DOCKER_CONTEXT'}}
def cmd(args):
 p=subprocess.run(D+args,capture_output=True,text=True,env=ENV,timeout=40)
 return {'exitCode':p.returncode,'stdout':p.stdout.strip(),'stderr':p.stderr.strip()}
def dj(a):
 p=cmd(a);assert p['exitCode']==0,p['stderr'];return json.loads(p['stdout'])
def save(n,v):(OUT/n).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
assert json.loads((OUT/'execution-state.json').read_text())['status']=='complete','POST-EXPERIMENT ONLY'
image=json.loads((OUT/'experiment-manifest.json').read_text())['imageId']
name='phase4bc-resource-check'
script='id -u; id -g; if touch /phase4-resource-write 2>/tmp/root-error; then echo root_write=UNEXPECTED; else echo root_write=denied; cat /tmp/root-error; fi; echo workspace-ok >/workspace/resource-check; cat /workspace/resource-check;'
row={'label':'POST-EXPERIMENT RESOURCE VALIDATION','primaryMeasurement':False}
try:
 row['probe']=cmd(['run','--pull=never','--name',name,'--runtime=runsc','--network=none','--read-only','--user=deno','--cap-drop=ALL','--security-opt=no-new-privileges:true','--pids-limit=64','--cpus=0.5','--memory=256m','--memory-swap=256m','--tmpfs=/workspace:rw,size=64m,mode=1777','--tmpfs=/tmp:rw,size=16m,mode=1777','--entrypoint=/bin/sh',image,'-c',script])
 o=dj(['inspect',name])[0];h=o['HostConfig'];row['runtimeEvidence']={'containerId':o['Id'],'observedRuntime':h['Runtime'],'imageId':o['Image'],'user':o['Config']['User'],'controls':{k:h.get(k) for k in ['ReadonlyRootfs','CapDrop','SecurityOpt','NanoCpus','Memory','MemorySwap','PidsLimit','Tmpfs','NetworkMode']},'state':{k:o['State'].get(k) for k in ['Status','ExitCode','OOMKilled']}}
 row['effectiveUidGid']=row['probe']['stdout'].splitlines()[:2]
 row['nonRootBehavior']=row['effectiveUidGid']==['1000','1000']
 row['rootWriteDenied']= 'root_write=denied' in row['probe']['stdout']
 row['readOnlyFilesystemErrorObserved']='Read-only file system' in row['probe']['stdout']
 row['workspaceWriteSucceeded']='workspace-ok' in row['probe']['stdout']
finally:row['cleanup']=cmd(['rm','-f',name]);save('resource-probe.json',row)

measured=[json.loads(p.read_text()) for p in (OUT/'measured-runs').glob('*.json')]
if any(r['workloadId']=='W8' and r['runtime']=='runsc' and not r['semanticSuccess'] for r in measured):
 name='phase4bc-post-dns-ip';gateway=dj(['inspect','phase4bc-host-gateway-1'])[0];ip=gateway['NetworkSettings']['Networks']['phase4bc-sandbox-host']['IPAddress']
 busybox=dj(['image','inspect','busybox:1.37.0'])[0]['Id'];diag={'label':'POST-EXPERIMENT DIAGNOSTIC','primaryMeasurement':False,'purpose':'Distinguish name resolution from ability to reach the capability listener; harmless GET /health only, no capability token or broadcast.','network':'phase4bc-sandbox-host','endpoint':'http://'+ip+':3200/health','primaryGatewayHostnameUnchanged':True,'runtimeArgumentsUnchanged':True}
 try:
  diag['probe']=cmd(['run','--pull=never','--name',name,'--runtime=runsc','--network=phase4bc-sandbox-host','--read-only','--user=65534:65534','--cap-drop=ALL','--security-opt=no-new-privileges:true','--pids-limit=64','--cpus=0.5','--memory=256m','--memory-swap=256m',busybox,'wget','-qO-','-T','5',diag['endpoint']])
  o=dj(['inspect',name])[0];diag['runtimeEvidence']={'containerId':o['Id'],'observedRuntime':o['HostConfig']['Runtime'],'imageId':o['Image'],'networkMode':o['HostConfig']['NetworkMode'],'exitCode':o['State']['ExitCode']}
  try:diag['gatewayResponse']=json.loads(diag['probe']['stdout'])
  except ValueError:diag['gatewayResponse']=None
  diag['directIpHealthSucceeded']=diag['probe']['exitCode']==0 and diag.get('gatewayResponse',{}).get('status')=='ok'
 finally:diag['cleanup']=cmd(['rm','-f',name]);save('post-experiment-dns-diagnostic.json',diag)
 print(json.dumps({'resourceNonRoot':row['nonRootBehavior'],'readOnlyError':row['readOnlyFilesystemErrorObserved'],'directIpHealthSucceeded':diag.get('directIpHealthSucceeded')}),flush=True)
