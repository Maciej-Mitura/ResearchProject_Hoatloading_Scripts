from common import *
eid='c65141ae-4521-451f-bbef-9d8f11c31995'
_,detail=http('/api/executions/'+eid);_,risks=http('/api/risk-assessments?executionId='+eid);_,security=http('/api/security/events?executionId='+eid);_,script=http('/api/scripts/'+detail['execution']['scriptId'])
version=next(x for x in script['versions'] if x['id']==detail['execution']['scriptVersionId'])
commands=pg("SELECT COALESCE(json_agg(t),'[]'::json) FROM (SELECT id,status,origin,correlation,result,created_at,updated_at FROM host_commands WHERE correlation->>'executionId'='"+eid+"') t")
save('original-execution.json',{'detail':detail,'risks':risks['items'],'security':security['items'],'executedSource':version['source'],'commands':commands})
x=detail['execution']['result'];print(json.dumps({'source':version['source'],'resultFields':list(x),'result':{k:v for k,v in x.items() if k not in ['stdout','stderr','permissionEvents','hostApiEvents']},'observations':len(x.get('permissionEvents',[])),'hostEvents':len(x.get('hostApiEvents',[])),'risk':risks['items'],'commandCount':len(commands)},indent=2))
