from common import *
import sys,time
PREFIX="[Workbench repair] "
def request(id,**constraints):return {"capability":id,"required":True,"reason":"Bounded Workbench workflow validation","constraints":{"maxCalls":1,**constraints}}
def create(name,source,requests):
 code,item=http('/api/scripts',{"name":PREFIX+name,"source":source,"language":"typescript","requestedCapabilities":requests});assert code==201,item
 sid=item['script']['id'];vid=item['version']['id'];_,m=http(f'/api/scripts/{sid}/versions/{vid}/manifest')
 return {"script":item['script'],"version":item['version'],"manifest":m['manifest']}
def approve(item,selected):
 sid=item['script']['id'];vid=item['version']['id'];code,m=http(f'/api/scripts/{sid}/versions/{vid}/manifest/reviews',{"manifestId":item['manifest']['id'],"selected":selected});assert code==201,m
 item['manifest']=m['manifest'];return item
def detail(execution):
 deadline=time.monotonic()+40
 while time.monotonic()<deadline:
  _,d=http('/api/executions/'+execution)
  if d['execution']['status'] in ['completed','failed','terminated','blocked']:return d
  time.sleep(.2)
 raise AssertionError('Execution did not reach a terminal state')
def run(item,profile):
 code,e=http('/api/executions',{'scriptId':item['script']['id'],'scriptVersionId':item['version']['id'],'permissionProfile':profile});assert code==201,e
 d=detail(e['id']);time.sleep(2.5);_,d=http('/api/executions/'+e['id']);return d
def history(item):
 return http('/api/executions/history?scriptId='+item['script']['id'])[1]
mode=sys.argv[1]
if mode=='setup':
 config=http('/api/config/public')[1];assert config['riskAnalyzer']=='deterministic',config
 cases={}
 cases['C']=create('C review required','import {host} from "host"; const status=await host.server.status(); const broadcast=await host.chat.broadcast("Workbench permission workflow check"); console.log(JSON.stringify({status,broadcast}));',[request('server.status'),request('chat.broadcast')])
 cases['D']=create('D partial approval','import {host} from "host"; console.log(JSON.stringify(await Promise.all([host.chat.broadcast("Partial approval workflow check"),host.world.spawnEntity({type:"ZOMBIE",x:0,y:104,z:0})])));',[request('chat.broadcast'),request('world.spawnEntity',entityTypes=['ZOMBIE'])])
 approve(cases['D'],['chat.broadcast'])
 cases['E']=create('E unapproved bypass','import {host} from "host";console.log(await host.chat.broadcast("Unapproved request"));',[request('chat.broadcast')])
 save('live-cases.json',cases)
 checks={}
 for profile in ['host-chat','host-capabilities']:
  code,b=http('/api/executions',{'scriptId':cases['E']['script']['id'],'scriptVersionId':cases['E']['version']['id'],'permissionProfile':profile});checks[profile]={'status':code,'body':b};assert code==400
 code,b=http('/api/executions',{'scriptId':cases['E']['script']['id'],'permissionProfile':'host-capabilities','capabilityAuthority':cases['D']['manifest']});checks['supplied-authority']={'status':code,'body':b};assert code==400
 checks['E-history']=history(cases['E']);assert checks['E-history']['total']==0
 save('E-backend-bypass.json',checks);save('C-history-before-review.json',history(cases['C']))
 print(json.dumps({k:{'name':v['script']['name'],'id':v['script']['id'],'versionId':v['version']['id']} for k,v in cases.items()}),flush=True)
elif mode=='approve-C':
 cases=json.loads((OUT/'live-cases.json').read_text());before=history(cases['C']);save('C-history-after-ui-review-prompt.json',before);assert before['total']==0,before
 approve(cases['C'],['server.status','chat.broadcast']);save('live-cases.json',cases);print('C review saved by integration harness; pre-review execution count is zero.',flush=True)
elif mode=='legacy-B':
 scripts=http('/api/scripts')[1]['items'];candidates=[s for s in scripts if 'Execution UX' in s['name'] and 'host-chat' in s['name']]
 assert candidates,'No known bounded historical host-chat fixture found'
 item=http('/api/scripts/'+candidates[0]['id'])[1];v=item['currentVersion'];_,m=http(f"/api/scripts/{candidates[0]['id']}/versions/{v['id']}/manifest");assert m['manifest'] is None
 assert 'while' not in v['source'] and 'host.chat.broadcast' in v['source'];case={'script':item['script'],'version':v,'manifest':None};d=run(case,'host-chat');save('B-legacy-run.json',d);print('B',d['execution']['status'],[(e['eventType'],e['metadata'].get('success')) for e in d['securityEvents'] if e['eventType']=='host.command.result'],flush=True)
elif mode=='gemini-F':
 _,conv=http('/api/conversations',{'title':PREFIX+'F Gemini guided flow'})
 prompt='Create a one-shot TypeScript script that announces zombies are incoming, reads the configured demo location with host.server.status(), spawns exactly three ZOMBIE entities nearby, and sends a private confirmation to GoldennBullet. Use only the registered Host SDK. Read status first, then use Promise.all for the broadcast, three spawns and private message so it fits the ten-second budget. Print the typed results as JSON, including an offline-player failure. Propose narrow constraints and explain that I must review permissions and separately click Run. Do not claim any capability is approved.'
 req=urllib.request.Request('http://localhost:13000/api/conversations/'+conv['id']+'/messages',data=json.dumps({'content':prompt}).encode(),headers={'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=75) as r:code=r.status;response=json.load(r)
 except urllib.error.HTTPError as e:code=e.code;response=json.load(e)
 save('F-gemini-response.json',{'status':code,'response':response});assert code==201,response
 p=response['proposal'];assert p and p['requestedCapabilities'];assert set(r['capability'] for r in p['requestedCapabilities'])=={'chat.broadcast','server.status','world.spawnEntity','player.sendMessage'}
 code,item=http('/api/scripts',{'conversationId':conv['id'],'sourceMessageId':response['assistantMessage']['id'],'name':PREFIX+'F Gemini advanced','source':p['source'],'language':p['language'],'requestedCapabilities':p['requestedCapabilities']});assert code==201,item
 sid=item['script']['id'];vid=item['version']['id'];_,m=http(f'/api/scripts/{sid}/versions/{vid}/manifest');assert m['manifest']['review'] is None
 cases=json.loads((OUT/'live-cases.json').read_text());cases['F']={'script':item['script'],'version':item['version'],'manifest':m['manifest']};save('live-cases.json',cases);print('F generated and saved; review required.',sid,flush=True)
elif mode=='approve-F':
 cases=json.loads((OUT/'live-cases.json').read_text());approve(cases['F'],[r['capability'] for r in cases['F']['manifest']['requested']]);save('live-cases.json',cases);print('F explicit test-harness review saved; no execution submitted.',flush=True)
elif mode.startswith('collect-'):
 name=mode.split('-',1)[1];cases=json.loads((OUT/'live-cases.json').read_text());h=history(cases[name]);assert h['items'],h;d=detail(h['items'][0]['id']);time.sleep(2);_,d=http('/api/executions/'+d['execution']['id']);save(name+'-ui-run.json',d);print(name,d['execution']['status'],[(e['metadata'].get('capability'),e['metadata'].get('success'),e['metadata'].get('reason')) for e in d['securityEvents'] if e['eventType'] in ['host.command.result','host_api.denied']],flush=True)
else:raise ValueError(mode)
