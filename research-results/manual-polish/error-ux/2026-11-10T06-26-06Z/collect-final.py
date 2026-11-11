from common import *
_,scripts=http('/api/scripts');selected=[s for s in scripts['items'] if s['name'].startswith('Error UX')];_,xs=http('/api/executions');rows=[]
for s in selected:
 _,sd=http('/api/scripts/'+s['id'])
 for x in xs['items']:
  if x['scriptId']==s['id']:
   _,d=http('/api/executions/'+x['id']);_,a=http('/api/risk-assessments?executionId='+x['id']);version=next(v for v in sd['versions'] if v['id']==x['scriptVersionId']);rows.append({'scriptName':s['name'],'source':version['source'],'scriptVersionId':version['id'],'detail':d,'assessments':a})
save('final-live-executions.json',rows)
_,cfg=http('/api/config/public');save('final-public-config.json',cfg)
print(json.dumps([{'name':r['scriptName'],'id':r['detail']['execution']['id'],'status':r['detail']['execution']['status'],'durationMs':(r['detail']['execution'].get('result') or {}).get('durationMs')} for r in rows],indent=2))
