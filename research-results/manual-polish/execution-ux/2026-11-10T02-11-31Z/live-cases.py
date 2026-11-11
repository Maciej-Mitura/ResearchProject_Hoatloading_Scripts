from common import *
import time
cases=[('normal','none','console.log("Hello world");'),('failed','none','console.log("Before controlled failure"); throw new Error("Controlled execution UX failure");'),('restricted','none','try { await Deno.readTextFile("/etc/passwd"); } catch (error) { console.log(error instanceof Error ? error.name : "Denied"); }'),('host-chat','host-chat','import { host } from "host"; const result = await host.chat.broadcast("Execution UX validation: one confirmed chat broadcast"); console.log(JSON.stringify(result));')]
rows=[]
for name,profile,source in cases:
 status,created=http('/api/scripts',{'name':'Execution UX · '+name,'language':'typescript','source':source});assert status==201,(status,created)
 script=created['script'];status,x=http('/api/executions',{'scriptId':script['id'],'permissionProfile':profile});assert status==201,(status,x)
 for _ in range(35):
  time.sleep(1)
  status,d=http('/api/executions/'+x['id']);x=d['execution']
  if x['status'] in ['completed','failed','terminated','blocked'] and x.get('finishedAt'):break
 time.sleep(2)
 status,d=http('/api/executions/'+x['id']);status,a=http('/api/risk-assessments?executionId='+x['id'])
 rows.append({'name':name,'script':script,'source':source,'profile':profile,'detail':d,'assessments':a})
 save('live-cases.json',rows)
 print(json.dumps({'case':name,'executionId':x['id'],'status':x['status'],'durationMs':x.get('result',{}).get('durationMs'),'audit':x.get('result',{}).get('auditCollection'),'securityEvents':len(d.get('securityEvents',[]))}),flush=True)
status,scripts=http('/api/scripts');timeout=next(s for s in scripts['items'] if s['name']=='Execution UX · controlled timeout')
status,allx=http('/api/executions');tx=next(x for x in allx['items'] if x['scriptId']==timeout['id'])
status,d=http('/api/executions/'+tx['id']);status,a=http('/api/risk-assessments?executionId='+tx['id']);save('live-timeout.json',{'detail':d,'assessments':a})
status,original=http('/api/executions/c65141ae-4521-451f-bbef-9d8f11c31995');save('original-deployed-projection.json',original)
status,cfg=http('/api/config/public');save('public-config.json',cfg)
