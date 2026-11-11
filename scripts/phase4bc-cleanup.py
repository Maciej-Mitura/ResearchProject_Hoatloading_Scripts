"""Inspect native experiment orphans; stop only owned services after results export."""
from pathlib import Path
import json,subprocess,os,sys,urllib.request
R=Path(__file__).resolve().parents[1];O=R/'research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched'
D=['/usr/bin/docker','--host','unix:///var/run/docker.sock'];E={k:v for k,v in os.environ.items() if k not in {'DOCKER_HOST','DOCKER_CONTEXT'}}
def cmd(a,timeout=60):
 p=subprocess.run(D+a,cwd=R,env=E,capture_output=True,text=True,timeout=timeout);return {'exitCode':p.returncode,'stdout':p.stdout.strip(),'stderr':p.stderr.strip()}
def save(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
assert json.loads((O/'execution-state.json').read_text())['status']=='complete'
if sys.argv[1]=='inspect':
 orphan=cmd(['ps','-aq','--filter','name=^/poc-exec-']);assert orphan['exitCode']==0 and not orphan['stdout']
 services={}
 for n in ['api','api-runsc','runner','runner-runsc','host-gateway','postgres','paper','otel-collector']:
  q=cmd(['inspect','phase4bc-'+n+'-1']);assert q['exitCode']==0;o=json.loads(q['stdout'])[0]
  services[n]={'containerId':o['Id'],'imageId':o['Image'],'status':o['State']['Status'],'restartCount':o['RestartCount'],'health':o['State'].get('Health',{}).get('Status')};assert services[n]['status']=='running'
 health={}
 for rt,name in [('runc','runner'),('runsc','runner-runsc')]:
  q=cmd(['exec','phase4bc-'+name+'-1','deno','eval','console.log(JSON.stringify(await (await fetch("http://127.0.0.1:3100/health")).json()))']);assert q['exitCode']==0
  health[rt]=json.loads(q['stdout']);assert health[rt]['admission']['active']==0 and not health[rt]['admission']['blocked']
 pg=cmd(['exec','phase4bc-postgres-1','psql','-U','poc','-d','research_poc','-At','-c',"SELECT json_build_object('pending',(SELECT count(*) FROM host_commands WHERE status='pending'),'delivered_unfinalized',(SELECT count(*) FROM host_commands WHERE status='delivered'));" ]);assert pg['exitCode']==0;commands=json.loads(pg['stdout']);assert commands=={'pending':0,'delivered_unfinalized':0}
 extras=cmd(['network','inspect','phase4bc_default']);extra_cleanup=None
 if extras['exitCode']==0:
  network=json.loads(extras['stdout'])[0]
  if not network.get('Containers') and network.get('Labels',{}).get('com.docker.compose.project')=='phase4bc':extra_cleanup=cmd(['network','rm','phase4bc_default'])
 save('cleanup-inspection.json',{'noRunningOrStoppedSandboxContainers':True,'nativeServicesBeforeStop':services,'admission':health,'hostCommands':commands,'gatewaySessionEnumeration':'Unavailable through public API; no debug endpoint added. All recorded session revocations returned without cleanup errors; 40-second TTL remains unchanged. Stopping owned gateway after export clears process-local sessions.','unusedPreparationNetworkRemoval':extra_cleanup,'intentionalRetainedResources':'Native service containers, named volumes, two application networks and installed images; stopped after result export.'})
 print('No sandbox orphans; both admission counters zero; no pending or unfinalized host commands.',flush=True)
elif sys.argv[1]=='stop':
 assert (O/'analysis.json').exists() and (O/'cleanup-inspection.json').exists()
 c=['compose','-p','phase4bc','--env-file',str(R/'.env.phase4bc'),'-f',str(R/'compose.yaml'),'-f',str(R/'compose.phase4bc.yaml')]
 stopped=cmd(c+['stop'],180);save('native-stack-stop.json',{'reason':'Intentional post-experiment resource cleanup after evidence export. No volume, image or Desktop data removal.','result':stopped});assert stopped['exitCode']==0
 print('Owned native experiment services stopped; volumes/images preserved.',flush=True)
else:raise ValueError(sys.argv[1])
