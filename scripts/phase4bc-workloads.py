"""Create draft sources before runc functional validation; never executes a job."""
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parents[1]
O=R/'research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched'
W=O/'workloads';W.mkdir(exist_ok=False)
def advance(state,n):
 a,c=1664525,1013904223;am,ac=1,0
 while n:
  if n&1:am=(am*a)&0xffffffff;ac=(ac*a+c)&0xffffffff
  c=((a+1)*c)&0xffffffff;a=(a*a)&0xffffffff;n>>=1
 return (am*state+ac)&0xffffffff
specs=[
 ('W1','Basic JavaScript','none','javascript','let total=0; for(let i=0;i<100000;i++) total+=i; console.log(total);\n','4999950000'),
 ('W2','Basic TypeScript','none','typescript','const answer: number = 6 * 7; console.log(answer);\n','42'),
 ('W3','Scoped filesystem','read-fixture','javascript','const text=await Deno.readTextFile("/fixtures/allowed.txt"); console.log("allowed="+text.includes("intentionally readable")); try { await Deno.readTextFile("/etc/hosts"); throw new Error("unexpected outside read"); } catch(e) { if(!(e instanceof Deno.errors.NotCapable)) throw e; console.log("outside=denied"); }\n','allowed=true\noutside=denied'),
 ('W4','Scoped environment','env-demo','javascript','console.log("demo="+Deno.env.get("SANDBOX_DEMO_VALUE")); try { Deno.env.get("HOME"); throw new Error("unexpected env grant"); } catch(e) { if(!(e instanceof Deno.errors.NotCapable)) throw e; console.log("unrelated=denied"); }\n','demo=hello-from-supervisor\nunrelated=denied'),
 ('W5','Caught restricted read','none','javascript',(R/'fixtures/execution/caught-read.js').read_text(),'handled'),
 ('W6','Timeout','none','javascript',(R/'fixtures/execution/infinite-loop.js').read_text(),None),
 ('W7','Output capture limit','none','javascript',(R/'fixtures/scenarios/scripts/large-output-fast.js').read_text(),None),
 ('W8','Host chat','host-chat','javascript','import { host } from "host"; console.log(JSON.stringify(await host.chat.broadcast("Phase 4 runtime comparison")));\n',None),
 ('W9','CPU-heavier','none','javascript','let state=0x12345678; for(let i=0;i<30000000;i++) state=(Math.imul(state,1664525)+1013904223)>>>0; console.log(state);\n',str(advance(0x12345678,30000000))),
 ('W10','Allowed I/O-heavier','read-fixture','javascript','let bytes=0; for(let i=0;i<500;i++) bytes+=(await Deno.readTextFile("/fixtures/allowed.txt")).length; console.log("reads=500 bytes="+bytes);\n','reads=500 bytes='+str(500*len((R/'services/sandbox/fixtures/allowed.txt').read_bytes())))
]
rows=[]
for wid,name,profile,lang,source,expected in specs:
 path=W/(wid+('.ts' if lang=='typescript' else '.js'));path.write_text(source,encoding='utf-8',newline='\n')
 rows.append({'workloadId':wid,'name':name,'permissionProfile':profile,'language':lang,'sourcePath':path.relative_to(R).as_posix(),'sourceHash':hashlib.sha256(path.read_bytes()).hexdigest(),'expectedStdout':expected,'expectedSemantics':('timedOut=true, terminated, clean removal' if wid=='W6' else 'completed with outputTruncated=true' if wid=='W7' else 'completed plus real SecureBridge/Paper command_result success' if wid=='W8' else 'completed exit=0 and exact stdout'),'observationNotes':'Audit cap remains 200 events; W10 deliberately exceeds it without changing evidence limits.' if wid=='W10' else None})
(O/'draft-workloads.json').write_text(json.dumps(rows,indent=2)+'\n')
print('Created 10 draft workload definitions. No executions; runc validation required before freeze.')
