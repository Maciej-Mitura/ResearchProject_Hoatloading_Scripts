from phase6_common import *
import hashlib,re,time
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
resume=OUT/'resume-validation'
checks=[]
for files in [['compose.yaml'],['compose.yaml','compose.gvisor.yaml'],['compose.yaml','compose.phase5-repro.yaml']]:
 args=D+['compose']
 if files[-1]=='compose.phase5-repro.yaml':args+=['-p','phase5-repro','--env-file','.env.phase5-repro']
 for file in files:args+=['-f',file]
 result=cmd(args+['config','--quiet']);assert result['exitCode']==0,result['stderr']
 checks.append({'files':files,'exitCode':0,'expandedConfigurationPrinted':False})
save('compose-validation.json',{'status':'PASS','checks':checks})
r=cmd(D+['exec','research-poc-api-1','deno','run','--allow-net','--allow-env','--allow-read','src/db/migrate.ts']);save('deployed-migration-process.json',r);assert r['exitCode']==0,r['stderr']
schema=pg("SELECT json_build_object('migrations',(SELECT json_agg(id ORDER BY id) FROM schema_migrations),'stockDemos',(SELECT json_agg(row_to_json(t)) FROM (SELECT s.id,s.name,v.version_number FROM scripts s JOIN script_versions v ON v.id=s.current_version_id WHERE s.id::text LIKE '22222222-2222-2222-2222-22222222220%')t),'nonterminalExecutions',(SELECT count(*) FROM executions WHERE status NOT IN ('completed','failed','terminated')),'pendingCommands',(SELECT count(*) FROM host_commands WHERE status IN ('queued','delivered')));")
assert '010_truthful_demo_examples.sql' in schema['migrations']
save('deployed-database-validation.json',{'status':'PASS','database':schema})
cases=json.loads((OUT/'live-demo-regression.json').read_text());assert len(cases)==5
rows=[]
for case in cases:
 saved=json.loads((OUT/'executions'/(case['caseId']+'.json')).read_text())
 currentSource=(ROOT/'samples/scripts'/case['sample']).read_text(encoding='utf-8')
 assert currentSource==saved['source'] and hashlib.sha256(currentSource.encode()).hexdigest()==saved['sourceHash']
 status,current=http('/api/executions/'+case['executionId']);assert status==200
 assert current['execution']['status']=='completed' and current['execution']['result']['provider']=='docker'
 assert current['execution']['result']['auditCollection']['status']=='complete'
 assert saved['runtimeEvidence'][0].get('createInspection',saved['runtimeEvidence'][0].get('startInspection'))['observedRuntime']=='runc'
 if case['caseId']=='C':
  command=saved['hostCommands'][0];assert command['status']=='completed' and command['result']['success']
  actual=pg("SELECT json_build_object('status',status,'success',result->'success','origin',origin) FROM host_commands WHERE id='"+command['id']+"';")
  assert actual['status']=='completed' and actual['success'] and actual['origin']=='sandbox_capability'
 rows.append({**case,'currentSampleHashMatchesExecutedSource':True,'durableExecutionStillPresent':True,'validationMode':'Retained successful Phase 6 live run plus current source hash and live API/DB recheck; not a new execution.'})
save('demo-validation.json',{'status':'PASS','cases':rows,'newSampleExecutionsDuringResume':0,'manualVisualAcceptance':False})
apiFiles=list((ROOT/'apps/api/src').rglob('*'))+list((ROOT/'config').rglob('*'))
paths=[p for p in apiFiles if p.is_file()]
result=cmd(D+['exec','research-poc-api-1','sha256sum']+['/workspace/'+p.relative_to(ROOT).as_posix() for p in paths]);assert result['exitCode']==0
hashes={line.split()[1].removeprefix('/workspace/'):line.split()[0] for line in result['stdout'].splitlines()}
assert all(hashes[p.relative_to(ROOT).as_posix()]==sha(p) for p in paths)
with urllib.request.urlopen('http://localhost:15173',timeout=10) as response:html=response.read().decode()
assets=re.findall(r'<script[^>]*src="([^"]+)"',html);bundle=''
for asset in assets:
 with urllib.request.urlopen('http://localhost:15173'+asset,timeout=10) as response:bundle+=response.read().decode()
strings=['Stored security evidence (PostgreSQL)','Zero observations alone','Collection reasons:','Advisory assessment','Runtime authority','Broadens assistant context intent only']
assert all(s in bundle for s in strings)
assert 'enqueueHostCommand' not in bundle and 'Direct broadcast disabled' not in bundle
save('deployed-ui-contract.json',{'status':'SOURCE/TEST VALIDATED','manualWalkthrough':'UNAVAILABLE','manualReason':'Previous Computer Use URL-confidence policy stop; no retry or bypass in resume.','apiAndContextFileHashesMatch':len(paths),'frontendAssets':assets,'deployedStringsVerified':strings,'deadDirectBroadcastRemoved':True,'note':'HTTP bundle availability/string inspection is not visual layout/navigation acceptance.'})
r=cmd(D+['exec','research-poc-runner-1','deno','eval','console.log(JSON.stringify(await(await fetch("http://localhost:3100/health")).json()))']);assert r['exitCode']==0
health=json.loads(r['stdout']);assert health['admission']['active']==0 and not health['admission']['blocked']
r=cmd(D+['ps','-aq','--filter','name=^/poc-exec-']);assert r['exitCode']==0 and not r['stdout']
assert schema['nonterminalExecutions']==0 and schema['pendingCommands']==0
states=[]
for service in ['api','web','runner','host-gateway','postgres','paper','otel-collector']:
 state=dj(['inspect','research-poc-'+service+'-1'])[0]
 assert state['State']['Running']
 states.append({'service':service,'image':state['Image'],'running':True,'health':state['State'].get('Health',{}).get('Status')})
save('final-runtime-state.json',{'status':'PASS','apiHealth':http('/health')[1],'services':states,'runnerAdmission':health['admission'],'orphanSandboxes':0,'pendingCommands':0,'nonterminalExecutions':0,'newProviderCalls':0,'newGvisorBenchmarks':0})
print('Compose/migration/source/assets, five retained live samples with unchanged source, and final healthy/empty runtime state: PASS.')
