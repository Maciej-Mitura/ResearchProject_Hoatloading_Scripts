"""Trusted additive native-WSL environment probes. No benchmark workloads."""
from pathlib import Path
import hashlib
import json
import os
import platform
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'research-results/phase4-gvisor/2026-11-09T14-09-00Z-phase4a-native-wsl'
DOCKER = ['/usr/bin/docker','--host','unix:///var/run/docker.sock']
ENV = {k:v for k,v in os.environ.items() if k not in {'DOCKER_HOST','DOCKER_CONTEXT'}}
def save(name,obj): (OUT/name).write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8')
def cmd(args,timeout=40):
    try:
        p=subprocess.run(args,cwd=ROOT,env=ENV,capture_output=True,text=True,timeout=timeout)
        return {'argv':args,'exitCode':p.returncode,'stdout':p.stdout.strip(),'stderr':p.stderr.strip()}
    except subprocess.TimeoutExpired:
        return {'argv':args,'exitCode':None,'stdout':'','stderr':'bounded_probe_timeout'}
def dj(args):
    r=cmd(DOCKER+args)
    if r['exitCode']!=0: raise RuntimeError(r['stderr'])
    return json.loads(r['stdout'])
def identity():
    v=dj(['version','--format','{{json .}}']); i=dj(['info','--format','{{json .}}'])
    assert i['OperatingSystem'].startswith('Ubuntu') and i['DockerRootDir']=='/var/lib/docker'
    desktop=json.loads((OUT/'desktop-before.json').read_text())['info']['stdout']
    assert i['ID']!=desktop['ID']
    pid=cmd(['systemctl','show','docker.service','--property=MainPID','--value'])['stdout']
    return {'experimentHostHash':hashlib.sha256(Path('/etc/machine-id').read_bytes()).hexdigest(),'kernel':platform.release(),'architecture':platform.machine(),'dockerVersion':v,'dockerInfo':{k:i.get(k) for k in ['ID','OperatingSystem','DockerRootDir','KernelVersion','DefaultRuntime','CgroupVersion','CgroupDriver','SecurityOptions','Driver']},'registeredRuntimes':{k:{'path':r.get('path'),'runtimeArgs':r.get('runtimeArgs')} for k,r in i['Runtimes'].items()},'daemonService':cmd(['systemctl','show','docker.service','--property=MainPID,ExecStart,ActiveState,SubState,FragmentPath']),'daemonPid':int(pid),'daemonExe':os.readlink('/proc/'+pid+'/exe'),'daemonNetworkNamespace':os.readlink('/proc/'+pid+'/ns/net'),'socket':cmd(['stat','-c','%F %U:%G %a %n','/var/run/docker.sock']),'socketResolvedPath':str(Path('/var/run/docker.sock').resolve()),'explicitSocket':'unix:///var/run/docker.sock','dockerCliPath':'/usr/bin/docker','context':cmd(['/usr/bin/docker','context','show'])['stdout']}
def inspection(obj):
    host=obj['HostConfig']; state=obj['State']
    return {'containerId':obj['Id'],'containerName':obj['Name'],'imageId':obj['Image'],'inspectedRuntime':host['Runtime'],'state':{k:state.get(k) for k in ['Status','Running','Pid','ExitCode','OOMKilled','Error','StartedAt','FinishedAt']},'controls':{k:host.get(k) for k in ['NetworkMode','ReadonlyRootfs','CapDrop','SecurityOpt','Memory','MemorySwap','NanoCpus','PidsLimit','Tmpfs']},'user':obj['Config'].get('User')}
def runsc_host_evidence(container_id):
    evidence=[]
    for p in Path('/proc').iterdir():
        if not p.name.isdigit():continue
        try:
            exe=os.readlink(p/'exe');args=(p/'cmdline').read_bytes().decode(errors='replace').split('\0')
            if ('runsc' in exe or 'gvisor' in exe or 'runsc' in args[0]) and any(container_id in a for a in args):
                evidence.append({'pid':int(p.name),'exe':exe,'argv':[a for a in args if a]})
        except (OSError,ProcessLookupError):pass
    root=Path('/run/docker/runtime-runsc/moby')
    return {'processesTiedToContainer':evidence,'runscList':cmd(['/usr/bin/runsc','--root='+str(root),'list','--format=json']) if root.exists() else None}
def probe(stage,runtime,image,project=False):
    name='phase4a-'+stage+'-'+runtime+'-'+uuid.uuid4().hex[:8]
    args=DOCKER+['run','-d','--pull=never','--name',name,'--runtime='+runtime,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--pids-limit=64','--cpus=0.5','--memory=256m','--memory-swap=256m','--tmpfs=/workspace:rw,size=64m,mode=1777','--tmpfs=/tmp:rw,size=16m,mode=1777','--user='+('deno' if project else '65534:65534'),'--entrypoint=/bin/sh',image,'-c',('deno --version; sleep 2' if project else 'echo phase4a-generic-ok; sleep 2')]
    launched=cmd(args);row={'stage':stage,'requestedRuntime':runtime,'requestedImage':image,'launch':launched,'observedRuntime':None,'host':identity()}
    try:
        if launched['exitCode']!=0:raise RuntimeError('Container launch failed: '+launched['stderr'])
        obj=dj(['inspect',name])[0];row['runtimeEvidence']=inspection(obj);row['observedRuntime']=obj['HostConfig']['Runtime'];row['containerId']=obj['Id']
        if runtime=='runsc':
            row['hostRuntimeEvidence']=runsc_host_evidence(obj['Id']);row['supportingDmesg']=cmd(DOCKER+['exec',name,'dmesg'])
        row['wait']=cmd(DOCKER+['wait',name]);row['logs']=cmd(DOCKER+['logs',name]);row['finalInspection']=inspection(dj(['inspect',name])[0])
        row['success']=row['observedRuntime']==runtime and row['wait']['exitCode']==0 and row['wait']['stdout']=='0' and ('deno 2.9.7' if project else 'phase4a-generic-ok') in row['logs']['stdout']
    except Exception as e:row['success']=False;row['error']=str(e)
    finally:
        row['cleanup']=cmd(DOCKER+['rm','-f',name]);row['cleanupConfirmed']=cmd(DOCKER+['inspect',name])['exitCode']!=0
        save(stage+'-'+runtime+'.json',row)
    print(json.dumps({'stage':stage,'runtime':runtime,'success':row['success'],'error':row.get('error'),'observedRuntime':row.get('observedRuntime')},indent=2))
    if not row['success']:sys.exit(2)

mode=sys.argv[1]
if mode=='native-runc':
    save('native-docker-before-gvisor.json',identity())
    pull=cmd(DOCKER+['pull','busybox:1.37.0'],120);save('generic-image-pull.json',pull)
    assert pull['exitCode']==0
    image=dj(['image','inspect','busybox:1.37.0'])[0]
    save('generic-image.json',{k:image[k] for k in ['Id','RepoDigests','Architecture','Os']})
    probe('generic','runc',image['Id'])
elif mode=='generic-runsc':
    assert json.loads((OUT/'generic-runc.json').read_text())['success']
    save('native-docker-with-gvisor.json',identity())
    save('gvisor-version.json',{'version':cmd(['/usr/bin/runsc','--version']),'package':cmd(['dpkg-query','-W','-f=${Package} ${Version}\n','runsc']),'daemonConfiguration':json.loads(Path('/etc/docker/daemon.json').read_text()),'flags':cmd(['/usr/bin/runsc','flags'])})
    probe('generic','runsc',json.loads((OUT/'generic-image.json').read_text())['Id'])
elif mode=='project':
    assert json.loads((OUT/'generic-runsc.json').read_text())['success']
    image=dj(['image','inspect','research-poc-sandbox:local'])[0]
    save('project-image.json',{k:image[k] for k in ['Id','RepoDigests','Architecture','Os','Created']})
    for runtime in ['runc','runsc']:probe('project-image',runtime,image['Id'],True)
else:raise ValueError(mode)
