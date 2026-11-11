from common import *
import sys,time
def terminal(id):
 for _ in range(100):
  code,d=http('/api/executions/'+id)
  if d['execution']['status'] in ['completed','failed','terminated','blocked']:
   time.sleep(2);return http('/api/executions/'+id)[1]
  time.sleep(.25)
 raise AssertionError('Execution did not finish')
def create(name,source,requests=None,project=None,conversation=None,message=None):
 b={'name':'[Advanced platform] '+name,'source':source,'language':'typescript'}
 if requests is not None:b['requestedCapabilities']=requests
 if project is not None:b['project']=project
 if conversation:b.update(conversationId=conversation,sourceMessageId=message)
 code,item=http('/api/scripts',b);assert code==201,item
 return item
def approve(item,selected=None):
 sid=item['script']['id'];vid=item['version']['id'];_,m=http(f'/api/scripts/{sid}/versions/{vid}/manifest');m=m['manifest']
 if m['requested']:
  code,review=http(f'/api/scripts/{sid}/versions/{vid}/manifest/reviews',{'manifestId':m['id'],'selected':selected if selected is not None else [r['capability'] for r in m['requested']]});assert code==201,review
 return m
def run(item,profile='host-capabilities'):
 code,e=http('/api/executions',{'scriptId':item['script']['id'],'scriptVersionId':item['version']['id'],'permissionProfile':profile});assert code==201,e
 return terminal(e['id'])
mode=sys.argv[1]
if mode=='status':
 c=http('/api/config/public')[1];assert c['riskAnalyzer']=='deterministic';save('deployed-config.json',c);code,r=http('/api/scripts/capabilities/registry');assert code==200 and len(r)==10;save('deployed-registry.json',r);print('Registry',len(r),'host connected',http('/api/host/status')[1].get('connected'))
elif mode=='generate':
 prompts={
 'A':'Create a bounded one-shot TypeScript script: read host.server.status demoLocation, change weather to THUNDER, spawn exactly two ZOMBIE entities nearby, place one DIAMOND_ORE at floor(x)+2,floor(y)+2,floor(z)+2 near demoLocation and announce it. Status first, then Promise.all for five effects to fit ten seconds. Print all typed results as JSON; no private player action. Propose narrow explicit quotas and constraints and explain separate permission review and Run.',
 'B':'Create a one-shot TypeScript script reading GoldennBullet location with player.getState and placing one approved STONE block two blocks away, only if inside the permitted demo area. The player may be offline: clearly report the offline failure and perform no world action if player state is unavailable. Request only player.getState for GoldennBullet and world.setBlock STONE max1. No arbitrary host access.',
 'C':'Create a genuine small multi-file TypeScript project with exactly main.ts, utils/summary.ts and config.json. Import JSON with with {type:"json"}. The helper should calculate a short formatted summary from configuration numbers, then broadcast it using the Host SDK; main.ts invokes the helper once. Include a useful small loop/function calculation in the helper. Request chat.broadcast max1 only. Return project with complete files and source exactly equal to main.ts content. Explain all files save as one version and require explicit review followed by a separate Run. Do not generate a persistent service.',
 'D':'When GoldennBullet left-clicks, change weather. Explain whether a persistent click listener is supported in this platform. Offer the supported one-shot alternative that sets weather CLEAR once. Do not invent an event API. If generating the alternative, propose only world.setWeather CLEAR max1 with explicit review and separate Run.'}
 generated={}
 for name,prompt in prompts.items():
  code,conv=http('/api/conversations',{'title':'[Advanced platform] '+name});assert code==201
  req=urllib.request.Request('http://localhost:13000/api/conversations/'+conv['id']+'/messages',data=json.dumps({'content':prompt}).encode(),headers={'Content-Type':'application/json'})
  try:
   with urllib.request.urlopen(req,timeout=90) as r:code=r.status;response=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;response=json.load(e)
  save(name+'-gemini.json',{'status':code,'prompt':prompt,'response':response});assert code==201,response
  p=response.get('proposal');assert p,'No proposed one-shot alternative'
  if name=='C':assert len(p.get('project',{}).get('files',[]))>=3,p
  item=create(name+' '+p['name'],p['source'],p['requestedCapabilities'],p.get('project'),conv['id'],response['assistantMessage']['id'])
  generated[name]=item;save('generated-cases.json',generated)
  print(name,'real Gemini proposal saved',item['script']['id'],'files',len(p.get('project',{}).get('files',[])) or 1,flush=True)
elif mode=='run':
 cases=json.loads((OUT/'generated-cases.json').read_text())
 for name,item in cases.items():
  approve(item);d=run(item);save(name+'-live.json',d)
  print(name,d['execution']['status'],[(e['metadata'].get('capability'),e['metadata'].get('success'),e['metadata'].get('resultMessage')) for e in d['securityEvents'] if e['eventType']=='host.command.result'],flush=True)
elif mode=='compatibility':
 for name,source,profile in [('console','console.log(2+2)','none'),('fixture','console.log(await Deno.readTextFile("/fixtures/allowed.txt"))','read-fixture'),('environment','console.log(Deno.env.get("SANDBOX_DEMO_VALUE"))','env-demo'),('existing-manifest','import {host} from "host";console.log(JSON.stringify(await host.server.status()))','host-capabilities')]:
  item=create('compat '+name,source);approve(item);d=run(item,profile);save('compat-'+name+'.json',d);assert d['execution']['status']=='completed',(name,d);print(name,'completed',flush=True)
 scripts=http('/api/scripts')[1]['items'];legacy=next(s for s in scripts if 'Execution UX' in s['name'] and 'host-chat' in s['name']);detail=http('/api/scripts/'+legacy['id'])[1];item={'script':legacy,'version':detail['currentVersion']};m=http(f"/api/scripts/{legacy['id']}/versions/{item['version']['id']}/manifest")[1];assert m['manifest'] is None and 'while' not in item['version']['source'];d=run(item,'host-chat');save('compat-historical-chat.json',d);assert d['execution']['status']=='completed';print('historical chat completed',flush=True)
elif mode=='security':
 requests=[{'capability':'world.setBlock','required':True,'reason':'negative validation','constraints':{'maxCalls':1,'materials':['STONE']}},{'capability':'world.setWeather','required':True,'reason':'negative validation','constraints':{'maxCalls':1,'weather':['CLEAR']}}]
 source='''import {host} from "host";
 console.log(JSON.stringify(await Promise.all([
 host.world.setBlock({x:0,y:64,z:0,type:"COMMAND_BLOCK"}),
 host.world.setBlock({x:0,y:64,z:0,type:"DIAMOND_ORE"}),
 host.world.setWeather("THUNDER"),
 host.world.playSound({x:0,y:64,z:0,sound:"BLOCK_NOTE_BLOCK_PLING"})
 ])));'''
 item=create('security constraint denial',source,requests);sid=item['script']['id'];vid=item['version']['id']
 code,body=http('/api/executions',{'scriptId':sid,'permissionProfile':'host-capabilities'});save('security-unreviewed.json',{'status':code,'body':body});assert code==400
 approve(item,['world.setBlock','world.setWeather']);d=run(item);save('security-live-denials.json',d);assert len([e for e in d['securityEvents'] if e['eventType']=='host_api.denied'])>=4;assert not [e for e in d['securityEvents'] if e['eventType']=='host.command.result'];print('Unreviewed and invalid/denied calls failed closed',flush=True)
elif mode=='utility':
 requests=[{'capability':id,'required':True,'reason':'Bounded typed operation and demo cleanup check','constraints':{'maxCalls':1,**c}} for id,c in [('server.status',{}),('world.getBlock',{}),('world.setBlock',{'materials':['AIR']}),('world.setWeather',{'weather':['CLEAR']}),('world.setTime',{'times':['DAY']}),('world.playSound',{'sounds':['BLOCK_NOTE_BLOCK_PLING']}),('player.getState',{'playerNames':['GoldennBullet']})]]
 source='import {host} from "host";const s=await host.server.status();const p={x:Math.floor(s.demoLocation.x)+2,y:Math.floor(s.demoLocation.y)+2,z:Math.floor(s.demoLocation.z)+2};const before=await host.world.getBlock(p);if(before.type!=="DIAMOND_ORE")throw new Error("Test block changed; refusing cleanup");const results=await Promise.all([host.world.setBlock({...p,type:"AIR"}),host.world.setWeather("CLEAR"),host.world.setTime("DAY"),host.world.playSound({...p,sound:"BLOCK_NOTE_BLOCK_PLING"}),host.player.getState("GoldennBullet").catch(e=>({offline:String(e)}))]);console.log(JSON.stringify({before,results}));'
 item=create('typed operations and cleanup',source,requests);approve(item);d=run(item);save('typed-operations-live.json',d);assert d['execution']['status']=='completed';print('Typed operations',[(e['metadata'].get('capability'),e['metadata'].get('success'),e['metadata'].get('resultMessage')) for e in d['securityEvents'] if e['eventType']=='host.command.result'],flush=True)
elif mode=='quota':
 item=create('narrow quota','import {host} from "host";console.log(JSON.stringify(await Promise.all([host.server.status(),host.server.status().catch(e=>({denied:String(e)}))])));',[{'capability':'server.status','required':True,'reason':'Quota enforcement check','constraints':{'maxCalls':1}}]);approve(item);d=run(item);save('quota-live.json',d);assert any(e['metadata'].get('reason')=='CAPABILITY_QUOTA_EXCEEDED' for e in d['securityEvents'] if e['eventType']=='host_api.denied');print('Narrow status quota enforced',flush=True)
elif mode=='failures':
 for name,files in [('missing',[{'path':'main.ts','content':'import "./missing.ts";'}]),('syntax',[{'path':'main.ts','content':'import "./helper.ts";'},{'path':'helper.ts','content':'export const = ;'}]),('runtime',[{'path':'main.ts','content':'import "./helper.ts";'},{'path':'helper.ts','content':'throw new Error("helper runtime failure");'}])]:
  p={'entrypoint':'main.ts','files':files};item=create('failure '+name,files[0]['content'],[],p);d=run(item,'none');save('failure-'+name+'.json',d);assert d['execution']['status']=='failed',d;print(name,d['execution']['result']['stderr'][-450:],flush=True)
else:raise ValueError(mode)
