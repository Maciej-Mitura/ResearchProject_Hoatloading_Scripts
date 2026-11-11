"""Phase 6 helpers: additive results, fixed Desktop context, credential-safe logs."""
from pathlib import Path
import json,subprocess,os,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'research-results/phase6-cleanup/2026-11-09T16-10-39Z'
D=['docker','--context','desktop-linux']
SECRETS=[]
for file in ROOT.glob('.env*'):
 if file.name=='.env.example':continue
 for line in file.read_text(encoding='utf-8').splitlines():
  if '=' in line and not line.lstrip().startswith('#'):
   k,v=line.split('=',1);v=v.strip().strip('\"\'')
   if k.endswith(('KEY','TOKEN','PASSWORD','SECRET')) and len(v)>=8:SECRETS.append(v)
def clean(s):
 for value in SECRETS:s=s.replace(value,'REDACTED')
 return s
def save(name,value):
 p=OUT/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(clean(json.dumps(value,indent=2))+'\n',encoding='utf-8')
def cmd(args,timeout=90,cwd=ROOT,env=None):
 p=subprocess.run(args,cwd=cwd,env=env,capture_output=True,timeout=timeout)
 decode=lambda b:b.decode('utf-16' if b[:2] in [b'\xff\xfe',b'\xfe\xff'] else 'utf-8',errors='replace').strip()
 return {'exitCode':p.returncode,'stdout':clean(decode(p.stdout)),'stderr':clean(decode(p.stderr))}
def dj(args):
 p=cmd(D+args);assert p['exitCode']==0,p['stderr'];return json.loads(p['stdout'])
def http(path,body=None,base='http://localhost:13000'):
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=15) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def pg(sql,container='research-poc-postgres-1'):
 p=cmd(D+['exec',container,'psql','-U','poc','-d','research_poc','-At','-c',sql]);assert p['exitCode']==0,p['stderr'];return json.loads(p['stdout'])
