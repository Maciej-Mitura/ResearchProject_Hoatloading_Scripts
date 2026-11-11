from common import *
import sys,re,xml.etree.ElementTree as ET
mode=sys.argv[1];deno=str(ROOT.parent/'.phase1-tools/node_modules/deno/deno.exe')
env=os.environ.copy();env['DENO_DIR']=str(ROOT.parent/'.phase1-tools/deno-cache')
if mode in ['api','runner','gateway']:
 folder={'api':'apps/api','runner':'services/runner','gateway':'services/host-gateway'}[mode]
 args=[deno,'test','--no-lock','--allow-env','--allow-read','--allow-write','--allow-net','--allow-sys']
 if mode=='runner':args+=['--ignore=tests/docker_integration_test.ts']
 args+=['tests/'];r=cmd(args,600,ROOT/folder,env)
elif mode in ['frontend','frontend-typecheck']:
 args=['node',str(ROOT/'apps/web/node_modules/vitest/vitest.mjs'),'run'] if mode=='frontend' else ['node',str(ROOT/'apps/web/node_modules/typescript/bin/tsc'),'--noEmit']
 r=cmd(args,300,ROOT/'apps/web',env)
elif mode=='history-postgres':
 r=cmd(D+['exec','-e','EXECUTION_HISTORY_DB_TEST=1','research-poc-api-1','deno','test','--no-lock','--allow-net','--allow-env','--allow-read','tests/execution_history_db_test.ts'],300)
elif mode=='postgres':
 r=cmd(D+['exec','-e','HOST_ACTIVITY_DB_TEST=1','research-poc-api-1','deno','test','--no-lock','--allow-net','--allow-env','--allow-read','tests/host_activity_db_test.ts'],300)
elif mode=='docker-integration':
 r=cmd(D+['exec','research-poc-runner-1','deno','test','--no-lock','--allow-env','--allow-net','--allow-read','--allow-write','--allow-run=docker','tests/docker_integration_test.ts'],600)
elif mode=='java':
 name='phase75-securebridge-tests';image=dj(['inspect','research-poc-bridge-builder-1'])[0]['Image']
 q=cmd(D+['create','--name',name,'--entrypoint=gradle',image,'--no-daemon','test']);assert q['exitCode']==0,q['stderr']
 try:
  r=cmd(D+['start','-a',name],600)
  actual=dj(['inspect',name])[0]['State']['ExitCode'];r['exitCode']=actual
  target=OUT/'java-results';target.mkdir(exist_ok=True)
  cp=cmd(D+['cp',name+':/workspace/build/test-results/test/.',str(target)]);r['reportCopyExitCode']=cp['exitCode']
  total=fail=skip=0
  for p in target.glob('*.xml'):
   x=ET.parse(p).getroot();total+=int(x.attrib.get('tests',0));fail+=int(x.attrib.get('failures',0))+int(x.attrib.get('errors',0));skip+=int(x.attrib.get('skipped',0))
  r['junit']={'tests':total,'passed':total-fail-skip,'failed':fail,'skipped':skip}
 finally:r['cleanup']=cmd(D+['rm','-f',name])
else:raise ValueError(mode)
(OUT/(mode+'-tests.log')).write_text(r['stdout']+'\n'+r['stderr'],encoding='utf-8')
plain=re.sub(r'\x1b\[[0-9;]*m','',r['stdout']+'\n'+r['stderr'])
match=re.search(r'(\d+) passed \| (\d+) failed(?: \| (\d+) ignored)?',plain)
if not match:
 match=re.search(r'Tests\s+(\d+) passed',plain)
 if match:r['counts']={'passed':int(match[1]),'failed':0,'skipped':0}
if match and len(match.groups())>1:r['counts']={'passed':int(match[1]),'failed':int(match[2]),'skipped':int(match[3] or 0)}
save(mode+'-tests.json',r)
print(json.dumps({'suite':mode,'exitCode':r['exitCode'],'counts':r.get('counts'),'junit':r.get('junit'),'tail':plain[-450:]}),flush=True)
raise SystemExit(r['exitCode'])
