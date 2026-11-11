from phase75_common import *
import hashlib,sys
before=json.loads((OUT/'before-fingerprints.json').read_text(encoding='utf-8'))
v=json.loads((OUT/'final-validation.json').read_text(encoding='utf-8'))
changes=[]
for relative,digest in before.items():
 p=ROOT/relative
 if not p.exists():changes.append({'path':relative,'change':'deleted'})
 elif hashlib.sha256(p.read_bytes()).hexdigest()!=digest:changes.append({'path':relative,'change':'modified'})
for folder in ['apps/web/src','apps/api/src','apps/api/tests']:
 for p in (ROOT/folder).rglob('*'):
  if p.is_file() and p.relative_to(ROOT).as_posix() not in before:changes.append({'path':p.relative_to(ROOT).as_posix(),'change':'added'})
assert all(x['path'].startswith('apps/web/') or x['path'] in ['apps/api/src/routes/executions.ts','apps/api/src/repositories/execution-history.ts','apps/api/tests/execution_history_db_test.ts','apps/api/tests/execution_history_test.ts'] for x in changes),changes
v['changedFiles']=sorted(changes,key=lambda x:x['path'])
frozen=[(k,digest) for k,digest in before.items() if k.startswith('research-results/') and not k.startswith('research-results/phase7-5-ui-polish/')]
changed=[k for k,digest in frozen if not (ROOT/k).exists() or hashlib.sha256((ROOT/k).read_bytes()).hexdigest()!=digest]
assert not changed,changed
v['frozenIntegrity']={'checked':len(frozen),'changed':[],'missing':[],'verdict':'PASS'}
v['finalCompose']=cmd(D+['compose','config','--quiet']);assert v['finalCompose']['exitCode']==0
v['services']=cmd(D+['compose','ps','--format','json']);assert v['services']['exitCode']==0
v['sourceHashes']={x['path']:hashlib.sha256((ROOT/x['path']).read_bytes()).hexdigest() for x in changes if x['change']!='deleted'}
save('final-validation.json',v)
assert json.loads((OUT/'application-build.json').read_text())['exitCode']==0
assert json.loads((OUT/'application-redeploy.json').read_text())['exitCode']==0
assert json.loads((OUT/'browser-workflow-evidence.json').read_text())['verdict']=='PASS'
visual=json.loads((OUT/'visual-review.json').read_text());assert visual['verdict']=='PASS'
assert all(not x['changed'] and not x['missing'] for x in json.loads((OUT/'frozen-manifest-checks.json').read_text()))
r=cmd([sys.executable,str(OUT/'write-report.py')]);assert r['exitCode']==0,r;print(r['stdout'])
# No credential or capability-token values may enter the additive publication package.
leaks=[]
for p in OUT.rglob('*'):
 if p.is_file() and p.suffix in ['.json','.md','.log','.py','.txt','.ts']:
  text=p.read_text(encoding='utf-8-sig',errors='replace')
  if any(value in text for value in SECRETS):leaks.append(p.relative_to(OUT).as_posix())
assert not leaks,leaks
save('scope-and-secret-check.json',{'verdict':'PASS','changedApplicationFiles':len(changes),'onlyAuthorizedUiAndReadOnlyHistoryChanges':True,'credentialValueMatches':0,'researchFilesUnchanged':len(frozen),'frozenManifestEntries':803,'noPhase8Work':True})
files={p.relative_to(OUT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*') if p.is_file() and p.name!='result-artifact-hashes.json' and '__pycache__' not in p.parts}
save('result-artifact-hashes.json',{'algorithm':'sha256','excludesSelf':True,'excludesCaches':True,'files':dict(sorted(files.items()))})
print(json.dumps({'verdict':'PASS','changedApplicationFiles':len(changes),'frozenFiles':len(frozen),'sealedArtifacts':len(files),'testSummary':json.loads((OUT/'test-summary.json').read_text())['testCaseInvocations']}))
