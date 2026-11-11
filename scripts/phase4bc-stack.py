"""Native-only matched-experiment stack preparation; never runs W1-W10."""
from pathlib import Path
import json,os,subprocess,sys,time,urllib.request,hashlib,platform
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched'
D=['/usr/bin/docker','--host','unix:///var/run/docker.sock']
C=D+['compose','-p','phase4bc','--env-file',str(ROOT/'.env.phase4bc'),'-f',str(ROOT/'compose.yaml'),'-f',str(ROOT/'compose.phase4bc.yaml')]
ENV={k:v for k,v in os.environ.items() if k not in {'DOCKER_HOST','DOCKER_CONTEXT'}}
SECRETS=[]
for n in ['.env','.env.phase4bc']:
 for l in (ROOT/n).read_text().splitlines():
  if '=' in l and not l.lstrip().startswith('#'):
   k,v=l.split('=',1);v=v.strip().strip('\"\'')
   if k.endswith(('KEY','TOKEN','PASSWORD','SECRET')) and len(v)>=8:SECRETS.append(v)
def clean(s):
 for v in SECRETS:s=s.replace(v,'REDACTED')
 return s
def save(n,v):(OUT/n).write_text(clean(json.dumps(v,indent=2))+'\n',encoding='utf-8')
def cmd(a,timeout=60):
 p=subprocess.run(a,cwd=ROOT,env=ENV,capture_output=True,text=True,timeout=timeout)
 return {'exitCode':p.returncode,'stdout':clean(p.stdout.strip()),'stderr':clean(p.stderr.strip())}
def dj(a):
 p=cmd(D+a);assert p['exitCode']==0,p['stderr'];return json.loads(p['stdout'])
def http(path,port=23000):return json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}'+path,timeout=5))
mode=sys.argv[1]
if mode=='verify':
 info=dj(['info','--format','{{json .}}']);version=dj(['version','--format','{{json .}}'])
 assert info['ID']=='a82ddab9-8f47-4bd6-bc17-3bb5d18d08b1' and info['OperatingSystem'].startswith('Ubuntu') and info['ServerVersion']=='29.9.3'
 assert info['DefaultRuntime']=='runc' and {'runc','runsc'}<=set(info['Runtimes'])
 assert dj(['image','inspect','research-poc-sandbox:local'])[0]['Id']=='sha256:90ab4f290356c3b4d307775656227f1b4a2fff68bf64ae0082705d7d98f82efc'
 runsc=cmd(['/usr/bin/runsc','--version']);assert 'release-20261102.0' in runsc['stdout']
 cfg=json.loads(Path('/etc/docker/daemon.json').read_text());assert cfg=={'runtimes':{'runsc':{'path':'/usr/bin/runsc','runtimeArgs':['--platform=systrap']}}}
 records=[]
 for rt in ['runc','runsc']:
  name='phase4bc-reverify-'+rt
  p=cmd(D+['run','--pull=never','--name',name,'--runtime='+rt,'--network=none','--read-only','--user=deno','--cap-drop=ALL','--security-opt=no-new-privileges:true','--entrypoint=deno','sha256:90ab4f290356c3b4d307775656227f1b4a2fff68bf64ae0082705d7d98f82efc','--version'])
  try:
   o=dj(['inspect',name])[0];row={'requestedRuntime':rt,'observedRuntime':o['HostConfig']['Runtime'],'containerId':o['Id'],'imageId':o['Image'],'probe':p,'state':o['State']};records.append(row)
   assert p['exitCode']==0 and row['observedRuntime']==rt and 'deno 2.9.7' in p['stdout']
  finally:cmd(D+['rm','-f',name])
 save('environment-reverification.json',{'passed':True,'nativeEngineId':info['ID'],'dockerVersion':version,'kernel':platform.release(),'runsc':runsc,'runscConfiguration':cfg,'registeredRuntimes':list(info['Runtimes']),'probes':records})
 print('Native environment and both explicit runtime version probes PASS.',flush=True)
elif mode=='build':
 # Keep full rendered credentials in memory only; persist no raw Compose env.
 p=subprocess.run(C+['config','--format','json'],cwd=ROOT,env=ENV,capture_output=True,text=True)
 assert p.returncode==0,clean(p.stderr)
 cfg=json.loads(p.stdout)
 save('compose-validation.json',{'passed':True,'services':list(cfg['services']),'networks':cfg['networks'],'volumes':list(cfg['volumes']),'publishedPorts':{n:v.get('ports',[]) for n,v in cfg['services'].items()},'secretsPersisted':False})
 result=cmd(C+['build','api','host-gateway','bridge-builder'],1800);(OUT/'stack-build.log').write_text(result['stdout']+'\n'+result['stderr'],encoding='utf-8');assert result['exitCode']==0,'Build failed; inspect sanitized stack-build.log'
 print('Native API/gateway/bridge images built; existing runner/sandbox images retained.',flush=True)
elif mode=='start':
 r=cmd(C+['up','-d','--no-build','postgres','otel-collector','host-gateway','runner','runner-runsc','api'],600);save('stack-start-core.json',r);assert r['exitCode']==0
 ready=False
 for _ in range(90):
  try:
   if http('/health')['db']=='ok':ready=True;break
  except Exception:pass
  time.sleep(2)
 assert ready,'First API/database unhealthy'
 r=cmd(C+['up','-d','--no-build','api-runsc','paper'],900);save('stack-start-paper.json',r);assert r['exitCode']==0
 print('Native stack started. Paper/bridge readiness must pass before preflights.',flush=True)
elif mode=='resume-start':
 r=cmd(C+['up','-d','--no-build','runner-runsc','api-runsc','paper'],900);save('stack-start-corrected.json',r);assert r['exitCode']==0,r['stderr'][-1000:]
 print('Corrected full-service inheritance; native stack start resumed before any workload preflight.',flush=True)
elif mode=='restart-after-idle':
 states=[]
 for name in ['api','api-runsc','runner','runner-runsc','paper','postgres','host-gateway','otel-collector']:
  obj=dj(['inspect','phase4bc-'+name+'-1'])[0];states.append({'service':name,'state':{k:obj['State'].get(k) for k in ['Status','ExitCode','OOMKilled','StartedAt','FinishedAt','Error']}})
 save('preparation-service-interruption.json',{'statesBeforeRestart':states,'inference':'Services stopped between WSL commands before any workload; consistent with WSL idle lifecycle. Bounded keepalive process now holds the distro active. No WSL settings changed.','warmupsStarted':False,'measurementsStarted':False})
 r=cmd(C+['up','-d','--no-build','postgres','otel-collector','host-gateway','runner','runner-runsc','api','api-runsc','paper'],900);save('stack-restart-after-idle.json',r);assert r['exitCode']==0,r['stderr'][-1000:]
 print('Native services restarted with bounded WSL keepalive active.',flush=True)
elif mode=='status':
 save('stack-status.json',{'compose':cmd(C+['ps','-a','--format','json']),'apiRunc':http('/health'),'apiRunsc':http('/health',23001),'host':http('/api/host/status')})
 print(json.dumps({'apiRunc':http('/health')['db'],'apiRunsc':http('/health',23001)['db'],'paperBridgeConnected':http('/api/host/status')['connected']}),flush=True)
else:raise ValueError(mode)
