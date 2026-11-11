"""Additive Phase 4 environment gate. Two harmless version probes, no measurements.

No daemon changes, image pulls, application executions or provider requests.
Runtime evidence is Docker/host corroboration, not cryptographic attestation.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import platform
import shutil
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
STAMP = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')
OUT = ROOT / 'research-results/phase4-gvisor' / (STAMP + '-environment-gate')
OUT.mkdir(parents=True, exist_ok=False)
SECRET_VALUES = []
for line in (ROOT / '.env').read_text(encoding='utf-8').splitlines():
    if '=' not in line or line.lstrip().startswith('#'): continue
    key, value = line.split('=', 1)
    value = value.strip().strip('\"\'')
    if key.endswith(('KEY', 'TOKEN', 'PASSWORD', 'SECRET')) and len(value) >= 8: SECRET_VALUES.append(value)

def clean(value):
    if isinstance(value, str):
        for secret in SECRET_VALUES: value = value.replace(secret, 'REDACTED')
        return value
    if isinstance(value, list): return [clean(v) for v in value]
    if isinstance(value, dict): return {k: clean(v) for k, v in value.items()}
    return value

def save(name, value):
    (OUT / name).write_text(json.dumps(clean(value), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def command(args, timeout=30):
    try:
        result = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=timeout, shell=False)
        def decode(data):
            return data.decode('utf-16-le' if b'\x00' in data else 'utf-8', errors='replace').strip('\ufeff\r\n ')
        return {'argv': args, 'exitCode': result.returncode, 'stdout': decode(result.stdout), 'stderr': decode(result.stderr)}
    except subprocess.TimeoutExpired:
        return {'argv': args, 'exitCode': None, 'stdout': '', 'stderr': 'bounded_preflight_command_timeout'}
    except OSError:
        return {'argv': args, 'exitCode': None, 'stdout': '', 'stderr': 'command_unavailable'}

def docker_json(args):
    result = command(['docker'] + args)
    if result['exitCode'] != 0: raise RuntimeError('Docker inspection unavailable: ' + result['stderr'])
    return json.loads(result['stdout'])

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

# Preserve previous research and implementation identity before any container probe.
hashes = {}
for base, dirs, names in os.walk(ROOT):
    dirs[:] = [n for n in dirs if n not in {'.git', 'node_modules', '__pycache__', '.deno'} and not (Path(base) == ROOT / 'research-results' and n == 'phase4-gvisor')]
    for name in names:
        path = Path(base) / name
        if name == '.env': continue
        hashes[path.relative_to(ROOT).as_posix()] = digest(path)
save('historical-fingerprints-before.json', hashes)
version = docker_json(['version', '--format', '{{json .}}'])
info = docker_json(['info', '--format', '{{json .}}'])
context = command(['docker', 'context', 'show'])
image = docker_json(['image', 'inspect', 'research-poc-sandbox:local'])[0]
image_identity = {k: image.get(k) for k in ['Id','RepoTags','RepoDigests','Created','Architecture','Os']}
image_identity['config'] = {k:image['Config'].get(k) for k in ['User','Entrypoint','WorkingDir']}
environment = {'timestamp': STAMP, 'clientHost': {'system':platform.system(),'release':platform.release(),'version':platform.version(),'architecture':platform.machine()}, 'dockerContext':context['stdout'], 'dockerVersion':version, 'dockerServer':{k:info.get(k) for k in ['OperatingSystem','KernelVersion','OSType','Architecture','ServerVersion','DefaultRuntime','NCPU','MemTotal','CgroupVersion','CgroupDriver','SecurityOptions','Warnings']}, 'registeredRuntimes':{k:{'path':v.get('path'),'runtimeArgs':v.get('runtimeArgs')} for k,v in info['Runtimes'].items()}, 'runscOnClientHost':shutil.which('runsc'), 'sandboxImage':image_identity}
if shutil.which('runsc'): environment['runscVersion'] = command(['runsc','--version'])
else: environment['runscVersion'] = None
if platform.system() == 'Windows':
    environment['windowsOS'] = command(['powershell','-NoProfile','-Command','Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture | ConvertTo-Json -Compress'])
    environment['wslDistributions'] = command(['wsl','--list','--verbose'])
    environment['dockerDesktopHostBinaryCheck'] = command(['wsl','-d','docker-desktop','--','sh','-lc','uname -srmo; if command -v runsc; then runsc --version; else printf "runsc_not_found_on_PATH\\n"; fi'])
save('environment.json',environment)

# Only allowlisted operational settings; never persist raw service inspection/env.
service_settings = {}
safe_keys = {'SANDBOX_IMAGE','SANDBOX_DENO_VERSION','SANDBOX_DOCKER_RUNTIME','SANDBOX_TIMEOUT_MS','SANDBOX_MAX_OUTPUT_BYTES','SANDBOX_AUDIT_MAX_EVENTS','SANDBOX_AUDIT_MAX_BYTES','SANDBOX_MAX_ACTIVE','SANDBOX_HOST_NETWORK','HOST_GATEWAY_URL','HOST_GATEWAY_SANDBOX_URL','HOST_GATEWAY_NET_ALLOW','HOST_CHAT_BROADCAST_BUDGET','HOST_CHAT_BROADCAST_MAX_LEN','HOST_SESSION_TTL_MS'}
for service in ['runner','host-gateway']:
    ids = command(['docker','compose','ps','-q',service])
    if ids['exitCode'] == 0 and ids['stdout']:
        inspected = docker_json(['inspect',ids['stdout']])[0]
        env = dict(v.split('=',1) for v in inspected['Config'].get('Env',[]) if '=' in v)
        service_settings[service] = {'imageId':inspected['Image'],'settings':{k:v for k,v in env.items() if k in safe_keys},'dockerRuntimeConfiguredForService':inspected['HostConfig']['Runtime']}
network = docker_json(['network','inspect','research-poc-sandbox-host'])[0]
save('current-policy.json', {'services':service_settings,'sandboxHostNetwork':{k:network.get(k) for k in ['Name','Driver','Internal','EnableIPv6']},'comparisonNotFrozen':'No matched configuration can be finalized until a suitable Linux host and exact runsc version are verified.'})
probes=[]
for runtime in ['runc','runsc']:
    name = 'phase4-runtime-probe-' + runtime + '-' + uuid.uuid4().hex[:10]
    args = ['docker','run','--pull=never','--name',name,'--runtime='+runtime,'--network=none','--read-only','--user=deno','--cap-drop=ALL','--security-opt=no-new-privileges:true','--cpus=0.5','--memory=256m','--memory-swap=256m','--pids-limit=64','--tmpfs=/workspace:rw,size=64m,mode=1777','--tmpfs=/tmp:rw,size=16m,mode=1777','--entrypoint=deno',image['Id'],'--version']
    row={'requestedRuntime':runtime,'purpose':'Harmless Deno version environment gate, not a research workload or performance measurement','probe':command(args),'observedRuntime':None,'runtimeEvidence':None,'cleanup':None}
    inspected=command(['docker','inspect',name])
    if inspected['exitCode']==0:
        obj=json.loads(inspected['stdout'])[0];host=obj['HostConfig']
        row['observedRuntime']=host.get('Runtime') if row['probe']['exitCode']==0 and obj['State'].get('ExitCode')==0 else None
        row['runtimeEvidence']={'containerId':obj['Id'],'containerName':obj['Name'],'imageId':obj['Image'],'dockerInspectRuntime':host.get('Runtime'),'state':{k:obj['State'].get(k) for k in ['Status','Running','ExitCode','OOMKilled','Error','StartedAt','FinishedAt']},'controls':{k:host.get(k) for k in ['ReadonlyRootfs','CapDrop','SecurityOpt','NanoCpus','Memory','MemorySwap','PidsLimit','NetworkMode','Tmpfs']},'containerUser':obj['Config'].get('User'),'assurance':'Docker daemon report plus successful fixed local version probe; no independent host process attestation and no cryptographic guarantee.'}
        row['cleanup']=command(['docker','rm','-f',name])
        row['cleanup']['confirmedAbsent']=command(['docker','inspect',name])['exitCode']!=0
    else:
        row['runtimeEvidence']={'containerAbsent':True,'inspectionExitCode':inspected['exitCode'],'assurance':'No successful container runtime observation.'}
        row['cleanup']={'required':False,'reason':'No container exists under this unique probe name.'}
    probes.append(row)
    save('probe-'+runtime+'.json',row)
save('runtime-evidence.json',probes)
blocked = not all(r['probe']['exitCode']==0 and r['observedRuntime']==r['requestedRuntime'] for r in probes)
assert all(digest(ROOT/path)==h for path,h in hashes.items()), 'Historical artifact unexpectedly changed'
save('integrity.json',{'historicalFilesChecked':len(hashes),'unchanged':True,'matchedWorkloadExecutions':0,'warmupExecutions':0,'performanceMeasurements':0,'daemonConfigurationChanged':False,'runtimeInstallationAttempted':False})
save('summary.json',{'status':'BLOCKED' if blocked else 'ENVIRONMENT GATE PASSED — MAIN EXPERIMENT NOT STARTED','reason':'Real runsc container probe did not succeed' if blocked else None,'runcProbeExitCode':probes[0]['probe']['exitCode'],'runscProbeExitCode':probes[1]['probe']['exitCode'],'actualRunscWorkloadObserved':probes[1]['observedRuntime']=='runsc','mainExperimentStarted':False,'phase5Started':False})
print(json.dumps({'resultDirectory':str(OUT),'status':'BLOCKED' if blocked else 'GATE_PASSED','runcProbeExitCode':probes[0]['probe']['exitCode'],'runscProbeExitCode':probes[1]['probe']['exitCode'],'runscError':probes[1]['probe']['stderr'],'historicalFilesUnchanged':len(hashes)},indent=2))
