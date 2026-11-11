from common import *
_,xs=http('/api/executions');found=[]
for x in xs['items']:
 r=x.get('result') or {}
 if 'Import "host" not a dependency' in r.get('stderr','') or ('host' in r.get('stderr','') and 'not a dependency' in r.get('stderr','')):
  _,d=http('/api/executions/'+x['id']);_,s=http('/api/scripts/'+x['scriptId']);v=next(v for v in s['versions'] if v['id']==x['scriptVersionId']);_,a=http('/api/risk-assessments?executionId='+x['id']);found.append({'detail':d,'source':v['source'],'assessments':a})
save('original-failures.json',found)
_,cfg=http('/api/config/public');save('public-config.json',cfg)
_,prefs=http('/api/project/settings');save('settings-before.json',prefs)
print(json.dumps([{'id':z['detail']['execution']['id'],'profile':z['detail']['execution']['result']['manifest']['permissionProfile'],'stderr':z['detail']['execution']['result']['stderr'],'source':z['source'],'assessment':z['assessments']['items']} for z in found],indent=2))
