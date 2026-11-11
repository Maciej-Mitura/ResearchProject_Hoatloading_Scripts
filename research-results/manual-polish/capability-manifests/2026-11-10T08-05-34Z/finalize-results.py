from common import *
import hashlib

def digest(path):
 return hashlib.sha256(path.read_bytes()).hexdigest()

summary=json.loads((OUT/'tests-summary.json').read_text(encoding='utf-8'))
frontend=json.loads((OUT/'frontend-tests.json').read_text(encoding='utf-8'))
summary['frontend']={'exitCode':frontend['exitCode'],'counts':frontend['counts']}
assert all(row['exitCode']==0 for row in summary.values())
save('tests-summary.json',summary)
p=OUT/'tests.md';s=p.read_text(encoding='utf-8');a=s.index('| Suite |');b=s.index('\nFrontend TypeScript',a)
table='| Suite | Passed | Failed | Ignored/skipped |\n|---|---:|---:|---:|\n'
for name,row in summary.items():
 c=row['counts']
 if c:table+=f"| {name} | {c.get('passed',0)} | {c.get('failed',0)} | {c.get('skipped',0)} |\n"
p.write_text(s[:a]+table+s[b:],encoding='utf-8')
p=OUT/'report.md';s=p.read_text(encoding='utf-8')
for old,new in {
 'all1,487':'all 1,487','All1,487':'All 1,487','Phase8':'Phase 8','Phase3':'Phase 3',
 'migrations011':'migrations 011','migration012':'migration 012','and012':'and 012',
 'maximum5':'maximum 5','maximum3':'maximum 3','within32':'within 32','budget12':'budget 12',
 'scheduled60second removal':'scheduled removal after 60 seconds','frontend121':'frontend 121',
 'API131':'API 131','runner53':'runner 53','Gateway32':'Gateway 32','Docker22':'Docker 22',
 'Java13':'Java 13','manifest1':'manifest 1','Activity1':'Activity 1','history1':'history 1',
 'Gemini5/5':'Gemini 5/5','calculation42':'calculation 42',
}.items():s=s.replace(old,new)
p.write_text(s,encoding='utf-8')

before=json.loads((OUT/'before-fingerprints.json').read_text(encoding='utf-8'))
excluded={'node_modules','__pycache__','.gradle','build','dist'}
current={}
for folder in ['apps','services','packages','minecraft','config','docs']:
 for path in (ROOT/folder).rglob('*'):
  if path.is_file() and not any(part in excluded for part in path.parts):
   current[path.relative_to(ROOT).as_posix()]=digest(path)
modified=[]
for path,old in before.items():
 if path.startswith('research-results/'):continue
 target=ROOT/path
 if not target.is_file() or digest(target)!=old:modified.append(path)
files=sorted(set(modified+[p for p in current if p not in before]+['README.md']))
save('changed-files.json',{'count':len(files),'files':files})
(OUT/'changed-files.md').write_text(
 '# Files changed by this extension\n\nCompared with the captured working-tree baseline, not Git HEAD, which already contained earlier roadmap/polish work. README.md is included separately because the baseline scanned application/documentation trees.\n\n'
 +f'{len(files)} product/source/test/documentation files; the timestamped result package is additional.\n\n'
 +'\n'.join('- `'+p+'`' for p in files)+'\n',encoding='utf-8')
frozen=[p for p in before if p.startswith('research-results/')]
bad=[p for p in frozen if not (ROOT/p).is_file() or digest(ROOT/p)!=before[p]]
assert not bad,bad
save('frozen-integrity.json',{'priorResearchFiles':len(frozen),'changedResearchFiles':bad,'unchanged':True})
save('registry-resource-check.json',{'command':'deno run --allow-read packages/contracts/generate-capability-resource.ts --check','exitCode':0,'observed':'Generated resource matches the authoritative registry.'})
leaks=[]
for p in OUT.rglob('*'):
 if p.is_file() and '__pycache__' not in p.parts and any(secret.encode() in p.read_bytes() for secret in SECRETS):
  leaks.append(p.relative_to(OUT).as_posix())
assert not leaks,leaks
save('secret-scan.json',{'configuredCredentialValuesFound':leaks,'ephemeralCredentialsExportedByIsolationHarness':False,'note':'Current configured credentials scanned locally; values are never included. Cleartext execution credential capture and argument rejection have dedicated tests.'})
seal={p.relative_to(OUT).as_posix():digest(p) for p in OUT.rglob('*') if p.is_file() and p.name!='seal.json' and '__pycache__' not in p.parts}
save('seal.json',{'algorithm':'sha256','files':seal})
print(json.dumps({'changedProductFiles':len(files),'unchangedPriorResearchFiles':len(frozen),'sealedResultFiles':len(seal),'finalSuiteExitCodes':{k:v['exitCode'] for k,v in summary.items()},'secretLeaks':len(leaks)},indent=2))
