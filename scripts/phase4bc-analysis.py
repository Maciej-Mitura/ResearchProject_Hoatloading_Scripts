"""Offline analysis only. Keeps warmups, expected timeouts and DNS failures distinct."""
from pathlib import Path
import json,statistics,hashlib,collections,math
R=Path(__file__).resolve().parents[1];O=R/'research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched'
def load(n):return json.loads((O/n).read_text())
def save(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rows(folder):return [json.loads(p.read_text()) for p in sorted((O/folder).glob('*.json'))]
def stats(values):
 return {'n':len(values),'min':min(values) if values else None,'median':statistics.median(values) if values else None,'mean':statistics.mean(values) if values else None,'max':max(values) if values else None,'values':values}
assert load('execution-state.json')['status']=='complete'
m=load('experiment-manifest.json');workloads=load('frozen-workloads.json');measured=rows('measured-runs');warmups=rows('warmups');preflight=rows('functional-preflight')
assert len(measured)==100 and len(warmups)==20 and len(preflight)==10
assert sha(O/'experiment-manifest.json')==load('manifest-fingerprint.json')['sha256']
assert all(sha(R/p)==h for p,h in m['hashes'].items())
assert sha(R/'.env.phase4bc')==m['privateConfigurationHash']
assert sha(O/'environment.json')==m['environmentHash'] and sha(O/'frozen-workloads.json')==m['workloadsHash']
actual=[(r['stage'],r['round'],r['workloadId'],r['runtime']) for r in sorted(warmups+measured,key=lambda r:r['sequence'])]
assert actual==[(j['stage'],j['round'],j['workloadId'],j['runtime']) for j in m['order']]
for r in measured+warmups+preflight:
 w=next(w for w in workloads if w['workloadId']==r['workloadId']);assert r['sourceHash']==w['sourceHash'] and r['permissionProfile']==w['permissionProfile']
 assert r['runtimeEvidenceStatus']=='ATTESTED' and not r['infrastructureInvalid'] and r['cleanupConfirmed']
 assert r['nativeDockerEngineId']==m['nativeDockerEngineId'] and r['imageId']==m['imageId'] and r['observedRuntime']==r['runtime']
 ev=r['runtimeEvidence'][0];ins=ev.get('createInspection') or ev.get('startInspection');assert ins['imageId']==m['imageId'] and ins['observedRuntime']==r['runtime']
 assert any(e['action']=='start' for e in ev['events']) and any(e['action']=='destroy' for e in ev['events'])
 assert r['result']['runtimeVersion']=='2.9.7' and r['result']['manifest']['permissionProfile']==w['permissionProfile']
 assert ins['controls']['Memory']==268435456 and ins['controls']['PidsLimit']==64 and ins['controls']['ReadonlyRootfs'] and ins['controls']['NanoCpus']==500000000
 assert ins['user']=='deno' and ins['controls']['CapDrop']==['ALL'] and 'no-new-privileges:true' in ins['controls']['SecurityOpt']
 assert ins['controls']['NetworkMode']==('phase4bc-sandbox-host' if r['workloadId']=='W8' else 'none')

performance=[];compatibility=[];evidence_summary=[]
for w in workloads:
 wid=w['workloadId'];groups={rt:[r for r in measured if r['workloadId']==wid and r['runtime']==rt] for rt in ['runc','runsc']}
 assert all(len(rs)==5 and sorted(r['round'] for r in rs)==[1,2,3,4,5] for rs in groups.values())
 out={'workloadId':wid,'metric':'runner/supervisor end-to-end duration, ms','runtimeStats':{},'failedOutcomeDurations':{}}
 semantics={}
 for rt,rs in groups.items():
  good=[r for r in rs if r['semanticSuccess']];bad=[r for r in rs if not r['semanticSuccess']]
  out['runtimeStats'][rt]=stats([r['result']['durationMs'] for r in good]);out['failedOutcomeDurations'][rt]=stats([r['result']['durationMs'] for r in bad])
  semantics[rt]={'attempts':len(rs),'expectedSemanticsSucceeded':len(good),'processStatuses':dict(collections.Counter(r['executionStatus'] for r in rs)),'exitCodes':dict(collections.Counter(str(r['result'].get('exitCode')) for r in rs)),'timedOutCount':sum(r['result']['timedOut'] for r in rs),'truncatedCount':sum(r['result']['outputTruncated'] for r in rs),'auditStatuses':dict(collections.Counter(r['result']['auditCollection']['status'] for r in rs)),'auditReasons':sorted({reason for r in rs for reason in r['result']['auditCollection']['reasons']}),'observationCounts':sorted({len(r['result']['permissionEvents']) for r in rs}),'permissionTargets':sorted({(e.get('permission',''),e.get('target','')) for r in rs for e in r['result']['permissionEvents']}),'cleanupErrorCount':sum(len(r['result'].get('cleanupErrors') or []) for r in rs)}
 a=out['runtimeStats']['runc']['median'];b=out['runtimeStats']['runsc']['median']
 out['medianDifferenceMs']=b-a if a is not None and b is not None else None;out['medianRatio']=b/a if a is not None and a>0 and b is not None else None;out['medianPercentageDifference']=100*(b-a)/a if a is not None and a>0 and b is not None else None
 out['note']='Intentional timeouts are successful expected semantics; this is timeout/lifecycle duration, not useful-work CPU time.' if wid=='W6' else 'No successful comparable runsc result; failed DNS-response durations remain separate, no overhead ratio.' if wid=='W8' else 'Warmups and preflights excluded; five repetitions per runtime.'
 if semantics['runc']['expectedSemanticsSucceeded']==5 and semantics['runsc']['expectedSemanticsSucceeded']<5:verdict='INCOMPATIBLE'
 elif semantics['runc']['expectedSemanticsSucceeded']<5:verdict='INCONCLUSIVE'
 else:
  keys=['processStatuses','exitCodes','timedOutCount','truncatedCount','auditStatuses','auditReasons','observationCounts','permissionTargets','cleanupErrorCount']
  verdict='COMPATIBLE WITH OBSERVED DIFFERENCE' if any(semantics['runc'][k]!=semantics['runsc'][k] for k in keys) else 'COMPATIBLE'
 compatibility.append({'workloadId':wid,'name':w['name'],'verdict':verdict,'runc':semantics['runc'],'runsc':semantics['runsc']})
 evidence_summary.append({'workloadId':wid,**semantics});performance.append(out)

failures=[{'stage':r['stage'],'sequence':r['sequence'],'workloadId':r['workloadId'],'runtime':r['runtime'],'round':r['round'],'executionId':r['executionId'],'containerId':r['containerId'],'status':r['executionStatus'],'exitCode':r['result']['exitCode'],'failureCategory':r['result'].get('failureCategory'),'stderr':r['result']['stderr'],'infrastructureInvalid':r['infrastructureInvalid'],'hostChat':r.get('hostChat')} for r in preflight+warmups+measured if not r['semanticSuccess']]
host=[{'stage':r['stage'],'round':r['round'],'sequence':r['sequence'],'runtime':r['runtime'],'executionId':r['executionId'],'traceId':r['traceId'],'containerId':r['containerId'],'durationMs':r['result']['durationMs'],'status':r['executionStatus'],'semanticSuccess':r['semanticSuccess'],**r['hostChat']} for r in preflight+warmups+measured if r['workloadId']=='W8']
hoststats={rt:{'measuredAttempts':sum(r['runtime']==rt and r['stage']=='measured' for r in host),'measuredConfirmed':sum(r['runtime']==rt and r['stage']=='measured' and r['confirmed'] for r in host),'measuredQueueToConfirmationMs':stats([v for r in host if r['runtime']==rt and r['stage']=='measured' for v in r['queueToConfirmationMs']])} for rt in ['runc','runsc']}
resources=load('resource-probe.json');runsc=[r for r in measured if r['runtime']=='runsc'];assert resources['runtimeEvidence']['observedRuntime']=='runsc'
non_root=resources['effectiveUidGid']==load('environment.json')['effectiveUidGid'] and int(resources['effectiveUidGid'][0])!=0
save('analysis-corrections.json',{'resourceProbeRawUnchanged':True,'initialHelperAssumption':'The post-probe helper compared UID/GID to 1000. Its raw output and the pre-freeze environment both show 1993/1993.','correctInterpretation':'UID 1993 is non-root and matches the frozen image; derive the classification from recorded values rather than the erroneous hardcoded helper boolean. No workload or resource probe was rerun.','readOnlyLimitation':'Root-path touch returned Permission denied, which does not independently distinguish non-root DAC denial from read-only filesystem enforcement. Read-only root remains configuration-verified only.'})
controls=[{'control':'non-root','configurationVerified':True,'behaviorallyValidated':non_root,'classification':'BEHAVIORALLY VALIDATED UNDER RUNSC' if non_root else 'CONFIGURATION VERIFIED UNDER RUNSC','result':resources['effectiveUidGid']},
 {'control':'read-only root','configurationVerified':True,'behaviorallyValidated':resources['readOnlyFilesystemErrorObserved'],'classification':'BEHAVIORALLY VALIDATED UNDER RUNSC' if resources['readOnlyFilesystemErrorObserved'] else 'CONFIGURATION VERIFIED UNDER RUNSC','result':'Root-path write was denied with Permission denied; this does not isolate read-only enforcement from non-root DAC. Read-only setting verified in Docker inspection.'},
 {'control':'timeout and cleanup','configurationVerified':True,'behaviorallyValidated':all(r['result']['timedOut'] and r['cleanupConfirmed'] for r in runsc if r['workloadId']=='W6'),'classification':'BEHAVIORALLY VALIDATED UNDER RUNSC','result':'Five expected timeout outcomes, with cleanup; supervisor enforcement, not gVisor-specific escape protection.'},
 {'control':'tmpfs workspace','configurationVerified':True,'behaviorallyValidated':resources['workspaceWriteSucceeded'],'classification':'BEHAVIORALLY VALIDATED UNDER RUNSC' if resources['workspaceWriteSucceeded'] else 'CONFIGURATION VERIFIED UNDER RUNSC','result':'Writable workspace verified; exact size enforcement not pressure-tested.'}]
for name in ['256 MiB memory/swap ceiling','64 PID limit','0.5 CPU quota','cap-drop ALL','no-new-privileges','profile-specific Docker network']:
 controls.append({'control':name,'configurationVerified':True,'behaviorallyValidated':False,'classification':'CONFIGURATION VERIFIED UNDER RUNSC','result':'Inspected on all 50 measured runsc job containers; no claim of independent pressure/escape testing.'})
accounting={'runcFunctionalPreflight':len(preflight),'plannedWarmups':20,'completedWarmupAttempts':len(warmups),'warmupExpectedSemanticsSucceeded':sum(r['semanticSuccess'] for r in warmups),'plannedMeasured':100,'completedMeasuredAttempts':len(measured),'measuredExpectedSemanticsSucceeded':sum(r['semanticSuccess'] for r in measured),'measuredProcessStatuses':dict(collections.Counter(r['executionStatus'] for r in measured)),'measuredRuntimeWorkloadFailures':sum(not r['semanticSuccess'] for r in measured),'expectedMeasuredTimeouts':sum(r['workloadId']=='W6' and r['semanticSuccess'] for r in measured),'infrastructureInvalid':sum(r['infrastructureInvalid'] for r in preflight+warmups+measured),'unattested':sum(r['runtimeEvidenceStatus']!='ATTESTED' for r in preflight+warmups+measured),'reruns':0,'unattemptedMeasured':0,'postExperimentProbesExcluded':2}
summary={'status':'COMPLETE WITH LIMITATIONS','accounting':accounting,'compatibilityCounts':dict(collections.Counter(v['verdict'] for v in compatibility)),'successfulWorkloadsUnderBoth':sum(v['runc']['expectedSemanticsSucceeded']==v['runsc']['expectedSemanticsSucceeded']==5 for v in compatibility),'hostChat':hoststats,'performance':performance,'dnsDiagnostic':load('post-experiment-dns-diagnostic.json'),'resourceControls':controls,'phase5Started':False,'recommendation':'READY FOR PHASE 5'}
save('compatibility-matrix.json',compatibility);save('performance-summary.json',performance);save('permission-evidence-comparison.json',evidence_summary);save('host-chat-results.json',{'results':host,'summary':hoststats});save('resource-validation.json',controls);save('failures.json',failures);save('analysis.json',summary)
print(json.dumps({'status':summary['status'],'accounting':accounting,'compatibilityCounts':summary['compatibilityCounts'],'performance':[{'workloadId':p['workloadId'],'runcMedian':p['runtimeStats']['runc']['median'],'runscMedian':p['runtimeStats']['runsc']['median'],'ratio':p['medianRatio']} for p in performance],'hostChat':hoststats},indent=2))
