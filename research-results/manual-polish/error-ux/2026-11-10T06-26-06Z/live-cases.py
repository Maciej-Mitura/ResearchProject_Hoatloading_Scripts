from common import *
import time
rows=[]
for name,source in [('normal','console.log("Hello world");'),('generic-error','console.log("Before failure"); throw new Error("Controlled error UX regression");')]:
 status,c=http('/api/scripts',{'name':'Error UX · '+name,'language':'typescript','source':source});assert status==201
 status,x=http('/api/executions',{'scriptId':c['script']['id'],'permissionProfile':'none'});assert status==201
 for _ in range(25):
  time.sleep(1);_,d=http('/api/executions/'+x['id'])
  if d['execution']['status'] in ['completed','failed','terminated']:break
 _,a=http('/api/risk-assessments?executionId='+x['id']);rows.append({'name':name,'source':source,'script':c['script'],'detail':d,'assessments':a});save('api-regressions.json',rows)
 print(json.dumps({'name':name,'id':x['id'],'status':d['execution']['status'],'duration':d['execution']['result']['durationMs']}),flush=True)
