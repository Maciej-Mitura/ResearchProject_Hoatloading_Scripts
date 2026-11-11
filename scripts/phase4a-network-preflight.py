"""Isolated bridge/DNS environment probe only; no host capabilities or benchmark."""
from pathlib import Path
import json,subprocess,os
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'research-results/phase4-gvisor/2026-11-09T14-09-00Z-phase4a-native-wsl'
D=['/usr/bin/docker','--host','unix:///var/run/docker.sock']
ENV={k:v for k,v in os.environ.items() if k not in {'DOCKER_HOST','DOCKER_CONTEXT'}}
def cmd(a):
 p=subprocess.run(D+a,capture_output=True,text=True,env=ENV,timeout=40)
 return {'exitCode':p.returncode,'stdout':p.stdout.strip(),'stderr':p.stderr.strip()}
network='phase4a-isolated-dns';peer='phase4a-dns-peer';client='phase4a-dns-runsc'
row={'purpose':'Generic internal-bridge DNS preflight, not Host Gateway/Paper validation','runtimeArgsAdded':False,'hostNetworkingUsed':False}
image=json.loads((OUT/'generic-image.json').read_text())['Id']
try:
 row['networkCreate']=cmd(['network','create','--internal',network]);assert row['networkCreate']['exitCode']==0
 row['peerCreate']=cmd(['run','-d','--pull=never','--runtime=runc','--name',peer,'--network='+network,'--cap-drop=ALL','--security-opt=no-new-privileges:true','--read-only','--user=65534:65534',image,'sleep','30']);assert row['peerCreate']['exitCode']==0
 row['dnsProbe']=cmd(['run','--pull=never','--runtime=runsc','--name',client,'--network='+network,'--cap-drop=ALL','--security-opt=no-new-privileges:true','--read-only','--user=65534:65534',image,'nslookup',peer])
 r=cmd(['inspect',client]);o=json.loads(r['stdout'])[0]
 row['runtimeEvidence']={'containerId':o['Id'],'imageId':o['Image'],'observedRuntime':o['HostConfig']['Runtime'],'networkMode':o['HostConfig']['NetworkMode'],'exitCode':o['State']['ExitCode']}
 row['success']=row['dnsProbe']['exitCode']==0 and row['runtimeEvidence']['observedRuntime']=='runsc'
except Exception as e:row['success']=False;row['error']=str(e)
finally:
 row['cleanupContainers']=cmd(['rm','-f',client,peer]);row['cleanupNetwork']=cmd(['network','rm',network])
 (OUT/'isolated-network-probe.json').write_text(json.dumps(row,indent=2)+'\n')
print(json.dumps({'success':row['success'],'error':row.get('error'),'dns':row.get('dnsProbe')},indent=2))
raise SystemExit(0 if row['success'] else 2)
