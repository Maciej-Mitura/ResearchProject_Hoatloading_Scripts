"""Synthesize only Phase 5 evidence. Does not execute scripts or contact providers."""
from phase5_common import *
import hashlib,re
load=lambda name:json.loads((OUT/name).read_text())
def md(name,value):(OUT/name).write_text(clean(value),encoding='utf-8')
e8=load('executions/E8.json');command=e8['hostCommands'][0];call=command['correlation']['callId']
observed='empirically observed';inferred='inferred from trusted stored relationship';configured='configuration only'
chain=[
 ('User/script request -> execution ID',observed,'API-created script/version and durable execution','executions/E8.json'),
 ('Execution ID -> admission',inferred,'Current mandatory admission path; E8 starts and completes; actual occupied bound tested separately','admission-regression.json'),
 ('Admission -> runner',inferred,'Trusted API Docker provider calls deployed runner; deployed sources match','deployed-source-integrity.json'),
 ('Runner -> container/runtime',observed,'Docker events and create/start inspections: runc, fixed image and resource controls','executions/E8.json'),
 ('Container -> Deno profile',observed,'Deno 2.9.7, host-chat manifest, native permission records and successful scoped SDK call','executions/E8.json'),
 ('Deno profile -> capability session',inferred,'Runner mints/revokes a scoped gateway session; gateway accepts E8 call. Token value deliberately not recorded','services/runner/src/gateway.ts'),
 ('Capability session -> Host Gateway call ID',observed,'host_api.requested/allowed share trusted execution and call IDs','executions/E8.json'),
 ('Gateway call -> API enqueue',observed,'host_api.queued names command; unauthorized and forged mapping routes separately rejected','security-boundaries.json'),
 ('API enqueue -> PostgreSQL command ID',observed,'origin=sandbox_capability and exact execution/trace/call/capability mapping in DB','executions/E8.json'),
 ('Command -> SecureBridge poll/delivery',inferred,'Completed command, authenticated confirmation and plugin handling imply delivery. No independent poll packet capture or persisted delivery timestamp','apps/api/src/repositories/host.ts'),
 ('SecureBridge -> Paper execution',observed,'server_broadcast event plus successful broadcasted command result, not merely queued acceptance','executions/E8.json'),
 ('Paper execution -> bridge confirmation',observed,'completed command and server_broadcast event agree on command ID and message','executions/E8.json'),
 ('Bridge confirmation -> security evidence',observed,'Late host.command.result uses the same trusted command/call/trace mapping','executions/E8.json'),
 ('Execution evidence -> deterministic advisory',observed,'assessmentStatus=ok, low, analyzerVersion=1; stored separately from completed execution','executions/E8.json'),
 ('Execution/advisory -> OTel export',observed,'Actual collector receipt of execution and sandbox.run, host_api and risk.classified events with matching trace','otel-validation.json'),
 ('Late Paper confirmation -> complete distributed Paper trace',configured,'NOT OBSERVED: late host.command.result remains PostgreSQL evidence; no exported Paper span','otel-validation.json')]
save('host-chain-evidence.json',{'executionId':e8['executionId'],'traceId':e8['traceId'],'callId':call,'commandId':command['id'],'containerId':e8['runtimeEvidence'][0]['containerId'],'states':{'REQUESTED':'observed','AUTHORIZED':'observed host_api.allowed','QUEUED':'observed host_api.queued','DELIVERED':'inferred from trusted completed command and confirmation, not independently timestamped','CONFIRMED':'observed Paper server_broadcast and successful command_result'},'arrows':[dict(arrow=a,evidenceClass=b,detail=c,evidence=d) for a,b,c,d in chain]})
md('host-chain-evidence.md','# E8 final host-capability chain\n\n'+f"Execution `{e8['executionId']}`; trace `{e8['traceId']}`; call `{call}`; command `{command['id']}`.\n\n"+'| Arrow | Evidence class | Evidence / limit |\n|---|---|---|\n'+''.join(f'| {a} | {b} | {c} ({d}) |\n' for a,b,c,d in chain))

E='EMPIRICALLY DEMONSTRATED';C='CONFIGURATION VERIFIED';A='ARCHITECTURAL / DESIGN PROPERTY';N='NOT DEMONSTRATED'
claims=[
 ('Deno scoped filesystem restriction',E,'E2/E3 denial, E4 allowed fixture and denied outside scope','core-execution-matrix.json','Observed operations in fixed profiles; no universal filesystem exploit claim.'),
 ('Deno scoped environment restriction',E,'E5 allowed demo variable and restricted unrelated environment','executions/E5.json','Names/access observations do not expose credential values.'),
 ('Caught restricted activity observation',E,'E3 completes while retaining native permission observation','executions/E3.json','Access/check event is not itself an allow/deny verdict.'),
 ('Docker non-root',C,'Live create/start inspection user=deno','executions/E8.json','Verified configured user; no privilege-escalation exploit campaign.'),
 ('Docker read-only root',C,'Live ReadonlyRootfs=true; writable tmpfs explicitly bounded','executions/E8.json','Not every possible write primitive was challenged.'),
 ('Docker memory bound',C,'Live Memory=MemorySwap=268435456 bytes','executions/E8.json','No new Phase 5 memory-pressure benchmark.'),
 ('Docker PID limit',C,'Live PidsLimit=64','executions/E8.json','No new fork/PID exhaustion attack.'),
 ('Dropped capabilities',C,'Live CapDrop=[ALL]','executions/E8.json','Configuration evidence, not a kernel isolation proof.'),
 ('no-new-privileges',C,'Live SecurityOpt=no-new-privileges:true','executions/E8.json','No exploit-based escalation test.'),
 ('Wall timeout',E,'E6 infinite work terminated, slot released and container destroyed','executions/E6.json','10s configured job deadline; bounded cleanup also has overhead.'),
 ('Output capture bound',E,'E7 bounded return and outputTruncated=true','executions/E7.json','1 MiB limit can remove audit frame; uncertainty reported.'),
 ('Global admission bound within one runner',E,'Two active jobs, third HTTP 429, recovery succeeds','admission-regression.json','Process-wide capacity=2, not a distributed/multi-runner global queue.'),
 ('Host Gateway capability authorization',E,'Valid host-chat E8 accepted; invalid credential during outage rejected','collector-outage.json','Only chat.broadcast is sandbox-accessible; bounded local PoC.'),
 ('Sandbox/admin separation',E,'Capability port lacks admin route; admin/API transport denied to host-chat sandbox','security-boundaries.json','Deno transport scope plus separate authenticated admin surface.'),
 ('Paper-confirmed host effect',E,'Completed command and server_broadcast event','executions/E8.json','Server-side confirmation; no connected human-player screen verification.'),
 ('Trusted correlation',E,'DB origin and execution/trace/call IDs; forged mapping rejected even by authenticated harness','security-boundaries.json','Trusts runner, gateway, API, DB and authenticated plugin; not hostile administrators.'),
 ('Audit completeness uncertainty',E,'E6 timeout and E7 truncation yield unavailable, not complete','core-execution-matrix.json','Complete means frame collection succeeded, not exhaustive security observability.'),
 ('OTel export/correlation',E,'Collector receives E1/E8 spans with matching IDs','otel-validation.json','Custom API exporter, detailed debug output only; no full Paper distributed span.'),
 ('Collector failure independence',E,'One collector outage retains denial, authorization, Paper effect and DB evidence','collector-outage.json','Export error visible; outage trace not guaranteed to be replayed later.'),
 ('Deterministic classifier agreement',E,'15/15 development, 9/10 holdout, 24/25 combined','deterministic-replay.json','Controlled reference agreement, not general malware-detection accuracy. HOL-008 unchanged.'),
 ('Jev repeatability/agreement',E,'23/25 unanimous across five repeats, 16/25 modal reference agreement','jev-package-integrity.json','Saved pinned-model experiment; no Phase 5 live-provider availability test.'),
 ('gVisor compatibility',E,'9/10 frozen workloads compatible across matched experiment','gvisor-package-integrity.json','Native WSL Linux/runsc experiment; not normal Desktop application deployment.'),
 ('gVisor overhead',E,'Recomputed stored duration stats from 100 measured runs; CPU median ratio 1.620, IO 2.615','gvisor-package-integrity.json','Workload/end-to-end WSL measurements, not portable runtime-only overhead.'),
 ('gVisor host-chat incompatibility',E,'W8 runsc DNS fails 5/5; matched runc Paper-confirmed 5/5','gvisor-package-integrity.json','Negative result retained; DNS fix not attempted.'),
 ('gVisor escape prevention',N,'No escape exploit evaluation performed','gvisor-package-integrity.json','Cannot claim escape prevention from runtime selection, attestation or compatibility.'),
 ('Execution/advisory separation',E,'Injected throw/stall returns failed analysis with null classification, independent execution outcome','api-tests.json','Focused local regression; active deterministic analyzer not disrupted.'),
 ('Supervisor owns Docker policy',A,'Strict request validator and only runner receives engine socket','services/runner/src/validate.ts','Trusted runner/engine remain high privilege.'),
 ('No silent Docker-to-mock fallback',A,'Docker unavailable path returns 503 and unavailable audit; provider selection explicit','services/runner/src/main.ts','Not an engine-outage experiment in Phase 5.'),
 ('Scoped capability lifecycle',A,'Trusted runner session create/revoke, TTL and call budget','services/host-gateway/src/sessions.ts','In-memory session state; no distributed session service.'),
 ('Fresh-data normal deployment',E,'Independent generated credentials and fresh volumes; three executions including confirmed Paper effect','clean-setup.json','Current uncommitted working tree and cached/network dependencies; not published-HEAD clean clone.'),
 ('Production end-user access control',N,'Not implemented/tested as production multi-tenant service','architecture-source-review.json','Local research PoC with service credentials; production authentication is out of scope.'),
 ('Database outage/restart recovery guarantees',N,'No DB-outage experiment in Phase 5','database-schema.json','Healthy durable writes and migrations observed, not high availability.'),
 ('Secret isolation in sandbox environment',E,'Docker integration secret-environment test passes; native observations retain names, not values','docker-integration-tests.json','Scope is configured application credentials, not arbitrary future integrations.')]
save('security-claim-matrix.json',{'evidenceClasses':[E,C,A,N],'scope':'Controlled research PoC; empirical claims apply to listed observations, not universal security guarantees.','claims':[dict(id=f'CLM-{i:02}',claim=a,evidenceClass=b,evidence=c,artifact=d,limitation=e) for i,(a,b,c,d,e) in enumerate(claims,1)]})
claimtable='| ID | Claim | Evidence class | Evidence | Limitation |\n|---|---|---|---|---|\n'+''.join(f'| CLM-{i:02} | {a} | {b} | {c}; `{d}` | {e} |\n' for i,(a,b,c,d,e) in enumerate(claims,1))
md('security-claim-matrix.md','# Final security claim matrix\n\n'+claimtable)

cleanup=[
 ('apps/web/src/components/Inspector.tsx:501','Clarify PostgreSQL-derived security/timeline evidence versus actual collector receipt.'),
 ('apps/web/src/components/Inspector.tsx:513','Replace unconditional mocked-enforcement caveat with runtime-specific wording.'),
 ('apps/web/src/components/ProjectSettingsPanel.tsx:210','Explain policy intent versus actual enforced fixed Deno profiles; also line 278.'),
 ('apps/web/src/components/Inspector.tsx:777','Optional dead callback cleanup only. Direct broadcast already disabled at line 778; do not report an active bypass.'),
 ('apps/api/src/providers/chat.ts:76','Mock chat welcome drafts use unsupported onPlayerJoin/host.broadcast; execution-mocked statement at 83 and host.requestStatus at 106 are stale even when Docker execution is selected.'),
 ('apps/api/src/project/schema.ts:250','Refresh runtime capability/enforcement descriptions; also mocked/not-implemented warning around 578. Preserve distinction between policy intent and enforced profiles.'),
 ('samples/scripts/welcome-message.js:3','Label or replace obsolete event subscription / host.broadcast example with current supported SDK scope.'),
 ('samples/scripts/host-status-query.js:3','Label unsupported sandbox host.requestStatus example; server.status is backend-only.'),
 ('apps/api/src/db/migrations/002_seed.sql','Annotate or supersede obsolete seeded examples in an additive migration if needed; do not rewrite historical migration.'),
 ('README.md:24','Refresh pending evaluation status and evidence links at lines 58-59 and 196-204; distinguish current working-tree validation from published checkout.'),
 ('docs/ARCHITECTURE.md:83','Date prior future-runsc wording and outstanding empirical work at 133-134; link actual Phase 3/4/5 evidence.'),
 ('docs/JEV-RISK-COMPARISON.md:38','Update current adapter version diagram from 1 to 2 and link frozen empirical report; keep historical failure evidence.'),
 ('docs/GVISOR.md:1','Scope Desktop absence separately from successful native WSL/runsc experiment; preserve historical environment observations.'),
 ('docs/GVISOR-EXPERIMENT.md:1','Link matched Phase 4B/C package and intentional shutdown status; retain original dated preflight findings.')]
save('phase6-cleanup-list.json',{'implementedInPhase5':False,'items':[{'path':p,'action':a} for p,a in cleanup]})
md('phase6-cleanup-list.md','# Phase 6 cleanup candidates — not implemented\n\n'+''.join(f'- `{p}`: {a}\n' for p,a in cleanup))
save('architecture-source-review.json',{'status':'COMPLETE','primaryPath':'API DockerExecutionProvider -> runner-owned admission/validation/container policy -> pinned Deno -> execution-scoped Host Gateway -> authenticated API enqueue -> PostgreSQL -> authenticated SecureBridge -> Paper -> confirmed command result. Advisory analysis and optional OTLP export remain separate.','sourceGroups':{'execution':['apps/api/src/routes/executions.ts','apps/api/src/providers/execution.ts','services/runner/src/main.ts','services/runner/src/docker.ts','services/runner/src/admission.ts','services/runner/src/validate.ts','services/runner/src/permissions.ts','services/runner/src/frames.ts'],'host':['services/runner/src/gateway.ts','services/host-gateway/src/main.ts','services/host-gateway/src/sessions.ts','apps/api/src/routes/internal.ts','apps/api/src/host/provenance.ts','apps/api/src/repositories/host.ts','apps/api/src/routes/host.ts'],'evidence':['apps/api/src/services/advisory.ts','apps/api/src/risk/collected-evidence.ts','apps/api/src/risk/deterministic.ts','apps/api/src/risk/jev-input.ts','apps/api/src/telemetry/otel.ts','apps/api/src/telemetry/timeline.ts']},'importantBoundaries':['Runner is trusted and owns Docker socket and execution policy. No generic Docker proxy.','Deno network reachability is transport, not capability authority. Gateway public/admin listeners differ.','Queue origin/correlation derives from authenticated gateway and trusted execution/trace DB mapping, never sandbox payload metadata.','Only chat.broadcast is sandboxAccessible; server.status/player_list are backend-only; events/inventory/console remain unimplemented roadmap.','Analysis failure has null classification and cannot change sandbox outcome. Audit access/check records do not assert grant or denial.','OTel spans are synthesized by trusted API from stored results; collector receipt is separately verified.','One runner admission process is not a distributed deployment-wide scheduler.'],'sourceChangeDuringPhase5':False,'deployedSourceMatches':'deployed-source-integrity.json','cleanupList':'phase6-cleanup-list.json'})

tests=[]
for mode in ['api','runner','gateway','docker-integration','postgres','frontend','java','frontend-typecheck']:
 d=load(mode+'-tests.json');assert d['exitCode']==0
 counts=d.get('counts') or d.get('junit')
 if mode=='frontend':
  assert re.search(r'13\s+passed',d['stdout']);counts={'passed':13,'failed':0,'skipped':0}
 tests.append({'suite':mode,'status':'PASS','counts':counts,'artifact':mode+'-tests.json'})
total=sum(t['counts']['passed'] for t in tests if t['counts']);assert total==217,total
save('tests.json',{'status':'PASS','testCasesPassed':total,'testCasesFailed':0,'localApiGuardedTestSkipped':1,'localSkipSubsequentlyExecuted':'Same real PostgreSQL test separately passed in deployed API; original local skip retained.','suites':tests,'additionalChecks':[{'check':s,'status':'PASS'} for s in ['Two Compose configurations','25 frozen Jev input validations','25 deterministic replay cases','131 Phase 3 manifest hashes','439 Phase 4 sealed artifacts and timing recomputation','1222 historical file fingerprints','89 deployed source/contract comparisons','E1-E8 live application executions','Security boundary regression','Admission/lifecycle regression','Collector receipt/outage/recovery','Three fresh-data application cases']],'skipped':[{'check':'Optional live Jev call','status':'SKIPPED','reason':'Current local compatibility and frozen experiment sufficient; zero paid/provider calls.'},{'check':'Optional new runsc probe','status':'SKIPPED','reason':'Frozen attested package sufficient; intentionally stopped native environment not restarted.'}],'unavailable':[{'check':'Manual live browser walkthrough','status':'UNAVAILABLE','reason':'Computer-use application approval timed out. Source/assets/contracts and frontend tests used; no visual pass claimed.'}]})
limitations=[
 'Manual native browser walkthrough unavailable; visual layout/navigation acceptance is not established.',
 'Fresh-data build validates current uncommitted source, not a clean published HEAD checkout; Docker/dependency caches and network downloads used.',
 'OTel has detailed debug exporter, no durable trace backend or complete Paper distributed span; late Paper results remain PostgreSQL records.',
 'Collector export can fail/drop telemetry; restrictions/authorization/durable DB writes remained effective during the one tested outage.',
 'Native permission access/check observations have blind spots; collection complete is not a proof that every security event was observed.',
 'Single-runner admission and in-memory sessions are a bounded local research design, not distributed scheduling or production multi-tenant authentication.',
 'Jev 25-case reference agreement and five repetitions do not estimate broad malware-detection accuracy. No Phase 5 provider availability call.',
 'gVisor CPU/IO overhead and W8 DNS incompatibility are specific to frozen Linux/WSL systrap experiment; escape prevention untested.',
 'Memory/PID/privilege controls verified in actual Docker configuration; no new exploit or pressure campaign for each control.',
 'Database outage/high availability and production failure recovery guarantees not established by Phase 5.'
]
save('final-blocker-assessment.json',{'result':'COMPLETE WITH LIMITATIONS','MUST_FIX_BEFORE_CONCLUSION':[],'ACCEPTABLE_LIMITATION':limitations,'CLEANUP_ONLY':[dict(path=p,action=a) for p,a in cleanup],'rationale':'Existing bounded empirical evidence supports answering the scoped research question, including negative findings. No new functional defect blocks research synthesis. Do not expand conclusions to escape prevention, general malware detection or production security.','recommendation':'READY FOR PHASE 6','phase6Started':False,'completenessEstimates':{'technicalPocPercent':95,'empiricalValidationPercent':95,'totalResearchProjectPercent':85,'nature':'Subjective planning estimates, not measured or weighted scores.'}})

matrix='| Case | Profile | Execution outcome | Audit status | Risk | Verdict |\n|---|---|---|---|---|---|\n'+''.join(f"| {r['caseId']} | {r['profile']} | {r['outcome']} | {r['auditCollection']['status']} | {r['risk']} | {r['verdict']} |\n" for r in load('core-execution-matrix.json'))
testtable='| Suite | Status | Passed | Failed | Skipped |\n|---|---|---:|---:|---:|\n'+''.join(f"| {t['suite']} | PASS | {t['counts']['passed'] if t['counts'] else 'command check'} | {t['counts']['failed'] if t['counts'] else 0} | {t['counts']['skipped'] if t['counts'] else 0} |\n" for t in tests)
report=f'''# Phase 5 result

COMPLETE WITH LIMITATIONS

# Executive summary

- E1–E8 passed on the actual normal Docker Desktop/runc deployment, including caught restricted activity, timeout, bounded output and a Paper-confirmed sandbox broadcast.
- Security-boundary and capacity/recovery checks passed; execution remains independent from advisory classification and collector availability.
- Real collector receipt verified for E1/E8. PostgreSQL evidence is durable application evidence, distinct from exported spans.
- One collector outage retained restrictions, authorization, Paper execution and PostgreSQL writes; export failure was visible and later receipt recovered.
- Fresh images/current source with independent secrets and fresh volumes passed normal, caught-denial and confirmed-host cases.
- Regression suites: 217 passed, zero failed; one local guarded DB skip subsequently passed deployed. Browser visual walkthrough unavailable.
- Frozen deterministic/Jev/gVisor findings reproduced or verified without retuning, provider calls or benchmark reruns. All 1,222 initial fingerprints unchanged.
- No must-fix research blocker found. Phase 6 cleanup is listed only; no production source, old experiment, docs or UI was changed.

# 1. Final validation environment

Validation began 2026-11-09 15:24:05 UTC. Primary application: Docker context `desktop-linux`, engine ID `3c068aed-90ac-4c09-8001-bc916b2b369b`, Docker 28.1.1, kernel `6.6.87.1-microsoft-standard-WSL2`, normal runc. API `localhost:13000`, web `localhost:15173`, Paper `localhost:25565`. `EXECUTION_PROVIDER=docker`, `CHAT_PROVIDER=mock`, `RISK_ANALYZER=deterministic`; mock chat does not mean mock execution. Deno sandbox 2.9.7; image `sha256:4a238c157340e7da78e0701066947098d83f8b47e7922a6d4f7530f6a6789b5c`. API/runner/gateway use Deno 2.1.4. All nine migrations applied; provenance and assessment-status columns verified against real PostgreSQL.

Source review is in `architecture-source-review.json`. All 89 deployed API/runner/gateway source/shared-contract hashes match the current tree. Primary services remain running, same containers/images as at start; collector was stopped/restored once. Final active jobs, orphan sandboxes, nonterminal executions and pending commands are all zero. Separate reproduction services are stopped; fresh evidence volumes remain. Native Phase 4 Linux/runsc shutdown is intentional, not a regression.

# 2. Core execution matrix

{matrix}
E1 prints normally; E2 is an uncaught restricted read; E3 catches the same class of denial; E4 allows the fixture while observing restricted outside access; E5 scopes the demo environment variable; E6 is nonterminating work; E7 overproduces output; E8 uses the real host SDK. E6/E7 correctly mark audit unavailable with timeout/truncation and missing-frame reasons. They do not fabricate complete collection. Every case has live Docker create/start runtime evidence and cleanup evidence in `executions/`.

# 3. Final host-capability chain

REQUESTED → AUTHORIZED (`host_api.allowed`) → QUEUED are directly observed. DELIVERED is inferred from the trusted completed command and plugin confirmation, not separately packet-captured/timestamped. CONFIRMED is observed in successful `broadcasted` result and Paper `server_broadcast`.

- Execution: `{e8['executionId']}`
- Trace: `{e8['traceId']}`
- Call: `{call}`
- Command: `{command['id']}`
- runc container: `{e8['runtimeEvidence'][0]['containerId']}`

`host-chain-evidence.json` and `.md` classify every requested arrow as empirically observed, inferred from trusted stored relationship or configuration only. Queue origin is `sandbox_capability`. No token value is retained. `accepted=true` means queued, not confirmed. E8 execution finishes at 15:30:15.902Z; Paper result arrives at 15:30:17.242Z. The late confirmation is durable security evidence but absent from the earlier exported root span and the saved initial UI timeline.

# 4. Security-boundary regression

PASS. Sandbox capability listener exposes no session admin route (404). Host-chat Deno scope denies admin port 3201 and direct API port 3000. Public direct broadcast returns 403 `direct_commands_disabled`; unauthenticated internal enqueue returns 401; authenticated trusted harness with forged execution/trace mapping returns 403 `untrusted_correlation`. No rejected probe enqueues a command. The service credential is used only by the trusted harness and never injected into sandbox tests. Gateway unit and actual Docker integration suites also pass authorization/scope regressions. See `security-boundaries.json`.

# 5. Admission/lifecycle regression

PASS. Two real runner jobs occupy capacity=2; the third returns HTTP 429 `capacity_rejected`. Both held jobs complete, recovery prints successfully, and active count returns to zero. These focused runner requests are not falsely presented as API/database executions. E6 timeout and E7 output bounding clean up their containers and release capacity. Final orphan count is zero. Admission is global to this one runner process, not a distributed engine/account guarantee. See `admission-regression.json` and `final-environment.json`.

# 6. Deterministic regression

PASS: current builder/rules replay 15/15 development, 9/10 holdout, 24/25 combined. HOL-008 stays `low` versus researcher reference `review`. Rules, references and frozen evidence were unchanged. This is agreement on the controlled research corpus, not broad detector accuracy. Focused advisory throw/stall regression also passes: failed analysis has null classification and does not alter execution outcome.

# 7. Jev package/integration status

PASS for saved experiment integrity/current local integration. All 131 frozen manifest hashes verify. Saved modal agreement 16/25, individual agreement 84/125, unanimous five-repeat classification 23/25; deterministic comparator 24/25. Earlier provider/account failure evidence remains intact.

Current 25 structured inputs validate locally. Provider Vercel; endpoint `https://ai-gateway.vercel.sh/typesafe/v1/systemone`; pinned model `typesafe-ai/jev-1.14.0`; policy/input/transformation/analyzer versions 2; policy SHA-256 `4220afc83059cd6449e864ff09d43f1fcb610872ea4d344f7ced6c28f4a102f8`. Matching credential is configured, with no value saved. Optional live check SKIPPED; zero Phase 5 provider calls. No source/stdout/reference labels or credentials were sent. Saved empirical results and current local provenance must not be described as a new provider-availability test.

# 8. gVisor package/integration status

PASS for frozen integration/evidence integrity. All 439 sealed artifacts verify. All 100 measured runs attest the requested runtime; zero infrastructure-invalid runs; 9/10 compatible workloads. Stored duration n/min/max/median/mean recomputed successfully. CPU median runsc/runc ratio 1.620; file-I/O ratio 2.615, specific to the frozen end-to-end workload/environment.

W8 host-chat fails DNS on runsc 5/5 while matched runc confirms Paper effects 5/5. This negative result remains valid. Native Linux/WSL engine 29.9.3, runsc 20261102/systrap is separate from normal Desktop/runc. It was intentionally stopped after Phase 4. Optional probe SKIPPED; zero new benchmark runs; no DNS fix. Escape prevention remains NOT DEMONSTRATED.

# 9. OpenTelemetry validation

PASS for actual collector receipt, distinct from PostgreSQL reconstruction. Collector debug output contains E1 trace `e6dc3fc00df0c20d6a24fa2d694b3848` and E8 trace `{e8['traceId']}`, with `execution` and `sandbox.run`, execution IDs and `risk.classified`; E8 includes `host_api.requested`, `allowed`, `queued` and command ID. Exported counters observed: execution count/failures, permission access count, host API request/deny counts.

PostgreSQL stores execution result, security events, command provenance/results and UI timeline. Those rows alone do not prove OTel receipt. The trusted API synthesizes OTLP/HTTP JSON spans from execution/evidence; this is not automatic instrumentation through every Deno/gateway/Paper process. Collector uses detailed debug exporter without a durable trace backend. No Paper span or late `host.command.result` was observed in the root export. See `otel-validation.json` and `collector-debug.log`.

# 10. Collector-outage result

PASS. Collector stopped once; one actual host-chat script caught a restricted read, rejected an unauthenticated gateway call, then legitimately broadcast through its scoped SDK. Paper confirmation and durable PostgreSQL evidence persisted; deterministic advisory remained separate. API emitted `[otel] export error (ignored): Signal timed out.` Collector restored in a finally path, and a later execution's collector receipt verified recovery. Outage export may be lost; no replay guarantee is claimed. See outage/restoration/recovery artifacts.

# 11. UI truthfulness findings

Phase 6 fixes only: provider-specific enforcement wording at Inspector:513 and ProjectSettingsPanel:210/278; clarify PostgreSQL versus collector evidence at Inspector:501; optionally remove dead direct-broadcast callback wiring. The current button is already disabled at Inspector:778 and labeled “Direct broadcast disabled”; it is not an active bypass.

Manual browser walkthrough UNAVAILABLE because computer-use app approval timed out; no bypass attempted. Deployed HTTP HTML/JS, current React source/contracts, actual E1–E8 records, 13 frontend tests and type check were inspected. This is behavioral/contract evidence, not a visual layout/navigation acceptance pass. No cosmetic changes made.

# 12. Stale docs/examples/features

The exact additive cleanup inventory is `phase6-cleanup-list.json`/`.md`. It names paths and lines for mocked enforcement labels; mock assistant's obsolete `onPlayerJoin`, `host.broadcast`, `host.requestStatus` and false execution-mocked statement; sample scripts; stale project schema descriptions; historical seed examples; pending/incomplete empirical status in README/ARCHITECTURE; Jev adapterVersion 1 diagram; and Desktop-versus-native gVisor documentation.

Keep historical migrations and experiment observations intact; supersede/annotate as appropriate. Capability catalogue is already truthful: only chat.broadcast is sandbox-accessible; server.status/player_list are backend-only; event subscriptions/inventory/console remain roadmap. Do not implement them as cleanup. No Phase 6 edits were made.

# 13. Reproducibility / clean setup

PASS with explicit source/environment limits. Separate Compose project `phase5-repro`, unique application image tags, independent generated credentials, fresh DB/Paper/plugin volumes and isolated network/loopback ports. Built all application images from current tree. Normal script, caught restricted read and confirmed Paper broadcast all passed. No existing data volumes reused or working data destroyed. Disposable services subsequently stopped; volumes retained. Exact override/build/start/validation logs and execution IDs saved.

Used the README Docker-only flow with valid generated secrets and Docker execution; override isolates tags/networks/ports. Existing Docker/dependency caches and network downloads were used. This was not an offline/no-cache build. Current integrated source is uncommitted, so published Git HEAD alone does not reproduce it; a final source snapshot/release identity is needed for external handoff. No hidden old database/plugin volume was needed.

# 14. Security claim matrix

Full machine-readable matrix: `security-claim-matrix.json`; human-readable: `security-claim-matrix.md`. Thirty-three claims distinguish empirical observations, inspected configuration, architectural properties and absent evidence. Configuration limits are not promoted to exploit resistance. Full matrix:

{claimtable}
# 15. Tests

{testtable}
PASS: 217 test cases, zero failed. API local guarded database case SKIPPED once; that same real PostgreSQL test subsequently PASS inside the deployed API. The skip remains in the local report; it is not silently relabeled. Frontend type check is a command check, not a test count.

PASS additional checks: two Compose configurations; 25 local frozen Jev inputs; 25 deterministic cases; 131 Phase 3 hashes; 439 Phase 4 sealed artifacts and timing recomputation; 1,222 historical fingerprints; 89 deployed source/contract hashes; E1–E8; security boundaries; capacity recovery; OTel receipt/outage/recovery; three fresh-data cases. These checks are not added to the 217 unit/integration testcase total.

FAIL: 0 application test cases/checks. SKIPPED: optional live Jev call and optional new runsc probe, plus original local guarded DB test noted above. UNAVAILABLE: manual browser walkthrough. See `tests.json` and suite logs, including Java JUnit XML.

# 16. Defects discovered

No new functional research blocker or production code fix. Stale wording/examples and incomplete end-to-end exported Paper telemetry are documented above. UI direct-broadcast control was verified already disabled; a draft Phase 5 finding saying it remained active was corrected in the new Phase 5 synthesis only, without changing historical reports.

Validation helper correction: initial E1 post-run assertion used an obsolete risk `status` key. Cause: current API exposes `assessmentStatus`. Fix: helper uses the actual contract and reuses the saved completed E1 record; core matrix then passed. No execution/result/reference/model/rule was modified or rerun to obtain a different result. Native browser launch timed out; fallback clearly labeled unavailable rather than counted passing.

# 17. Remaining technical limitations

'''+''.join(f'- {s}\n' for s in limitations)+f'''
# 18. Final research blockers

MUST FIX BEFORE CONCLUSION: none within the scoped research question. Negative Jev comparison and runsc DNS compatibility result are findings, not reasons to retune evidence or expand the system.

ACCEPTABLE LIMITATION: the explicit limits in section 17, including unavailable manual visual walkthrough, source publication identity, OTel/Paper span gap, single-runner design and absence of escape/general detection claims. Report these in subsequent synthesis.

CLEANUP ONLY: exact section 11/12 inventory for demo and documentation consistency. Source archive/release identification is needed for external reproducibility handoff; current fresh-data working-tree validation is evidenced. No production features, new benchmark/corpus, runtime or classifier required.

# 19. Current project completeness

TECHNICAL POC: 95%. EMPIRICAL VALIDATION: 95%. TOTAL RESEARCH PROJECT: 85%. These are subjective planning estimates, not measured scores or statistical confidence. Runtime/evidence chain and controlled evaluations are sufficiently validated; remaining work is truthful presentation/documentation, source packaging, final synthesis and explicitly limited manual visual review. Percentages do not imply untested production guarantees.

# 20. Recommendation

Proceed to the later cleanup/presentation phase using this evidence and its limits. Keep frozen negative results and HOL-008 unchanged. Phase 6 has not begun. Final research interpretation must remain scoped to controlled observations rather than universal security effectiveness.

READY FOR PHASE 6
'''
md('report.md',report)
# Verify final state includes original service identities, not just running replacements.
initial=load('environment.json')['services'];final=load('final-environment.json')['primaryServices']
assert all(s['id']==initial[s['service']]['containerId'] and s['image']==initial[s['service']]['imageId'] for s in final)
# Scan every new result file for exact configured secret values before sealing.
leaks=[]
for p in OUT.rglob('*'):
 if p.is_file():
  value=p.read_bytes()
  if any(s.encode() in value for s in SECRETS):leaks.append(p.relative_to(OUT).as_posix())
assert not leaks,leaks
save('evidence-safety-and-scope.json',{'status':'PASS','exactConfiguredSecretsFound':0,'scope':'Exact non-example .env credential/password/token/secret values with length >=8; not a universal PII or entropy proof.','previousFilesUnchanged':1222,'primaryContainerAndImageIdentitiesUnchanged':True,'productionSourceEdits':False,'previousFrozenEvidenceEdits':False,'newProviderCalls':0,'newGvisorBenchmarks':0,'phase6Started':False})
seal={p.relative_to(OUT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*') if p.is_file() and p.name!='result-artifact-hashes.json'}
save('result-artifact-hashes.json',{'algorithm':'sha256','excludesSelf':True,'files':seal})
print(f'Final report, 33-claim matrix, host chain, test summary and blocker assessment written; {len(seal)} Phase 5 artifacts sealed. No exact configured secret values found.')
