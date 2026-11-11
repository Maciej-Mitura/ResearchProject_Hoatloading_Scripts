from phase75_common import *
status,scripts=http('/api/scripts');assert status==200
script=next(x for x in scripts['items'] if x['name']=='Phase7.5 browser workflow')
status,detail=http('/api/scripts/'+script['id']);assert status==200 and len(detail['versions'])==2 and detail['currentVersion']['versionNumber']==2 and detail['currentVersion']['language']=='typescript'
status,history=http('/api/executions/history?scriptId='+script['id']);assert status==200 and history['total']==2
runs=[]
for row in history['items']:
 status,run=http('/api/executions/'+row['id']);assert status==200 and run['execution']['status']=='completed' and run['execution']['result']['auditCollection']['status']=='complete'
 status,risks=http('/api/risk-assessments?executionId='+row['id']);assert status==200 and any(r['id']==row['assessmentId']==run['execution']['riskAssessmentId'] for r in risks['items'])
 runs.append(run)
assert 'Version 2 5' in runs[0]['execution']['result']['stdout']
assert 'Browser workflow verified 4' in runs[1]['execution']['result']['stdout']
save('browser-workflow-evidence.json',{'verdict':'PASS','script':script,'versions':detail['versions'],'history':history,'executions':runs,'browserActions':['created script','Run stored version1','edited TypeScript source','dirty Run disabled','saved new stored version2','Run version2','selected history and inspected evidence']})
print('Browser workflow persisted two TypeScript versions and two completed real executions; history assessments match selected execution links.')
