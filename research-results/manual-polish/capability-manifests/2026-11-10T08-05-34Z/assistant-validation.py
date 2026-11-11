from common import *
def long_http(path,body):
 req=urllib.request.Request('http://localhost:13000'+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=75) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
prompts={
 'pure':'Create a one-shot TypeScript script that prints 6 * 7. No host calls. Return the source and an empty requested capability list.',
 'chat':'Create a one-shot TypeScript script that broadcasts "Hello from Runlattice". Request the minimum registered capability with maxCalls 1. Explain user review is required.',
 'spawn':'Create a one-shot TypeScript script that spawns exactly three ZOMBIE entities near the configured demo location. Obtain the location through the registered status SDK. Request only the capabilities needed with appropriate constraints. Keep within the ten-second run budget.',
 'multi':'Create a one-shot TypeScript script that announces zombies are incoming, reads the configured demo location, spawns exactly three ZOMBIE entities nearby, and sends a private confirmation to GoldennBullet. Request all required registered capabilities with narrow constraints and per-capability reasons. Await effects, handle an offline player explicitly, and make no claim of prior approval.',
 'unsupported':'Can this project let my sandbox script execute arbitrary Paper console commands or call world.deleteServer? Explain the limitation. Do not invent capabilities or provide a workaround.'
}
summary={}
for name,prompt in prompts.items():
 _,conversation=http('/api/conversations',{'title':'Capability extension assistant validation: '+name})
 status,response=long_http('/api/conversations/'+conversation['id']+'/messages',{'content':prompt})
 save('assistant-'+name+'.json',{'httpStatus':status,'conversationId':conversation['id'],'response':response})
 if status!=201:
  print(name,status,response.get('error'),flush=True);summary[name]={'httpStatus':status,'failed':True};break
 p=response.get('proposal')
 summary[name]={'httpStatus':status,'proposal':bool(p),'capabilities':[r['capability'] for r in p.get('requestedCapabilities',[])] if p else [],'provider':response['assistantMessage'].get('metadata',{}).get('provider'),'model':response['assistantMessage'].get('metadata',{}).get('model')}
 print(name,summary[name],flush=True)
save('assistant-summary.json',summary)
