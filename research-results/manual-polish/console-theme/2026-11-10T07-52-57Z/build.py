from common import *
r=cmd(D+['compose','build','web'],900);save('application-build.json',r);assert r['exitCode']==0,r['stderr'][-1000:]
r=cmd(D+['compose','up','-d','--no-deps','web'],180);save('application-redeploy.json',r);assert r['exitCode']==0,r['stderr']
print('Web rebuilt and deployed.')
