from phase5_common import *
import re,time
from datetime import datetime,timezone
env=json.loads((OUT/'environment.json').read_text());since=env['startedAt']
records={cid:json.loads((OUT/'executions'/(cid+'.json')).read_text()) for cid in ['E1','E8']}
for _ in range(20):
 logs=cmd(D+['logs','--since',since,'research-poc-otel-collector-1']);text=logs['stdout']+'\n'+logs['stderr']
 if all(r['traceId'] in text for r in records.values()):break
 time.sleep(.5)
assert all(r['traceId'] in text for r in records.values()),'Collector did not expose both expected trace IDs'
(OUT/'collector-debug.log').write_text(clean(text),encoding='utf-8')
blocks=re.split(r'(?=Span #\d+)',text)
summary={}
for cid,r in records.items():
 selected=[b for b in blocks if r['traceId'] in b]
 names=[];events=[]
 for b in selected:
  names+=re.findall(r'^\s*Name\s*:\s*([^\r\n]+)',b,re.M)
  events+=re.findall(r'Name:\s*Str\(([^\r\n]*)\)',b)
 relevant=[line.strip() for b in selected for line in b.splitlines() if any(k in line for k in ['Name','Trace ID','execution.id','permission.accessed','host_api.','risk.classified','commandId','command_id','call_id','trace.id'])]
 summary[cid]={'executionId':r['executionId'],'traceId':r['traceId'],'collectorTraceReceipt':True,'collectorSpanNames':sorted(set(names)),'relevantCollectorLines':relevant,'sandboxRunFound':any('sandbox.run' in b for b in selected),'riskClassifiedFound':any('risk.classified' in b for b in selected),'hostRequestedFound':any('host_api.requested' in b for b in selected),'latePaperConfirmationInRootExport':any('host.command.result' in b for b in selected)}
 assert summary[cid]['sandboxRunFound'] and summary[cid]['riskClassifiedFound']
save('otel-validation.json',{'status':'PASS','pipeline':'Custom trusted API OTLP/HTTP JSON exporter -> collector -> detailed debug exporter. No durable trace backend configured.','traces':summary,'counterNamesObserved':sorted(set(re.findall(r'research\.(?:execution_count|execution_failures|permission_access_count|host_api_request_count|host_api_deny_count)',text))),'postgresSeparate':'Execution results, security events, host commands/results and UI timeline are durable PostgreSQL/API records; they are not themselves proof of collector receipt.','lateBridgeLimitation':'Paper command_result is stored later with trusted trace correlation; root export can finish before that acknowledgement, so do not claim a full distributed Paper span.'})
print(json.dumps({k:{'traceId':v['traceId'],'spanNames':v['collectorSpanNames'],'hostRequested':v['hostRequestedFound'],'latePaperInExport':v['latePaperConfirmationInRootExport']} for k,v in summary.items()},indent=2))
