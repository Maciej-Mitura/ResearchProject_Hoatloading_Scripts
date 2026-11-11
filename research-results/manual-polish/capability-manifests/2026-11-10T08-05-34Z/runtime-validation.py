from common import *
import time
PREFIX='[Capability extension validation] '
def request(cap,maxCalls=1,**constraints):return {'capability':cap,'required':True,'reason':'Bounded post-research integration validation','constraints':{'maxCalls':maxCalls,**constraints}}
def create(name,source,requests):
 status,s=http('/api/scripts',{'name':PREFIX+name,'language':'typescript','source':source,'requestedCapabilities':requests});assert status==201,s
 return s
def run(name,source,requests,selected=None,profile='host-capabilities'):
 s=create(name,source,requests);sid=s['script']['id'];vid=s['version']['id'];_,m=http(f'/api/scripts/{sid}/versions/{vid}/manifest');m=m['manifest']
 if requests or selected is not None:
  status,review=http(f'/api/scripts/{sid}/versions/{vid}/manifest/reviews',{'manifestId':m['id'],'selected':selected if selected is not None else [r['capability'] for r in requests]});assert status==201,review
 status,e=http('/api/executions',{'scriptId':sid,'scriptVersionId':vid,'permissionProfile':profile});assert status==201,(status,e)
 deadline=time.monotonic()+45
 while time.monotonic()<deadline:
  _,d=http('/api/executions/'+e['id']);e=d['execution']
  if e['status'] in ['completed','failed','blocked','terminated']:break
  time.sleep(.25)
 assert e['status'] in ['completed','failed','blocked','terminated'],e
 # Allow bounded late Paper persistence, preserving the separate outcome.
 time.sleep(.5);_,d=http('/api/executions/'+e['id'])
 save('runtime-bound-'+name+'.json',{'script':s,'manifest':m,'detail':d})
 print(name,e['status'],e.get('result',{}).get('stdout','')[:700],flush=True)
 return d
if __name__=='__main__':
 results={}
 results['A']=run('A-calculation','console.log(6 * 7);',[],profile='none')
 results['B']=run('B-chat','import {host} from "host"; console.log(JSON.stringify(await host.chat.broadcast("Bounded capability validation")));',[request('chat.broadcast')])
 status=run('status','import {host} from "host"; console.log(JSON.stringify(await host.server.status()));',[request('server.status')])
 location=json.loads(status['execution']['result']['stdout'].strip())['demoLocation']
 spawn={'type':'ZOMBIE',**location};spawn['y']+=1
 call='await host.world.spawnEntity('+json.dumps(spawn)+')'
 results['C']=run('C-spawn','import {host} from "host"; console.log(JSON.stringify('+call+'));',[request('world.spawnEntity',3,entityTypes=['ZOMBIE'])])
 source='import {host} from "host"; console.log(JSON.stringify(await Promise.all([host.chat.broadcast("Capability composition validation"),host.server.status(),host.player.sendMessage("GoldennBullet","Bounded private-message validation"),host.world.spawnEntity('+json.dumps(spawn)+')])));'
 requests=[request('chat.broadcast'),request('server.status'),request('player.sendMessage',playerNames=['GoldennBullet']),request('world.spawnEntity',entityTypes=['ZOMBIE'])]
 results['D']=run('D-composition-offline-player',source,requests)
 results['E']=run('E-partial-denial','import {host} from "host"; console.log(JSON.stringify(await Promise.all([host.chat.broadcast("Partial approval validation"),host.world.spawnEntity('+json.dumps(spawn)+')])));',[request('chat.broadcast'),request('world.spawnEntity',entityTypes=['ZOMBIE'])],['chat.broadcast'])
 results['F']=run('F-unapproved-source','import {host} from "host"; console.log(JSON.stringify('+call+'));',[],[])
 other={**spawn,'type':'SKELETON'}
 results['G']=run('G-constraint-escape','import {host} from "host"; console.log(JSON.stringify(await host.world.spawnEntity('+json.dumps(other)+')));',[request('world.spawnEntity',entityTypes=['ZOMBIE'])])
 # Quota and argument validation beyond the required demonstrations.
 results['quota']=run('quota','import {host} from "host"; console.log(JSON.stringify(await Promise.all([host.chat.broadcast("First"),host.chat.broadcast("Over quota")])));',[request('chat.broadcast')])
 bad={**spawn,'nbt':'forbidden'}
 results['arguments']=run('argument-extra-field','import {host} from "host"; console.log(JSON.stringify(await host.world.spawnEntity('+json.dumps(bad)+')));',[request('world.spawnEntity',entityTypes=['ZOMBIE'])])
 summary={k:{'executionId':d['execution']['id'],'status':d['execution']['status'],'stdout':d['execution'].get('result',{}).get('stdout'),'hostEvents':len([e for e in d.get('securityEvents',[]) if e['eventType'].startswith('host_api.')]),'paperResults':[e['metadata'] for e in d.get('securityEvents',[]) if e['eventType']=='host.command.result']} for k,d in results.items()}
 save('runtime-bound-summary.json',summary)
