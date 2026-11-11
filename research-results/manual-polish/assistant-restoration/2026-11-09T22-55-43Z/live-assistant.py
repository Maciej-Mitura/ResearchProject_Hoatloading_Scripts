from common import *
import re,time
status,config=http('/api/config/public');assert status==200 and config['chatProvider']=='gemini' and config['chatModel']=='gemini-3.8-flash' and config['chatStatus']=='configured'
save('live-public-config.json',config)
cases=[('A','Create a TypeScript script that calculates 21 * 2 and prints the result.'),('B','Create a script that prints "Hello World" in the console.'),('C','Create a script that prints "Hello World" in the console and broadcasts it to the in-game chat.'),('D','Create a script that reacts every time a player joins the server.'),('E','Which execution profiles are currently supported, what does each grant, and can assistant settings grant runtime permissions?')]
results=[]
for cid,prompt in cases:
 status,conversation=http('/api/conversations',{'title':'Assistant restoration '+cid});assert status==201
 start=time.monotonic()
 # Fresh conversation: never send any historical private conversation to the provider.
 req=urllib.request.Request('http://localhost:13000/api/conversations/'+conversation['id']+'/messages',data=json.dumps({'content':prompt,'saveProposal':False}).encode(),headers={'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=90) as response:status=response.status;body=json.load(response)
 except urllib.error.HTTPError as error:status=error.code;body=json.load(error)
 except Exception as error:status=0;body={'error':{'message':clean(str(error))}}
 record={'caseId':cid,'conversationId':conversation['id'],'prompt':prompt,'status':status,'latencyMs':round((time.monotonic()-start)*1000),'body':body}
 save('assistant-'+cid+'.json',record)
 if status!=201:
  results.append({'caseId':cid,'verdict':'FAIL','status':status});save('live-assistant-summary.json',results);print(cid,'FAIL',status,'stopping; no mock fallback or repeated provider attempts',flush=True);raise SystemExit(1)
 message=body['assistantMessage'];text=message['content'];assert message['metadata']['provider']=='gemini' and message['metadata']['model']==config['chatModel'] and "I don't call a real generative AI API" not in text
 record['codeBlocks']=re.findall(r'```(?:typescript|ts|javascript|js)\s*\n(.*?)```',text,re.S)
 save('assistant-'+cid+'.json',record)
 results.append({'caseId':cid,'conversationId':conversation['id'],'messageId':message['id'],'provider':'gemini','model':config['chatModel'],'latencyMs':record['latencyMs'],'verdict':'RECEIVED_REAL_RESPONSE'})
 save('live-assistant-summary.json',results);print(cid,'real Gemini response',len(text),'characters',flush=True)
print('Five real responses received. Inspect semantic outcomes before marking PASS.')
