from phase75_common import *
r=cmd(D+['compose','build','api','web'],1200);save('application-build.json',r);assert r['exitCode']==0,r['stderr'][-1500:]
r=cmd(D+['compose','up','-d','--no-deps','api','web'],240);save('application-redeploy.json',r);assert r['exitCode']==0,r['stderr']
print('API/web rebuilt and redeployed; source change is UI plus a read-only history projection. Primary data and runner/gateway/Paper remain.')
