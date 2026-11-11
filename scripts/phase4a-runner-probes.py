"""One real HTTP supervisor probe per runtime with trusted external host evidence.

No production runner modifications. Per-job observation is serialized and bound to
the sole sandbox start event during the trusted HTTP execution window.
"""
from pathlib import Path
from datetime import datetime,timezone
import hashlib
import json
import os
import subprocess
import threading
import time
import uuid

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'research-results/phase4-gvisor/2026-11-09T14-09-00Z-phase4a-native-wsl'
D=['/usr/bin/docker','--host','unix:///var/run/docker.sock']
ENV={k:v for k,v in os.environ.items() if k not in {'DOCKER_HOST','DOCKER_CONTEXT'}}
SOURCE='console.log("phase4a-runner-hello"); await new Promise(resolve => setTimeout(resolve, 2000)); console.log("phase4a-runner-done");'
def save(n,v):(OUT/n).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
def cmd(args,timeout=35):
    p=subprocess.run(args,cwd=ROOT,env=ENV,capture_output=True,text=True,timeout=timeout)
    return {'exitCode':p.returncode,'stdout':p.stdout.strip(),'stderr':p.stderr.strip()}
def dj(args):
    r=cmd(D+args)
    if r['exitCode']!=0:raise RuntimeError(r['stderr'])
    return json.loads(r['stdout'])
def inspect_job(cid):
    o=dj(['inspect',cid])[0];h=o['HostConfig'];s=o['State']
    return {'containerId':o['Id'],'containerName':o['Name'],'imageId':o['Image'],'observedRuntime':h['Runtime'],'user':o['Config']['User'],'state':{k:s.get(k) for k in ['Status','Running','Pid','ExitCode','OOMKilled','StartedAt','FinishedAt']},'controls':{k:h.get(k) for k in ['NetworkMode','ReadonlyRootfs','CapDrop','SecurityOpt','NanoCpus','Memory','MemorySwap','PidsLimit','Tmpfs']}}
def runtime_processes(cid):
    rows=[]
    for p in Path('/proc').iterdir():
        if not p.name.isdigit():continue
        try:
            exe=os.readlink(p/'exe');argv=(p/'cmdline').read_bytes().decode(errors='replace').split('\0')
            if ('runsc' in exe or 'gvisor' in exe or 'runsc' in argv[0]) and any(cid in a for a in argv):rows.append({'pid':int(p.name),'exe':exe,'argv':[a for a in argv if a]})
        except OSError:pass
    return rows

native=dj(['info','--format','{{json .}}'])
assert native['OperatingSystem'].startswith('Ubuntu') and native['DefaultRuntime']=='runc' and 'runsc' in native['Runtimes']
assert json.loads((OUT/'project-image-runc.json').read_text())['success'] and json.loads((OUT/'project-image-runsc.json').read_text())['success']
image=dj(['image','inspect','research-poc-sandbox:local'])[0]['Id']
runner_image=dj(['image','inspect','research-poc-runner:phase4a'])[0]['Id']
assert not cmd(D+['ps','-aq','--filter','name=^/poc-exec-'])['stdout']
save('runner-probe-plan.json',{'purpose':'Environment preflight only, not W1-W10 warmup or measurement','source':SOURCE,'sourceHash':hashlib.sha256(SOURCE.encode()).hexdigest(),'permissionProfile':'none','language':'javascript','sandboxImage':image,'runnerImage':runner_image,'runtimes':['runc','runsc'],'requestsPerRuntime':1,'productionCodeChanged':False,'binding':'Exclusive new native engine; one supervisor/request at a time, no existing job containers; require exactly one matching sandbox start event in each HTTP execution window.'})
for runtime in ['runc','runsc']:
    name='phase4a-supervisor-'+runtime
    launched=cmd(D+['run','-d','--pull=never','--name',name,'--runtime=runc','--network=none','--mount=type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock','-e','DOCKER_HOST=unix:///var/run/docker.sock','-e','SANDBOX_IMAGE='+image,'-e','SANDBOX_DENO_VERSION=2.9.7','-e','SANDBOX_DOCKER_RUNTIME='+runtime,'-e','SANDBOX_MAX_ACTIVE=2',runner_image])
    row={'requestedRuntime':runtime,'configuredDockerRuntime':runtime,'supervisorLaunch':launched,'sourceHash':hashlib.sha256(SOURCE.encode()).hexdigest(),'sandboxImage':image,'hostDockerEngineId':native['ID'],'dockerVersion':native['ServerVersion'],'registeredRuntimes':list(native['Runtimes']),'runscVersion':cmd(['/usr/bin/runsc','--version']) if runtime=='runsc' else None,'runscConfiguration':json.loads(Path('/etc/docker/daemon.json').read_text()) if runtime=='runsc' else None,'experimentHostHash':hashlib.sha256(Path('/etc/machine-id').read_bytes()).hexdigest()}
    watcher=None;thread=None;events=[];observations=[];observer_errors=[]
    try:
        assert launched['exitCode']==0,launched['stderr']
        ready=False
        for _ in range(20):
            health=cmd(D+['exec',name,'deno','eval','const r=await fetch("http://127.0.0.1:3100/health"); console.log(JSON.stringify(await r.json()));'])
            if health['exitCode']==0:
                data=json.loads(health['stdout'])
                if data['status']=='ok' and data['admission']['active']==0 and data['dockerRuntime']==runtime:ready=True;row['health']=data;break
            time.sleep(.5)
        assert ready,'Trusted runner not healthy'
        since=datetime.now(timezone.utc).isoformat()
        watcher=subprocess.Popen(D+['events','--since',since,'--filter','type=container','--filter','event=start','--format','{{json .}}'],cwd=ROOT,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        def observe():
            for line in watcher.stdout:
                try:
                    event=json.loads(line);attrs=event.get('Actor',{}).get('Attributes',{})
                    if not attrs.get('name','').startswith('poc-exec-'):continue
                    cid=event['Actor']['ID'];events.append(event)
                    obs=inspect_job(cid)
                    if runtime=='runsc':obs['hostRuntimeProcesses']=runtime_processes(cid)
                    observations.append(obs)
                except Exception as e:observer_errors.append(str(e))
        thread=threading.Thread(target=observe,daemon=True);thread.start()
        execution_id=str(uuid.uuid4());trace_id=uuid.uuid4().hex
        request={'executionId':execution_id,'traceId':trace_id,'source':SOURCE,'language':'javascript','permissionProfile':'none'}
        # Payload is an argv value to deno eval, never interpreted by a shell.
        client='const r=await fetch("http://127.0.0.1:3100/execute",{method:"POST",headers:{"content-type":"application/json"},body:Deno.args[0]});console.log(JSON.stringify({httpStatus:r.status,body:await r.json()}));'
        row['request']={k:v for k,v in request.items() if k!='source'};row['windowStarted']=since
        response=cmd(D+['exec',name,'deno','eval',client,json.dumps(request)],45)
        row['httpClient']=response
        assert response['exitCode']==0,response['stderr']
        parsed=json.loads(response['stdout']);row['response']=parsed
        time.sleep(.2)
        watcher.terminate();thread.join(timeout=3)
        row['runtimeEvents']=events;row['runtimeEvidence']=observations;row['observerErrors']=observer_errors
        assert len(events)==len(observations)==1 and not observer_errors,'Unambiguous host-side runtime evidence unavailable'
        result=parsed['body'];obs=observations[0]
        assert parsed['httpStatus']==200 and result['status']=='completed' and result['exitCode']==0
        assert result['stdout'].strip()=='phase4a-runner-hello\nphase4a-runner-done'
        assert result['runtimeVersion']=='2.9.7' and result['manifest']['dockerRuntime']==runtime
        assert result['auditCollection']['status']=='complete' and not result['cleanupErrors']
        assert obs['observedRuntime']==runtime and obs['imageId']==image
        if runtime=='runsc':assert obs['hostRuntimeProcesses'],'No host runtime corroboration'
        absent=cmd(D+['inspect',obs['containerId']]);row['jobCleanupConfirmed']=absent['exitCode']!=0
        assert row['jobCleanupConfirmed']
        row['observedRuntime']=obs['observedRuntime'];row['success']=True
    except Exception as e:
        row['success']=False;row['error']=str(e)
        row['supervisorLogs']=cmd(D+['logs',name])
    finally:
        if watcher and watcher.poll() is None:watcher.terminate()
        if thread:thread.join(timeout=3)
        row['supervisorCleanup']=cmd(D+['rm','-f',name])
        save('runner-path-'+runtime+'.json',row)
    print(json.dumps({'runtime':runtime,'success':row['success'],'error':row.get('error'),'observedRuntime':row.get('observedRuntime')},indent=2),flush=True)
    if not row['success']:raise SystemExit(2)
