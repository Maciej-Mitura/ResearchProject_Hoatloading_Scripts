from phase5_common import *
import hashlib
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before=json.loads((OUT/'historical-fingerprints-before.json').read_text())
changed=[p for p,h in before.items() if not (ROOT/p).is_file() or sha(ROOT/p)!=h]
save('historical-integrity.json',{'status':'PASS' if not changed else 'FAIL','existingFilesVerified':len(before),'changedOrMissing':changed,'scope':'All initial snapshot files, including prior frozen phase directories; excludes ignored secrets, dependency/build caches and this new Phase 5 directory.'})
assert not changed,changed
drift=[]
for service,folder in [('api','apps/api/src'),('runner','services/runner/src'),('host-gateway','services/host-gateway/src')]:
 paths=[p for p in (ROOT/folder).rglob('*') if p.is_file()]
 paths += [p for p in (ROOT/'packages/contracts/src').rglob('*') if p.is_file()]
 r=cmd(D+['exec','research-poc-'+service+'-1','sha256sum']+['/workspace/'+p.relative_to(ROOT).as_posix() for p in paths])
 assert r['exitCode']==0,r['stderr']
 pairs={line.split()[1].removeprefix('/workspace/'):line.split()[0] for line in r['stdout'].splitlines()}
 mismatches=[p.relative_to(ROOT).as_posix() for p in paths if pairs.get(p.relative_to(ROOT).as_posix())!=sha(p)]
 drift.append({'service':service,'filesCompared':len(paths),'mismatches':mismatches})
 assert not mismatches,mismatches
save('deployed-source-integrity.json',{'status':'PASS','comparisons':drift,'scope':'Byte hashes of every API/runner/gateway src and shared contracts file inside the actual primary deployed containers versus the current working tree.'})
checks=[]
for args in [D+['compose','config','--quiet'],D+['compose','-p','phase5-repro','--env-file','.env.phase5-repro','-f','compose.yaml','-f','compose.phase5-repro.yaml','config','--quiet']]:
 r=cmd(args);assert r['exitCode']==0,r['stderr'];checks.append({'command':' '.join(args),'exitCode':r['exitCode'],'stderr':r['stderr']})
save('compose-validation.json',{'status':'PASS','checks':checks,'expandedSecretsPrinted':False})
runner=cmd(D+['exec','research-poc-api-1','deno','eval','--allow-net','console.log(JSON.stringify(await (await fetch("http://runner:3100/health")).json()))'])
# Deno eval has implicit permissions; allow-net is not accepted by all deployed versions.
if runner['exitCode']!=0:
 runner=cmd(D+['exec','research-poc-api-1','deno','eval','console.log(JSON.stringify(await (await fetch("http://runner:3100/health")).json()))'])
assert runner['exitCode']==0,runner['stderr']
health=json.loads(runner['stdout']);assert health['admission']['active']==0 and not health['admission']['blocked']
orphans=cmd(D+['ps','-aq','--filter','name=^/poc-exec-']);assert orphans['exitCode']==0 and not orphans['stdout']
containers=dj(['ps','-a','--format','{{json .}}']) if False else None
states=[]
initial=json.loads((OUT/'environment.json').read_text())
for service in ['api','runner','host-gateway','paper','postgres','otel-collector','web']:
 item=dj(['inspect','research-poc-'+service+'-1'])[0]
 states.append({'service':service,'id':item['Id'],'image':item['Image'],'running':item['State']['Running'],'health':item['State'].get('Health',{}).get('Status')})
assert all(s['running'] for s in states)
db=pg("SELECT json_build_object('nonterminalExecutions',(SELECT count(*) FROM executions WHERE status NOT IN ('completed','failed','terminated')),'pendingCommands',(SELECT count(*) FROM host_commands WHERE status IN ('queued','delivered')));")
assert db['nonterminalExecutions']==0 and db['pendingCommands']==0,db
repro=dj(['inspect','phase5-repro-api-1'])[0];assert not repro['State']['Running']
save('final-environment.json',{'status':'PASS','apiHealth':http('/health')[1],'hostStatus':http('/api/host/status')[1],'runnerHealth':health,'primaryServices':states,'orphanSandboxContainers':0,'databaseFinalState':db,'collectorRestored':True,'disposableServicesStopped':True,'workingDataRemoved':False})
print('Historical files, deployed source, both Compose configurations, restored primary services, empty admission and no orphan/pending jobs: PASS.')
