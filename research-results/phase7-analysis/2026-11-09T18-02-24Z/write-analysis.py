"""Author additive research synthesis only, using verified saved observations."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
P3='research-results/phase3-jev/resume-after-credit-2026-11-09';P4='research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched'
P5='research-results/phase5-final-validation/2026-11-09T15-24-05Z';P6='research-results/phase6-cleanup/2026-11-09T16-10-39Z'
def save(name,x):(OUT/name).write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def md(name,text):(OUT/name).write_text(text.strip()+'\n',encoding='utf-8')
def link(path):return f'[{path}](../../../{path})'
E='EMPIRICALLY DEMONSTRATED';C='CONFIGURATION VERIFIED';A='ARCHITECTURAL / DESIGN PROPERTY';N='NOT DEMONSTRATED'
facts=json.loads((OUT/'verified-key-results.json').read_text(encoding='utf-8'))
question='In welke mate kan een defense-in-depth architectuur met Deno-permissies, gVisor-isolatie, Jev-gebaseerde risicoanalyse en OpenTelemetry-observability risico\'s detecteren, isoleren en beperken bij het uitvoeren van dynamisch geladen, onbetrouwbare TypeScript-scripts die via een beperkte API interageren met een actieve hostapplicatie?'
md('research-question.md','# Onderzoeksvraag en begripsafbakening\n\n'+question+'\n\nBron: de expliciete Phase 7-opdracht van de gebruiker. In de repository zijn geen duidelijk vastgelegde actuele officiële deelvragen gevonden; zie research-question-search.json en subquestion-analysis.md.\n\n**Detecteren:** securityrelevant gedrag waarnemen en de beschikbare observaties interpreteren. **Isoleren:** uitvoerings- en bevoegdheidsgrenzen tussen script en omgeving. **Beperken:** toegestane effecten en resourcegebruik begrenzen. Een ontzegde actie is niet automatisch waargenomen, een observatie is niet automatisch een aanval, en een risicoklasse is geen autorisatiebeslissing.\n')

registerData=[
('S01','Security/evidence foundation; local checks and explicitly unavailable deployment', ['research-results/phase1/checks.json','research-results/phase1/input-validation-v2.json'],'Phase 1',E,'Local parsing/tests do not establish deployed enforcement; Phase 1B/5 supply that evidence.'),
('S02','Deployed Deno/audit/auth/DB validation',['research-results/phase1b/summary.json','research-results/phase1b/runtime.json'],'Phase 1B',E,'No independent exactly-once or broad security-effectiveness claim.'),
('S03','Runner-local capacity, startup recovery and bounded lifecycle',['research-results/phase2/summary.json','research-results/phase2/concurrency-runtime.json','research-results/phase2/startup-blocked.json','research-results/phase2/startup-recovered.json'],'Phase 2',E,'One runner, controlled workload and local engine, not public DoS resistance.'),
('S04','Final Docker control claims remain configuration-verified',['research-results/phase2/control-matrix.json','research-results/phase2/docker-controls.json',P5+'/security-claim-matrix.json'],'Phase 2 / authoritative Phase 5',C,'Supplementary Phase 2 controlled UID/EROFS/OOM subobservations do not upgrade CLM-04/05/06 or prove exploitation resistance.'),
('S05','Historical bounded OOM/resource observation',['research-results/phase2/concurrency-runtime.json'],'Phase 2',E,'Specific allocation exited137/OOMKilled; not general memory/availability protection and not new runsc pressure evidence.'),
('S06','Advisory failure independence / cleanup failure seam',['research-results/phase2/analysis-failure.json','research-results/phase2/failure-matrix/cleanup.json','research-results/phase2/runner-tests.txt','services/runner/tests/phase2_test.ts'],'Phase 2 / implementation mapping',E,'Injected failure and local unit seams, not a live DB/API crash experiment; shared admission assertion is separate from recorded local counter.'),
('S07','Frozen case definitions, language and HOL-008 blind spot',['fixtures/scenarios/manifest.json','fixtures/scenarios/holdout-manifest.json','research-results/risk-comparison/frozen-evidence-v1/HOL-008.json'],'Frozen corpus',E,'25 language=javascript records; researcher labels, related holdouts; not 25 independent TypeScript attacks.'),
('S08','Deterministic reference agreement', [P3+'/deterministic-replay.json',P5+'/deterministic-replay.json'],'Phases 3 / 5',E,'Replay agreement, not general detection accuracy or new Phase 7 classifier execution.'),
('S09','Jev per-case modes, repeats, reference agreement and confidence',[P3+'/analysis.json',P3+'/per-case-analysis.json',P3+'/result-primary-001-HOL-001-1.json'],'Phase 3',E,'125 raw records recomputed; concrete paths/hashes in analysis-source-hashes.json. No causal rationale inferred from local reason strings.'),
('S10','Pinned Jev model/policy/input and frozen order',[P3+'/manifest.json',P3+'/provenance-clarification.json'],'Phase 3',A,'Provenance, not detector effectiveness. Filename over-redaction is documented; policy hash/request identities retained.'),
('S11','Provider failure and total accounting',[P3+'/failure-log.json',P3+'/analysis.json'],'Phase 3',E,'One prior 403, not a classification; smoke/sensitivity excluded from primary rates.'),
('S12','Predefined presentation sensitivity',[P3+'/analysis.json','fixtures/scenarios/sensitivity.json'],'Phase 3',E,'15 calls on five selected cases; single call per presentation cannot separate presentation effects from stochastic variation.'),
('S13','Native experiment identity, image, balanced ordering',[P4+'/experiment-manifest.json',P4+'/environment.json'],'Phase 4',C,'One WSL2 host/release/platform. Requested Docker runtime is independently inspected, not cryptographically attested.'),
('S14','Measured durations and accounting',[P4+'/performance-summary.json',P4+'/analysis.json'],'Phase 4',E,'100 raw rows checked. End-to-end supervisor time, five repetitions; excludes later Paper confirmation.'),
('S15','Runtime compatibility and audit semantics',[P4+'/compatibility-matrix.json',P4+'/permission-evidence-comparison.json'],'Phase 4',E,'Expected timeouts count as compatible semantics, not normal completed scripts; native audit limitations persist under both runtimes.'),
('S16','Paper-confirmed runc and runsc DNS incompatibility',[P4+'/host-chat-results.json',P4+'/post-experiment-dns-diagnostic.json'],'Phase 4',E,'Direct-IP BusyBox diagnostic uses different image and harmless health route; it is not recovered Host SDK/Paper success.'),
('S17','Inspected runsc controls and bounded probe',[P4+'/resource-validation.json',P4+'/resource-probe.json'],'Phase 4',C,'Only non-root/tmpfs/timeout behavior probed; root write denial does not separate DAC from read-only enforcement.'),
('S18','Final E1–E8 outcomes and audit uncertainty',[P5+'/core-execution-matrix.json'],'Phase 5',E,'Normal Desktop/runc path, not simultaneous gVisor success for host-chat.'),
('S19','Final trusted host chain and server confirmation',[P5+'/executions/E8.json',P5+'/host-chain-evidence.json'],'Phase 5',E,'Delivery inferred from trusted completion transition; Paper acknowledgement observed later; no human player screen/exactly-once proof.'),
('S20','Admin/direct-route/forged-correlation regression',[P5+'/security-boundaries.json'],'Phase 5',E,'Trusted service harness forged mapping; credentials not placed in sandbox. One implemented host capability.'),
('S21','Final admission overflow and recovery',[P5+'/admission-regression.json'],'Phase 5',E,'Capacity2 within one runner; 429 is tested local overflow, not global distributed admission.'),
('S22','Actual collector receipt versus database evidence',[P5+'/otel-validation.json',P5+'/collector-debug.log'],'Phase 5',E,'API-reconstructed execution/sandbox.run/events, debug sink, no complete Paper span or durable trace storage.'),
('S23','One collector outage/restoration/recovery',[P5+'/collector-outage.json',P5+'/collector-restoration.json',P5+'/collector-recovery.json'],'Phase 5',E,'No whole-system fault tolerance, replay, zero latency impact or DB-outage guarantee.'),
('S24','Fresh-data reproduction',[P5+'/clean-setup.json'],'Phase 5',E,'Current working tree, caches/downloads, fresh data/credentials; not published HEAD or offline/no-cache build.'),
('S25','217 Phase 5 regression test outcomes',[P5+'/tests.json'],'Phase 5',E,'Test counts are not 217 security experiments or an efficacy score; guarded local skip retained.'),
('S26','Authoritative evidence classes and nonclaims',[P5+'/security-claim-matrix.json'],'Phase 5',A,'All 33 classes retained; NOT DEMONSTRATED is a limit, not positive evidence.'),
('S27','190 final relevant Phase 6 tests',[P6+'/test-summary.json',P6+'/resume-validation/docker-integration-tests.json'],'Phase 6',E,'Different selected suites from Phase 5; do not pool overlapping test totals as independent data.'),
('S28','Truthfulness audit / blockers / provenance limitation',[P6+'/security-claim-audit.json',P6+'/final-blocker-assessment.json',P6+'/validation-history.json'],'Phase 6',A,'Manual visual walkthrough unavailable; old Phase 6 exact logs overwritten by wrapper mistake, final reruns retained; no frozen Phase 1–5 changes.'),
('S29','Current system story and analysis boundaries',['docs/RESEARCH-STATUS.md','docs/ARCHITECTURE.md','docs/RESEARCH-BOUNDARIES.md'],'Phase 6 documentation',A,'Secondary interpretation; numerical conclusions use raw/saved experimental artifacts.'),
('S30','Official subquestion status and supplied main question',[],'Phase 7 user directive / repository search',N,'No official current subquestions found; themes are explicitly not formal questions.'),
('S31','gVisor userspace/application-kernel mediation',[],'Official architectural reference',A,'https://gvisor.dev/docs/architecture_guide/intro/ ; retrieved 2026-11-09. Design explanation only; no transfer of vendor efficacy claims into measured project evidence.'),
('S32','gVisor escape/exploit/security improvement', [P5+'/security-claim-matrix.json',P4+'/resource-validation.json'],'Explicit non-conclusion',N,'No escape/exploit evaluation; no percentage security improvement can be inferred.')]
register=[]
for sid,claim,paths,experiment,kind,limit in registerData:
 for p in paths:assert (ROOT/p).is_file(),p
 register.append({'sourceId':sid,'claim':claim,'artifacts':[{'path':p,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest()} for p in paths],'relevantExperiment':experiment,'evidenceClassification':kind,'limitation':limit})
save('source-register.json',{'authority':'Phase 5 33-claim matrix controls classifications; raw saved observations verify numbers. Source IDs recur throughout the synthesis.','entries':register,'completeReadArtifactHashes':'analysis-source-hashes.json','subquestionSearch':'research-question-search.json'})
md('source-register.md','# Analysis source register\n\nAll experimental numbers come from saved artifacts. The main question is supplied by the user; no formal current subquestions were found. Evidence classes do not change during synthesis. The 318 concrete artifacts read for verification are fingerprinted in analysis-source-hashes.json.\n\n| ID | Claim | Artifacts | Experiment | Class | Limit |\n|---|---|---|---|---|---|\n'+''.join(f"| {r['sourceId']} | {r['claim']} | {'; '.join(link(p['path']) for p in r['artifacts']) or 'See limitation/reference and research-question.md'} | {r['relevantExperiment']} | {r['evidenceClassification']} | {r['limitation']} |\n" for r in register))
md('external-architectural-reference.md','''# Architectural context only

The official [gVisor architecture guide](https://gvisor.dev/docs/architecture_guide/intro/)
describes a userspace application kernel that mediates workload system calls rather
than treating the host kernel as the workload's direct system-call implementation.
This supports the boundary explanation (S31), not a project finding about escape
prevention. Retrieved 2026-11-09. No vendor effectiveness claim is adopted as
experimental evidence. All project measurements remain the frozen Phase 4 records.
''')

layers=[
{'layer':'Deno permissions','risk':'Unnecessary file/environment/network/subprocess/FFI authority.','authority':'Trusted runner selects known runtime grants; script cannot supply raw allow flags.','enforces':'Scoped runtime operations; host-chat transport scope, not application authorization.','observes':'Native access/check events where available; supervisor can map some uncaught permission failures.','evidence':['S02','S07','S18'],'evidenceClass':[E],'claimIds':['CLM-01','CLM-02','CLM-03','CLM-17'],'limitation':'HOL-008 lacks a trusted subprocess observation; collection complete is not instrumentation completeness. Runtime restriction is not an independent OS kernel.','failure':'Absent/misconfigured Deno expands in-container authority; Docker/gateway may still constrain configured resources/effects. This removal is a design counterfactual, not an ablation experiment.'},
{'layer':'Docker/container','risk':'Host exposure, process/filesystem state sharing and uncontrolled resources.','authority':'Trusted engine/runner own image, mounts, user, network, cgroups and privileges.','enforces':'Container/process/network/filesystem/resource restrictions in the configured policy.','observes':'Runtime/control inspection and lifecycle outcomes; not a detection classifier.','evidence':['S04','S05','S13','S18'],'evidenceClass':[C],'claimIds':['CLM-04','CLM-05','CLM-06','CLM-07','CLM-08','CLM-09'],'limitation':'Authoritative final control claims remain configuration-verified; bounded historical probes are supplementary. runc shares a kernel; no exploit campaign.','failure':'Current Docker provider fails rather than silently executing on host/mock if supervisor/engine unavailable; a hypothetical Deno-only redesign lacks the independent container boundary.'},
{'layer':'gVisor/runsc','risk':'Direct workload interaction with host-kernel interfaces.','authority':'Trusted runtime selection on the native experimental engine; not client-selected.','enforces':'Additional application-kernel boundary by design; no measured escape effectiveness.','observes':'Trusted daemon/container identity, compatibility and duration; not a maliciousness detector.','evidence':['S13','S14','S15','S16','S17','S31','S32'],'evidenceClass':[A,E,C,N],'claimIds':['CLM-22','CLM-23','CLM-24','CLM-25'],'limitation':'9/10 workloads; host-chat DNS incompatible, WSL2/systrap/one release. Escape prevention untested.','failure':'Without runsc, normal runc path works but additional boundary is absent; no quantified security loss measured.'},
{'layer':'Host Gateway capability boundary','risk':'Confusing network reachability with authority over the active host.','authority':'Execution-scoped session, action allowlist, TTL and per-execution budget; separate admin listener.','enforces':'chat.broadcast authorization/message/budget before authenticated internal enqueue.','observes':'Requested/allowed/denied/queued call events with trusted correlation.','evidence':['S19','S20','S23'],'evidenceClass':[E,A],'claimIds':['CLM-13','CLM-14','CLM-15','CLM-16','CLM-29'],'limitation':'Only one meaningful sandbox capability; trusted services/secrets and Paper remain assumptions; confirmation is not exactly-once proof.','failure':'Intended host effect becomes unavailable on request-path failure. Bypassing the gateway would remove this boundary; bypass was rejected in tested routes, not experimentally enabled.'},
{'layer':'Lifecycle/admission/resources','risk':'Infinite work, excessive output/concurrency and ambiguous cleanup.','authority':'Trusted runner tracks active jobs and owns wall/capture/cleanup deadlines and fixed resource policy.','enforces':'Local capacity2, 429 overflow, timeout/output bounds and admission block on uncertain cleanup by design.','observes':'OOM/exit/timeout/truncation/cleanup status and admission health.','evidence':['S03','S05','S06','S18','S21'],'evidenceClass':[E,C,A],'claimIds':['CLM-10','CLM-11','CLM-12'],'limitation':'CPU/PID/privilege controls not all attack-tested; local process scope, residual host/control-plane DoS and operator recovery.','failure':'Unconfirmed cleanup deliberately reduces availability by blocking admission. Shared blocked-flag unit assertion is not the local counter in cleanup.json; no new live cleanup-failure injection.'},
{'layer':'PostgreSQL evidence/correlation','risk':'Loss of execution identity, host provenance and reconstructable project evidence.','authority':'Trusted persistent storage and queue-side origin/correlation mapping.','enforces':'Application data/queue constraints, not runtime permissions or security-event detection.','observes':'Persists supplied trusted observations/results and reconstructs timeline.','evidence':['S19','S20','S22','S24'],'evidenceClass':[E,A,N],'claimIds':['CLM-16','CLM-30','CLM-32'],'limitation':'Durable within demonstrated healthy DB writes, not tamper-proof/independent forensics; crash/outage finalization or HA not established.','failure':'API persistence/finalization/queueing may fail; retrospective evidence can be lost even if containment runs. This outage was not experimentally tested.'},
{'layer':'OpenTelemetry','risk':'Operationally fragmented timing/correlation across orchestration evidence.','authority':'No execution/capability authority; API emits reconstructed OTLP spans/events to collector.','enforces':'None of the security restrictions.','observes':'execution/sandbox.run, advisory and host events, counters and trace IDs.','evidence':['S22','S23'],'evidenceClass':[E],'claimIds':['CLM-18','CLM-19'],'limitation':'Debug output non-durable; no full independently instrumented Paper trace, no guaranteed complete telemetry or IDS.','failure':'Observed collector outage degraded export, not restrictions/host authorization/DB writes. No zero-delay, replay or whole-system resilience claim.'},
{'layer':'Deterministic advisory v1','risk':'Inconsistent human interpretation of predefined trusted evidence indicators.','authority':'Read evidence and produce LOW/REVIEW/HIGH metadata; cannot grant/deny execution authority.','enforces':'No permission, resource or capability controls.','observes':'Interprets recorded fields through transparent fixed rules; not hidden behavior.','evidence':['S06','S07','S08'],'evidenceClass':[E],'claimIds':['CLM-20','CLM-26'],'limitation':'24/25 controlled label agreement; known development cases and related holdouts, HOL-008 absence of trusted observations.','failure':'Assessment failed/unavailable/null classification may coexist with completed execution; evidence review remains necessary.'},
{'layer':'Jev advisory v2','risk':'Potentially inflexible interpretation of structured execution evidence; alternative advisory assessment.','authority':'External pinned Choice model/policy classifies sanitized evidence; no sandbox/host authority.','enforces':'No permission, resource or capability controls.','observes':'Second interpretation with model confidence, not additional runtime sensors.','evidence':['S09','S10','S11','S12'],'evidenceClass':[E,A],'claimIds':['CLM-21','CLM-26'],'limitation':'16/25 modal reference agreement, no Jev-only modal gain, two variable cases; short window/one model/policy/provider and no free-text rationale.','failure':'Provider/account/analysis failure affects advisory availability; deterministic option/containment remain separate. No automatic consensus benefit was evaluated.'}]
save('layer-contribution-matrix.json',layers)
md('layer-contribution-matrix.md','# Layer contributions and failure boundaries\n\nEach row separates enforcement from observations. Mixed evidence classes apply to different subclaims; the named Phase 5 claims retain their original classes.\n\n| Layer | Risk / authority | Enforces | Only observes | Sources / classes | Limit | If absent/fails |\n|---|---|---|---|---|---|---|\n'+''.join(f"| {x['layer']} | {x['risk']} {x['authority']} | {x['enforces']} | {x['observes']} | {', '.join(x['evidence'])}; {', '.join(x['evidenceClass'])}; {', '.join(x['claimIds'])} | {x['limitation']} | {x['failure']} |\n" for x in layers))

md('detection-analysis.md','''# Detection: observation and interpretation

## RESULTS

Deno audit and supervisor mapping supplied security-relevant observations in
controlled file/environment cases (S02, S18). E3 completed after a caught restricted
read while retaining its read observation and REVIEW assessment. Completion is
therefore not absence of restricted activity. Native access/check records are not
per-event allow/deny labels. The known fixture's behavior supplies the separate
denial context; arbitrary stdout is not trusted security evidence.

E6 timeout and E7 output truncation produced unavailable collection with missing
audit-frame reasons. Phase 4 W10 retained 200 observations after 500 intended reads
and marked partial collection (S15). Historical classifier records receive
legacy_unknown from the current transformation, not retroactive complete status.
Even complete frame collection does not establish exhaustive instrumentation.

HOL-008 is the concrete blind spot (S07–S09). The known caught-subprocess fixture
completed; its frozen trusted permission list is empty, failureCategory is null
and untrusted stdout mentions a caught NotCapable error. Neither analyzer receives
that stdout as a trusted feature. Deterministic classified LOW; Jev LOW in all five
primary calls, against researcher REVIEW. Enforcement and trusted observability
can diverge; the frozen record cannot safely turn script claims into detector facts.

PostgreSQL stored observations and identifiers; it did not generate a new detection
signal. OTel received reconstructed trace/span/events separately (S22); it is not
an IDS. Deterministic matched researcher labels 24/25; Jev modes 16/25 (S08–S09).

## INTERPRETATION

Detection is useful for predefined, actually recorded behavior and correlated
review, but incomplete for hidden/caught activity without trusted signals. A more
flexible classifier did not recover the missing subprocess observation. Jev's
second interpretation/confidence is descriptive information, not demonstrated
incremental detection or a validated reviewer benefit.

## NON-CONCLUSION

Do not infer 96% real-world attack detection, universal observability, intent,
maliciousness, calibrated probabilities, or detection merely because an operation
was blocked. Repetitions do not enlarge the 25-case scenario population. All 25
classifier records declare JavaScript; TypeScript execution has separate limited
runtime evidence, not an independent TypeScript classification evaluation.
''')
md('isolation-analysis.md','''# Isolation: separate boundaries, separate evidence

## RESULTS

Deno scoped runtime authority behaved as expected for filesystem/environment and
selected network/host-chat paths (S02, S18). Native permission restrictions are not
an independent kernel boundary. Docker supplied fresh execution environments,
configured user/rootfs/network/cgroup/privilege controls and observed bounded
lifecycle behavior (S03–S05). Final CLM-04–09 remain CONFIGURATION VERIFIED under
the authoritative matrix, including non-root, read-only root and memory ceiling.

Phase 2 supplementary controlled probes observed UID/GID1993, root-write EROFS,
writable tmpfs and a 256 MiB configuration with allocation exit137/OOMKilled=true.
Those bounded observations are real, but are not a reason to relabel the broader
final claims or claim arbitrary memory-abuse/exploitation resistance. PID64,
capability drop and no-new-privileges do not constitute tested escalation defenses.
Under runc the host kernel remains shared. No kernel/escape exploit was tested.

Runsc genuinely ran the same frozen image with trusted daemon/container attribution
(S13–S17). Nine of ten workload designs met expected semantics. Some controls were
inspected and selected UID/tmpfs/timeout behavior probed. Deno denials remained Deno
denials under both runtimes; they cannot be credited as gVisor security blocking.

## INTERPRETATION

The additional gVisor boundary has an architectural rationale (S31), but empirical
isolation evidence here establishes actual deployment and bounded behavior, not
its incremental resistance to compromise. Runtime identity evidence is operational
trusted-host attribution, not cryptographic attestation. Compatibility and overhead
measurements quantify integration consequences rather than security effectiveness.

## NON-CONCLUSION

No escape prevention, zero-day resistance, security-improvement percentage or
proof that every Docker setting resisted an attack. The complete normal host flow
passed under runc, not under all named layers simultaneously: runsc W8 failed DNS.
''')
md('risk-limitation-analysis.md','''# Risk limitation / containment

## RESULTS

Known Deno profiles bound runtime grants independently from assistant settings.
Host-chat permits narrow SDK transport; the gateway still validates its scoped
session, capability, input and budget before trusted enqueue (S19–S20). Public
direct commands returned403, unauthenticated internal enqueue401 and a forged
execution/trace mapping403 even from an authenticated trusted harness. Real E8
reached correlated Paper confirmation. Transport did not itself confer host authority.

The final runner regression admitted two jobs, rejected overflow429 and recovered
to active0 (S21). Timeout/truncation/cleanup behavior limited known execution/output
growth. Memory/PID/CPU/privilege controls were configured; Phase 2 additionally
observed a bounded OOM case (S05). These are local controls, not full host/control-
plane denial-of-service protection. Admission covers one runner, not multiple hosts.

Unconfirmed cleanup/create state blocks new admissions by design; saved local
failure-seam tests assert the shared blocked flag (S06). The standalone cleanup
artifact's separate local admission counter is not proof of live service state.
Startup blocked on a stale container and recovered after controlled removal (S03).
Failing closed can require operator intervention and reduce availability. Lost
session-creation acknowledgement uses finite TTL rather than a revocation guarantee.

## INTERPRETATION

Containment is the strongest supported aspect: authority/effect scope and selected
resource/lifecycle behavior were bounded. The gateway is distinct from Deno's
network decision and constrains host effect even for a host-enabled script.
Deterministic/Jev advice may inform review, but changes none of those grants or
limits. No classifier-based prevention effect was measured.

## NON-CONCLUSION

No universal DoS prevention, exactly-once delivery, complete resource isolation,
distributed admission or production availability. Trusted runner/engine/gateway/API/
DB/plugin compromise and generous policy remain residual risks.
''')
# Required filename is kept for the broad limitations analysis, distinct from risk containment.
md('limitation-analysis.md','''# Research limitations

1. **Corpus and language:** 25 researcher-designed classifier cases, 15 known
   development and 10 related holdout variants, not independently sampled attacks.
   All frozen classifier records are language=javascript. W2 demonstrates a small
   typed TypeScript task; it does not validate arbitrary TypeScript workloads or
   language-specific classification quality. Evidence is structured post-execution
   behavior, not source-code maliciousness analysis.
2. **Deno telemetry:** incomplete native observation, access/check rather than
   outcome bits, truncation/missing frames and HOL-008 blind spot. legacy_unknown
   remains for historical collection. Complete collection is not exhaustive coverage.
3. **Docker:** selected behavior probes and configuration inspection, no general
   exploitation assessment. runc shares the kernel. Preserve Phase 5 control classes;
   separate the narrower Phase 2 OS/OOM observations.
4. **gVisor:** one WSL2 host, one runsc release/platform (systrap), ten workloads,
   five repetitions per group, startup/lifecycle/audit cost in duration. Common host
   activity/cache and instrumentation influence timings. W8 DNS incompatible; no
   escape/exploit testing or quantified security gain.
5. **Jev:** one pinned model/provider/policy/transformation, small short-window
   corpus, five repeats, selected sensitivity cases. Confidence uncalibrated; Choice
   returns no free-text rationale. Local reason strings cannot establish model
   reasoning. Missing observations and reference-label subjectivity remain shared.
6. **OTel:** custom reconstructed tracing, non-durable debug exporter, no complete
   independent Paper span chain, no guaranteed telemetry delivery/replay or IDS.
7. **Host Gateway:** one meaningful sandbox capability, chat.broadcast. The pattern
   is demonstrated, not a general capability ecosystem or persistent event API.
8. **Reliability/trust:** one runner, in-memory sessions, privileged Docker access,
   trusted services/DB/plugin. PostgreSQL/API crash may prevent durable finalization;
   no high availability/distributed admission/independent tamper-proof forensics.
9. **Reproducibility:** fresh-data current-working-tree validation with caches and
   downloads, not published-HEAD/offline/no-cache reproduction. Source identity and
   public artifact availability remain Phase 8 work. No official current subquestions
   were found. Manual visual acceptance unavailable. Phase 6 log overwrite issue is
   disclosed; final reruns exist and frozen earlier experiments were unaffected.
10. **Causal interpretation:** no full factorial ablation of all defenses, no
    representative attack population and no measured amount of overall risk
    reduction. Collector outage and advisory injection test particular independence
    paths, not every single-layer failure. Descriptive conclusions do not supply
    inferential significance, confidence intervals or universal effectiveness.

These limits bound the answer; they are not concealed by code/doc changes or new
measurements. Future work is separate and not executed in this phase.
''')
md('defense-in-depth-analysis.md','''# Defense-in-depth interactions and failure independence

| Example | Enforcement / containment | Observation / interpretation | Result and limit |
|---|---|---|---|
| Restricted read | Deno denies outside scope; Docker supplies a separate configured filesystem/process boundary | Deno audit where present; PostgreSQL retains evidence; rules advise REVIEW; OTel correlates | E2 fails and E3 catches/completes with activity; does not prove Docker independently blocked that same read (S18) |
| Host broadcast | Deno grants transport/SDK only; gateway authorizes; trusted API/DB enqueue; SecureBridge performs bounded action | Call/command/trace correlation and later Paper acknowledgement; advisory afterward | E8 confirmed. Accepted means queued; delivery inferred from guarded transition, not independently timestamped (S19–S20) |
| Collector outage | Existing Deno/Docker/gateway restrictions remain | Export error visible; DB evidence persists; collector receipt later recovers | One controlled outage, not DB/API fault tolerance or zero overhead (S23) |
| Advisory failure | Existing execution grants and controls unchanged | Completed process with failed/null assessment | Injected analysis failure does not mean execution failed or authority expanded (S06) |
| Timeout/output | Runner stops/bounds job and cleans it up | Collection can become unavailable; classification uses recorded resource facts | E6/E7 containment succeeds while audit quality degrades (S18) |

## What combining layers adds

Different mechanisms address different failure modes: a network grant is still
subject to application authorization; a caught error can be reviewed after successful
process completion; resource/lifecycle limits bound execution without relying on
classifiers; collector availability is not required for permissions to apply.
Persistence and standard telemetry representations support retrospective correlation
rather than preventing host effects. gVisor is an optional researched boundary,
not a prerequisite for the observed normal host chain.

This supports a functional separation argument, not a measured percentage advantage
over a single-layer alternative. Only selected failures were injected/observed.
The trusted runner, engine, API, gateway, DB and plugin are common dependencies;
layers are not statistically independent or immune to shared misconfiguration.

## Single-layer absence/failure matrix

| Layer absent/fails | Supported consequence | Evidence status |
|---|---|---|
| Deno removed/misconfigured | Broader in-container runtime authority; configured Docker/gateway bounds may remain | Design counterfactual; not a Deno-removal experiment |
| Docker unavailable | Current Docker path reports failure; no silent host/mock fallback. Hypothetical standalone Deno lacks a separate container boundary | Design/implementation property, not new engine-outage result |
| gVisor absent | runc normal PoC functions; additional boundary absent | runc executions observed; security delta unmeasured |
| Gateway missing | Intended sandbox host call unavailable; exposing direct host authority would weaken design | Design inference; tested bypasses reject, no gateway-removal experiment |
| Lifecycle bound absent | Resources/concurrency would lack that particular configured bound | Design inference; observed controls tested, not removal |
| PostgreSQL/API fails | Evidence/finalization/queue operation may fail; no durable-outage guarantee | Known design limit, outage/HA not demonstrated |
| OTel collector down | Export degraded; tested enforcement/authorization/DB path intact | Empirical single outage |
| Jev unavailable | Advice unavailable; configured deterministic/containment paths remain | Actual normal deterministic path + preserved provider failure + advisory seam, not automatic fallback proof |
| Deterministic absent | Configured Jev could still advise; experiment gives no modal-agreement reason to prefer it alone | Configuration/design inference; no standalone-detector efficacy claim |

No absent-layer scenario above is silently counted as a new experiment.
''')
md('jev-analysis.md','''# Jev: technically successful, no incremental modal agreement gain

## RESULTS (S07–S12)

Pinned model typesafe-ai/jev-1.14.0, policy/input/transformation/analyzer2: 125 valid
primary outputs on 25 frozen cases, five rounds each. 23/25 cases unanimous;
121/125 outputs match their own case mode. The latter 96.8% measures repeatability,
not correctness. Individual reference agreement is 84/125; modal agreement16/25,
versus deterministic24/25. Both match16; deterministic only8; Jev only0; neither1.
HOL-008 is LOW for both, including all five Jev calls.

SCN-010 is REVIEW3/HIGH2 against HIGH reference; SCN-013 REVIEW3/LOW2 against LOW.
Each minority includes reference-matching calls, explaining the individual/modal
difference. Their model-reported confidence ranges0.26–0.31 (saved ten-call group),
not calibrated research uncertainty. Across the predefined sensitivity set,
four of five selected cases retain class under three presentations; SCN-010's
compact_notes gives HIGH while canonical/reordered give REVIEW. One call per
presentation cannot identify whether presentation itself caused that difference.

Accounting remains 3 smoke +125 primary +15 sensitivity =143 successful
classifications, plus one preserved account-verification HTTP403 =144 attempts,
zero automatic retries. Smoke/sensitivity/failure are outside primary denominators.
Primary measured request latency median230ms, range180–535ms; not a universal
provider SLA or direct total-runtime comparison.

## INTERPRETATION

The negative comparison is scientifically useful: technical integration succeeded
without yielding the expected possible agreement advantage. Transparency and stable
rule execution are practical benefits of the deterministic comparator on this
structured schema. Jev supplies another interpretation and confidence distribution,
but no incremental modal reference agreement or demonstrated decision-support benefit
was measured. High repeatability can coexist with systematic reference disagreement.

HOL-008 exposes an upstream evidence problem, not a benchmark of source-code
reasoning: the trusted input lacks the caught subprocess observation. Neither
model sees trusted proof of that action. Other disagreements may reflect mapping
of coarse evidence/risk policy or reference design; Choice provides no free-text
rationale, so the experiment cannot causally attribute individual decisions.
Reasons displayed locally are evidence summaries, not model explanations.

Provider/account dependence and output variability are operational costs. The
single403 is a preserved availability dependency, not failed model classification.
An advisory failure changes no authority; do not silently substitute a deterministic
answer under Jev's name. No ensemble, reviewer utility or calibrated confidence
policy was evaluated.

## NON-CONCLUSION

Not “AI risk analysis is useless,” not general model inferiority and not 16/25
real-world accuracy. Scope: one model/provider/policy/evidence transformation,
25 related researcher-designed JavaScript records in one short window. No new
policy, reference-label adjustment or targeted retry was made to repair the result.
''')
timingtable='| Workload | runc median ms | runsc median ms | Ratio | Interpretation |\n|---|---:|---:|---:|---|\n'+''.join(f"| {x['workloadId']} | {x['runcMedianMs']} | {x['runscMedianMs'] if x['runscMedianMs'] is not None else 'N/A'} | {format(x['medianRatio'],'.3f')+'x' if x['medianRatio'] is not None else 'N/A'} | {'Fixed timeout/lifecycle; exclude from useful-work range' if x['workloadId']=='W6' else 'Failed DNS durations excluded; no successful-task comparison' if x['workloadId']=='W8' else 'Five successful expected-semantic runs per runtime; supervisor duration'} |\n" for x in facts['gvisor']['timings'])
md('gvisor-analysis.md','''# gVisor trade-off

## RESULTS (S13–S17)

Native Ubuntu24.04.2/WSL2, Docker29.9.3, runsc release-20261102.0/systrap, same
project sandbox image. Ten workloads ×two runtimes ×five measured repetitions =100;
all operationally runtime-attested, zero infrastructure-invalid/rerun/unattempted
measured jobs. Nine workload designs meet expected semantics under both runtimes.
Measured process statuses:85 completed,10 expected timeout terminations,5 failed.
The95 expected-semantic successes do not mean95 normal process completions.

W8 runc confirmed5/5 in Paper; runsc0/5 failed hostname resolution before gateway
request/enqueue. The gateway remained healthy. A separate post-experiment BusyBox
direct-IP health probe supports DNS-specific incompatibility, not successful Host
SDK authorization/Paper execution. It is excluded from compatibility/timing figures.

'''+timingtable+'''
Metric: supervisor end-to-end duration including container setup, source transfer,
capture, inspection, removal and session revocation; excludes later Paper result.
W9 CPU median521→844ms (1.619962x); W10 I/O592→1548ms (2.614865x). Eight comparable
non-timeout workloads span about1.62–2.61x. The near1.0x W6 ratio reflects a fixed
deadline, not faster useful work. W8's failed DNS responses cannot be divided by
successful runc task times as a meaningful overhead ratio.

Deno observation targets/counts and collection limitations matched in the tested
matrix. W10 reaches the200-event cap/partial audit; W6/W7 remain unavailable.
Runsc resource inspection/probes do not turn a combined root-write denial into
isolated read-only-root proof. No escape/exploit experiment occurred.

## INTERPRETATION

gVisor's additional boundary is an architectural property, explained by the
[official architecture reference](https://gvisor.dev/docs/architecture_guide/intro/)
(S31), not a measured security-effectiveness gain. Most selected workloads worked,
but host-enabled integration was not transparent and supervisor costs were material.
The I/O example had a larger observed ratio/difference than the CPU example; startup,
audit and lifecycle are intertwined, so this is no general syscall-cost law.

For this PoC runsc is a technically viable optional/researched boundary for most
workloads, but not a drop-in default for the unchanged host-chat topology. Normal
runc demo success and separate runsc measurements must not be combined into a false
claim that the full named stack passed every end-to-end case simultaneously.

## NON-CONCLUSION

No universal slowdown percentage, no pure script-runtime estimate, no incremental
escape prevention/exploit resistance or quantified security improvement. Five
repetitions on one WSL2 host do not establish performance across native hosts,
platforms or releases. Intentional shutdown is not a regression. DNS was not fixed.
''')
md('otel-analysis.md','''# OpenTelemetry's actual contribution

## RESULTS (S22–S23)

Collector debug logs contain E1/E8 trace IDs with execution and sandbox.run spans,
execution IDs, advisory risk.classified and E8 host_api requested/allowed/queued
events. Counter names are observed. Receipt is verified independently from DB rows.
Paper confirmation arrives after E8 process completion and is not in its earlier
exported root span. PostgreSQL durably holds command/result/correlation and UI
timeline evidence; OTel supplies a separate standardized span/event export view.

During one collector outage, the script's restricted read remained denied,
unauthenticated gateway action rejected, authorized broadcast Paper-confirmed,
and DB evidence persisted. Export timeout was visible; collector restoration and
later receipt worked. Lost exports were not shown replayed.

## INTERPRETATION

Beyond PostgreSQL alone, OTel added trace/span/event structure, correlation visible
in the collector and operational timing/counter export for orchestration, host calls
and advice. This is a functional observability contribution; investigator time saved
or improved attack detection was not measured. The API reconstructs telemetry from
execution evidence, not independent sensors at every service. Consequently it
does not close upstream observation blind spots such as HOL-008.

The outage supports limited coupling between collector availability and tested
enforcement. It does not establish zero export latency impact, guaranteed delivery,
DB/API resilience or general fault tolerance.

## NON-CONCLUSION

No IDS, authorization, complete security telemetry, durable trace backend,
independent full Paper distributed trace, guaranteed detection or tamper-proof
forensic evidence. Shared trace IDs alone do not prove a span was exported.
''')
md('host-gateway-analysis.md','''# Host Gateway as an application security boundary

## RESULTS (S19–S20)

The path is sandbox SDK → capability listener → scoped session/capability/input/
budget validation → authenticated API enqueue → trusted DB command mapping →
SecureBridge → Paper confirmation. Deno's transport grant only permits reaching
the narrow listener; it does not authorize arbitrary host actions.

E8 queued then received successful broadcasted result and server_broadcast event,
with execution/trace/call/command correlation. Public direct enqueue returned403;
missing internal credential401; an authenticated trusted harness with nonexistent
execution/trace mapping403. Capability listener lacked the admin route, while
the sandbox's Deno network scope denied admin/API ports. No rejected probe enqueued
a command. Per-execution budget5 and TTL40s are design/configuration bounds, not a
global spam guarantee. Credentials and correlation originate in trusted services,
not sandbox-supplied metadata.

## INTERPRETATION

Application-level capability authorization is a distinct contribution from runtime
network restriction. A host-enabled script can have legitimate transport while
remaining unable to request arbitrary server methods or administer sessions. Trusted
correlation then distinguishes enqueue from later host effect; advice remains
post-execution metadata. This is a concrete defense-in-depth pattern for reducing
the scope of an exposed host effect without denying all useful interaction.

## NON-CONCLUSION

Only chat.broadcast is a meaningful sandbox capability. Backend status/player
views do not constitute script APIs. No persistent events, arbitrary Paper access,
general capability ecosystem, exactly-once guarantee, independent poll packet trace
or player-screen verification. Delivery is inferred through the guarded trusted
transition; confirmation is observed. Trust in runner/gateway/API/DB/plugin and
their secret handling remains. A per-execution quota does not cap aggregate spam
across unlimited requests; runner admission only bounds local concurrent execution.
''')

themes=[('Dynamic untrusted execution risks','Runtime authority, unintended host effects, resource growth and evidence gaps are different risks; the tested architecture covers specific examples, not arbitrary malicious intent.','S03,S07,S18,S20','Researcher-designed safe probes; no representative threat prevalence.'),('Permissions and container isolation','Scoped Deno restrictions work in tested profiles; Docker controls supply a separate configured boundary and bounded lifecycle.','S02,S04,S05,S18','Final configuration claims are not escape proof; no full ablation.'),('Limited host API','Network reachability does not confer host authority; one scoped broadcast reaches trusted Paper confirmation while bypass/admin/forgery probes reject.','S19,S20','One capability, trusted control plane, not a general scripting API.'),('Observability/evidence','DB preserves correlation, OTel exports reconstructed spans; collection uncertainty and HOL-008 limit detection.','S07,S22,S23','Non-durable debug sink, incomplete Paper spans, no IDS.'),('Advisory risk analysis','Deterministic24/25 versus Jev modal16/25; no Jev-only modal match and both miss HOL-008.','S08,S09,S12','One small JS evidence corpus; agreement is not maliciousness accuracy.'),('gVisor trade-offs','Real runsc works for9/10 workloads with extra boundary by design, workload-specific costs and W8 DNS incompatibility.','S13–S17,S31,S32','No security-effectiveness measurement; WSL2/systrap-only timings.')]
md('subquestion-analysis.md','# Current official subquestions\n\n**Documentation issue:** no clearly defined current official subquestions were located. `research-question-search.json` records the repository search scope and zero hits. The exact main question comes from the Phase 7 user directive. Archived implementation milestones are not treated as formal questions. No question list is silently invented.\n\nThe following are **analytical themes, not official subquestions**. Each connects a distinct contribution to detecteren/isoleren/beperken in the supplied main question.\n\n| Analytical theme | Answer | Evidence | Limitation | Main-question relation |\n|---|---|---|---|---|\n'+''.join(f'| {a} | {b} | {c} | {d} | Distinguishes observation, isolation and effect/resource limitation rather than treating every layer as enforcement. |\n' for a,b,c,d in themes)+'\nThis absence does not invalidate the artifact-based analysis, but mapping to an externally approved thesis proposal cannot be asserted without that document.\n')

risks=[
('Arbitrary filesystem read','Deno; configured Docker filesystem','Outside reads denied, scoped fixture allowed; caught activity observed','MITIGATED IN TESTED SCENARIO',E,'CLM-01/03; S02,S18','Other files/permissions, runtime vulnerabilities and authorized content remain.'),
('Environment/secret access','Deno env scope; controlled job environment','Demo variable scoped; app credential isolation regression passes','MITIGATED IN TESTED SCENARIO',E,'CLM-02/33; S18,S27','Host-chat intentionally carries one ephemeral scoped credential; no arbitrary future integration guarantee.'),
('Unauthorized network access','Deno net scope; separate Docker networks','Non-host none; host-chat direct admin/API attempts rejected','MITIGATED IN TESTED SCENARIO',E,'CLM-14; S20','No exhaustive egress/bypass campaign; configuration/trusted engine assumptions.'),
('Host application abuse','Gateway capability/input/budget; SecureBridge','Narrow broadcast succeeds; direct route/admin bypass rejects','PARTIALLY MITIGATED',E,'CLM-13/15/29; S19,S20','Broadcast itself can be nuisance; per-execution quota not global anti-spam; one capability.'),
('Forged host correlation','Authenticated gateway and DB mapping','Authenticated harness forged mapping403; no command enqueued','MITIGATED IN TESTED SCENARIO',E,'CLM-16; S20','Trusted service/DB compromise not covered; not cryptographic evidence.'),
('CPU exhaustion','Runner wall bound; configured CPU quota','Infinite loop terminated/cleaned up; quota inspected','PARTIALLY MITIGATED',E+' / '+C,'CLM-10; S03,S18','No host-wide DoS bound, quota effect not isolated in a pressure campaign.'),
('Memory exhaustion','Configured 256MiB memory/swap; local admission','Final ceiling inspected; separate Phase2 allocation OOM observed','CONFIGURATION-LEVEL MITIGATION',C,'CLM-06; S04,S05','Supplementary controlled OOM does not upgrade authoritative claim or protect whole host.'),
('PID/subprocess/system access','Deno run/FFI grants; PID64/drop caps/no-new-privileges','Selected run/FFI denials; HOL-008 run observation absent; privilege/PID settings inspected','PARTIALLY MITIGATED',E+' / '+C,'CLM-07/08/09/17; S07,S27','No fork exhaustion/escalation tests; no guaranteed audit coverage.'),
('Excessive output','Runner bounded capture','1MiB cap/truncation retained; audit can be unavailable','MITIGATED IN TESTED SCENARIO',E,'CLM-11/17; S18','Reduced forensic visibility; trusted control-plane/log/storage resource pressure remains.'),
('Excessive concurrency','Single runner admission','Two jobs; extra429; recovery active0','MITIGATED IN TESTED SCENARIO',E,'CLM-12; S21','Not distributed admission, unlimited sequential requests or public DoS protection.'),
('Incomplete telemetry','Explicit completeness; DB and best-effort OTel','Unavailable/partial/legacy_unknown retained; outage export error visible','OBSERVED ONLY',E,'CLM-17/18/19; S07,S15,S22,S23','Status improves honesty, not missing-event recovery or exhaustive detection.'),
('Container escape/kernel exploit','Docker; optional runsc design boundary','Runtime/control identity verified; no exploit/escape assessment','NOT DEMONSTRATED',N,'CLM-25; S32','Cannot quantify resistance or security improvement.'),
('Provider/advisory failure','Advisory separation; configured deterministic alternative','One provider403; injected failed/null assessment with completed execution','PARTIALLY MITIGATED',E,'CLM-21/26; S06,S11','Advice availability/cost/provider drift; not automatic fallback or improved detection.'),
('DB/API crash or evidence tampering','Trusted persistence and correlation','Healthy durable records observed; no crash/HA/tamper-proof evaluation','NOT DEMONSTRATED',N,'CLM-32; S24,S26','Finalization/queue/evidence may fail; privileged actor can affect trusted records.')]
save('risk-coverage-matrix.json',[dict(risk=a,layers=b,observedResult=c,mitigationStatus=d,evidenceLevel=e,sources=f,residualRisk=g) for a,b,c,d,e,f,g in risks])
md('risk-coverage-matrix.md','# Representative risk coverage\n\nStatuses apply to the tested scenario or explicitly inspected configuration; none means solved. Mixed evidence refers to distinct subclaims, not an upgraded Phase 5 class.\n\n| Risk | Layers | Observed | Status | Evidence | Sources | Residual |\n|---|---|---|---|---|---|---|\n'+''.join(f'| {a} | {b} | {c} | {d} | {e} | {f} | {g} |\n' for a,b,c,d,e,f,g in risks))
md('validity-threats.md','''# Validity threats

## Internal validity

WSL2/background/cache effects and trusted runtime-observer activity can affect
timings. Same image/policy and balanced alternating order reduce some differences,
but do not isolate every confounder. Duration includes startup/transfer/capture/
cleanup, not pure workload time; separate API instances/runtime groups remain an
environment factor. Preflights/warmups are excluded correctly, but no elaborate
causal or inferential performance claim follows. Audit instrumentation can miss
activity. DNS mechanism is supported by measured hostname failures plus a separate
different-image direct-IP diagnostic, not a same-image successful host retry.

## Construct validity

Researcher labels encode a controlled review policy, not objective maliciousness.
Rules were developed on the15 development cases; holdouts are related variants.
Agreement with labels is not real-world detection accuracy; repeatability is not
agreement; expected timeout semantics are not completed-process success. A risk
score is not permission authority. Runtime attribution/configuration presence and
successful denial are not exploit resistance. Collector receipt is not independent
complete tracing, nor is DB correlation a new sensor. All classifier records are
JavaScript despite the question's TypeScript framing; shared runtime does not prove
language-specific evaluation coverage.

## External validity

Small safe researcher-designed cases/workloads, one Paper host capability/host
application, sandbox Deno2.9.7, one WSL2 engine/runsc release/systrap configuration,
one pinned Jev model/provider/policy and short collection window. No arbitrary
malware corpus, kernel exploit test, broad TypeScript applications or production
multi-user workload. Generalization to other networks/platforms/capabilities or
models is limited. A repeated case is not a new independent scenario.

## Reliability and reproducibility

Frozen inputs/labels/policy, recorded failed attempts, raw repeats, trusted container
identity, preserved hash manifests and fresh-data setup strengthen auditability.
Offline verification recomputes counts/medians without model/runtime calls.
They are ordinary hashes/trusted-daemon observations, not signed independent
attestation or tamper-proof storage. Model/provider evolution can affect future
replication even with a requested version; only this recorded run is established.
Source remains an uncommitted working tree, artifacts partly local/ignored and
builds used caches/downloads. Manual visual acceptance unavailable. Phase6's logged
wrapper overwrite is disclosed with final reruns; it does not alter Phase3/4 raw
results. No formal current subquestion document was found, limiting thesis-plan
traceability rather than the numerical verification itself.

No p-values, inferential confidence intervals or security-improvement percentages
are manufactured. HIGH/MODERATE/LOW below concern confidence in a scoped research
conclusion, not Jev confidence or a calibrated probability.
''')

main='''# Antwoord op de hoofdonderzoeksvraag

## Detecteren

De architectuur maakt vooraf bepaalde securityrelevante handelingen zichtbaar
wanneer de runtime daarvoor betrouwbare observaties levert. In de gecontroleerde
tests bleven onder meer beperkte bestands- en omgevingsaanvragen zichtbaar, ook
wanneer een script een fout opving en daarna succesvol eindigde. PostgreSQL bewaart
de projectgegevens en correlatie; OpenTelemetry voegt een trace-/spanweergave en
collector-export toe. Geen van beide is op zichzelf een detectie-engine.

Die zichtbaarheid is onvolledig. Time-outs, uitvoertruncatie en auditlimieten
verminderen de beschikbare gegevens. HOL-008 toont bovendien een opgevangen
subprocespoging zonder overeenkomstige vertrouwde permission-observatie. Beide
classifiers geven daarvoor LOW tegenover het onderzoekerslabel REVIEW. Een complete
collectie betekent daarom niet dat alle handelingen zijn waargenomen.

De deterministische baseline stemt op24 van25 gecontroleerde gevallen overeen
met de onderzoekerslabels; Jev's modale klasse op16 van25. Jev was op23 gevallen
unaniem over vijf herhalingen, maar bood geen modaal geval waarin alleen Jev het
referentielabel herstelde. Binnen deze gegevensrepresentatie is dus geen aanvullende
modale overeenstemmingswinst aangetoond. Dit zijn geen percentages voor detectie
van willekeurige kwaadaardige scripts. Alle25 classifierrecords zijn als JavaScript
geregistreerd; een afzonderlijke beperkte TypeScript-workload bevestigt uitvoering,
niet een zelfstandige brede TypeScript-classificatiestudie. [S07–S09,S15,S18,S22]

## Isoleren

Deno beperkte de runtimebevoegdheden binnen de geteste profielen. Docker voegde
een afzonderlijke container-, proces- en bestandssysteemcontext en ingestelde
resourcegrenzen toe. De aanwezigheid van onder meer non-root, read-only root,
geheugen-/PID-limieten en privilege-instellingen is volgens de leidende Phase5-
matrix configuratiegeverifieerd; specifieke historische gedragsproeven worden
afzonderlijk vermeld. Dit is geen algemene toets van exploitbestendigheid.

gVisor voegt door zijn ontwerp een extra application-kernelgrens toe. De proef
toont echte runsc-uitvoering en compatibiliteit voor9 van10 workloads, met
meetbare operationele kosten. Zij toont geen escape-preventie of verhoogde
weerstand tegen kernel-exploits. De host-chatworkload faalde onder runsc door
naamresolutie; de volledige normale hostketen is onder runc bevestigd. Alle in
de onderzoeksvraag genoemde lagen zijn dus niet als één transparant geheel voor
ieder scenario gevalideerd. [S04,S13–S18,S31,S32]

## Beperken

Het sterkste empirische resultaat ligt in het begrenzen van concrete bevoegdheden,
hosteffecten en geselecteerd resourcegedrag. De Host Gateway scheidt netwerktoegang
van applicatieautorisatie: alleen een geldige uitvoeringsgebonden sessie kan de
smalle chat.broadcast-capability aanvragen. Admin- en directe omwegen en vervalste
correlatie werden afgewezen; een geautoriseerde aanvraag werd door Paper bevestigd.
De runner beperkte gelijktijdige uitvoering tot twee jobs, wees overloop af en
herstelde capaciteit. Time-out, begrensde uitvoer en cleanup beperkten de geteste
resourcegevallen. Dit is lokale beheersing, geen algemene DoS-bescherming.

Risicoanalyse verleent of ontneemt daarbij geen bevoegdheden. Bij een geteste
collectoruitval bleven beperkingen en hostautorisatie werken; een geïnjecteerde
analysefout kon naast succesvolle uitvoering bestaan. Die scheiding beperkt de
afhankelijkheid van advies en observability, maar bewijst geen herstelgarantie
voor een uitgevallen API of database. [S03,S06,S19–S23]

## Overkoepelend antwoord

De resultaten ondersteunen defense-in-depth voor gecontroleerde, beperkte
scriptuitvoering: verschillende lagen bewaken verschillende grenzen en koppelen
bruikbare observaties aan de uitvoering. De onderbouwing is het sterkst voor
gescopeerde bevoegdheden, de capabilitygrens en geselecteerde lifecyclecontroles.
Zij is beperkter voor volledige gedragsdetectie, de aanvullende classificatiewaarde
van Jev en de security-effectiviteit van kernelisolatie. Zonder volledige
laagverwijderingsproeven of representatieve aanvalspopulatie kan geen percentage
risicoreductie tegenover één enkele laag worden vastgesteld. Het oordeel geldt
voor de geteste PoC en expliciete grenzen, niet voor veilige willekeurige
TypeScript-uitvoering in productie. [S01–S32]
'''
# Separate words/numbers for readable Dutch without altering quoted evidence values.
for a,b in [('op24','op 24'),('op16','op 16'),('Alle25','Alle 25'),('alle25','alle 25'),('van25','van 25'),('op23','op 23'),('voor9','voor 9'),('van10','van 10'),('Phase5','Phase 5')]:main=main.replace(a,b)
md('main-research-question-answer.md',main)
conclusion='''# Concept academische conclusie

Dit onderzoek laat zien dat een defense-in-deptharchitectuur de bevoegdheden en
geselecteerde effecten van dynamisch uitgevoerde, onbetrouwbare scripts binnen een
gecontroleerde PoC kan begrenzen en daarbij bruikbare, maar onvolledige observaties
kan vastleggen. De sterkste bijdrage ligt in de combinatie van gescopeerde Deno-
permissies, Docker-uitvoeringsgrenzen, lokale lifecyclecontroles en een afzonderlijke
Host Gateway. Netwerktoegang verleende niet automatisch applicatiebevoegdheid;
geautoriseerde chatbroadcasts bereikten een door Paper bevestigde hostwerking,
terwijl geteste admin-, directe en correlatieomwegen werden afgewezen.

De detectiecomponent kent duidelijke grenzen. De deterministische baseline kwam
op24 van25 gecontroleerde gevallen overeen met de onderzoekerslabels. Jev bereikte
modaal16 van25, was op23 gevallen unaniem en herstelde geen enkel modaal geval dat
de baseline miste. Beide misten HOL-008, waarin een vertrouwde observatie ontbrak.
Deze uitkomst ondersteunt geen algemene uitspraak over AI-risicoanalyse: zij geldt
voor één model, beleid, representatie en kleine, als JavaScript geregistreerde
casusverzameling. De TypeScript-uitvoering is slechts afzonderlijk en beperkt
gedemonstreerd.

gVisor werkte voor9 van10 workloads, maar introduceerde in de WSL2-opstelling
workloadspecifieke supervisor-duurratio's van ongeveer1,62 tot2,61 voor vergelijkbare
niet-time-outtaken. De host-chatworkload faalde door DNS-compatibiliteit. De proef
onderbouwt runtime-integratie en operationele afwegingen, geen escape-preventie.
OpenTelemetry maakte gecorreleerde uitvoering zichtbaar in spans en events, terwijl
PostgreSQL de duurzame projectregistratie bleef. De debugexporter en ontbrekende
volledige Paper-span beperken de observabilitybijdrage; de geteste collectoruitval
verzwakte de bestaande beperkingen niet.

De onderzoeksvraag wordt daarmee ondersteund met belangrijke beperkingen:
gescopeerde bevoegdheden en effecten zijn overtuigender onderbouwd dan uitputtende
detectie of extra kernelbeveiliging. De kleine gerelateerde casusset, één host en
runtimeconfiguratie, deels alleen geïnspecteerde controles en ontbrekende exploit-
en crashproeven begrenzen de generaliseerbaarheid. Vervolgonderzoek kan zich richten
op rijkere vertrouwde observaties, onafhankelijkere casussen en de geconstateerde
netwerk-/tracebeperkingen. Dat vervolg is niet uitgevoerd en vormt geen voorwaarde
om de huidige negatieve en positieve bevindingen te rapporteren.
'''
for a,b in [('op24','op 24'),('op23','op 23'),('modaal16','modaal 16'),('van25','van 25'),('voor9','voor 9'),('van10','van 10'),('ongeveer1,62','ongeveer 1,62'),('tot2,61','tot 2,61')]:conclusion=conclusion.replace(a,b)
md('final-conclusion-draft.md',conclusion)

md('practical-recommendations.md','''# Engineering recommendations for a comparable bounded PoC

These priorities are scoped design guidance, not a universal production reference.

## ESSENTIAL

1. Deny by default, centrally select the smallest required runtime profile and
   keep user/AI context preferences separate from actual grants (S02,S18).
2. Use fresh execution environments, hard timeout/output bounds, bounded local
   admission and cleanup uncertainty that is explicit/fail-closed. Inspect resource
   settings rather than assuming them; do not equate the PoC with global DoS protection (S03–S05,S21).
3. Separate host transport from narrowly authorized application capabilities.
   Keep administration and privileged enqueue out of the sandbox surface (S19–S20).
4. Preserve trusted origin/correlation and distinguish queued acceptance from
   confirmed host effect. Report collection uncertainty and failed/null advice
   independently from execution outcome (S06,S19,S22).

## USEFUL

5. Keep a transparent, reproducible deterministic baseline and inspect disagreements.
   Prefer measured corpus agreement over vendor/general detector claims (S08–S09).
6. Retain durable project evidence and use standardized best-effort telemetry for
   operational correlation. Keep exporter failure outside authorization decisions;
   make limits visible instead of silently fabricating clean evidence (S22–S23).
7. Freeze case/policy/source identities, raw failures and descriptive metrics before
   interpreting outcomes. Treat hashes as audit support, not independent attestation (S10,S13).

## OPTIONAL / CONTEXT-DEPENDENT

8. Use runsc only after validating the actual image/network/host-capability topology
   and lifecycle costs. An extra boundary by design does not replace empirical
   compatibility or establish security effectiveness (S13–S17,S31–S32).
9. Use Jev or another model as separately configured advice only when the use case
   justifies provider dependence/cost/variability. This experiment supplies no modal
   agreement reason to replace the deterministic comparator (S09–S12).

Production end-user authorization, high availability and broader capability design
require their own requirements/evaluation; this analysis does not supply them.
''')
md('future-work.md','''# Prioritized future work — not performed

1. **Trusted observability coverage:** investigate missing subprocess observations
   illustrated by HOL-008 and explicitly retain completeness uncertainty. Validate
   what additional signals add rather than trusting script stdout. [S07,S15,S18]
2. **Independent evaluation scope:** define official thesis subquestions explicitly,
   add independently designed TypeScript cases/host interactions under a new future
   study identity, and preserve current rules/labels unchanged. Broader models/policies
   need independent data and comparison against transparent baselines. [S07–S12,S30]
3. **Host-network runtime compatibility:** assess a DNS-compatible gateway topology
   equally and explicitly for both runtimes; use a new frozen experiment, never replace
   W8's negative result. [S16]
4. **Durable and complete observability:** assess a durable trace backend and separately
   instrumented bridge/Paper acknowledgement chain; distinguish added observability
   from enforcement or evidence authenticity. [S22–S23]
5. **Runtime generalization:** repeat appropriately scoped workload comparisons on
   native Linux and larger representative workloads/configurations, separating startup
   and useful-work timing if possible. No exploit campaign is implied. [S13–S17]
6. **Broader capability pattern:** evaluate a small justified additional host capability
   with authorization/budget/provenance semantics before generalizing the API model. [S19–S20]
7. **Reliability and evidence trust:** evaluate durable execution finalization, API/DB
   crash behavior, stronger result tamper evidence and, only if requirements warrant,
   distributed admission. Keep this separate from the local collector-outage claim. [S03,S06,S24]

Phase 8 source/artifact publication is a separately authorized roadmap activity,
not started here. None of these future studies, features or packaging actions is
performed or silently used to strengthen the current conclusion.
''')

conclusions=[
('C01','Scoped Deno read/environment restrictions and caught-read observations work in the tested profiles.',['S02','S18'],[E],['CLM-01','CLM-02','CLM-03'],'HIGH','Known operations/profiles, not universal runtime or TypeScript security.'),
('C02','Collection status must constrain interpretation; HOL-008 shows an upstream trusted-observation blind spot.',['S07','S15','S18'],[E],['CLM-17'],'HIGH','Complete framing is not exhaustive behavior; stdout remains untrusted.'),
('C03','Final Docker control presence is verified, not broad exploit-resistance proof.',['S04','S05'],[C],['CLM-04','CLM-05','CLM-06','CLM-07','CLM-08','CLM-09'],'HIGH','Historical controlled OS/OOM subobservations remain narrower; do not upgrade general claims.'),
('C04','Local admission, timeout/output bounding and cleanup constrain tested resource behavior.',['S03','S21','S18'],[E],['CLM-10','CLM-11','CLM-12'],'HIGH','One runner/local cases; no global DoS/HA guarantee.'),
('C05','Capability authorization is distinct from transport: accepted host action confirms while tested bypass/admin/forgery reject.',['S19','S20'],[E],['CLM-13','CLM-14','CLM-15','CLM-16'],'HIGH','One capability, trusted services; queued versus confirmed/delivery inference separate.'),
('C06','DB evidence and OTel are complementary storage/correlation/export functions, not new detection/enforcement layers.',['S22','S23','S24'],[E,A],['CLM-18','CLM-19','CLM-32'],'HIGH','No durable debug trace backend, full independent Paper chain or DB-outage assurance.'),
('C07','Collector and advisory failures can remain separate from tested enforcement/outcome.',['S06','S23'],[E],['CLM-19','CLM-26'],'HIGH','Specific outage/injection, not every failure, zero latency cost or automatic fallback.'),
('C08','Deterministic v1 matches24/25 controlled researcher references, with sole miss HOL-008.',['S07','S08'],[E],['CLM-20'],'HIGH','Known development/related holdouts; not general real-world accuracy.'),
('C09','Jev has no demonstrated incremental modal reference-agreement advantage in this experiment.',['S09','S10','S11'],[E],['CLM-21'],'HIGH','16/25 versus24/25, Jev-only0; one model/policy/schema/corpus, no general AI ranking.'),
('C10','Jev repeats are mostly stable, but variability/confidence are not calibrated correctness or validated reviewer value.',['S09','S12'],[E],['CLM-21'],'MODERATE','23/25 unanimous, selected sensitivity and short window; causal decision rationale unavailable.'),
('C11','Real runsc supports9/10 controlled workloads; unchanged host-chat DNS is an integration incompatibility.',['S13','S15','S16'],[E],['CLM-22','CLM-24'],'HIGH','No successful full runsc/Paper host chain; diagnostic is not a primary replacement.'),
('C12','Runsc has larger measured supervisor duration for comparable non-timeout workloads in this setup.',['S14'],[E],['CLM-23'],'MODERATE','About1.62–2.61x; small repeated WSL2 workloads, not portable runtime-only overhead.'),
('C13','gVisor adds a distinct architectural boundary, but its incremental security effectiveness was not measured.',['S31','S32','S17'],[A,N],['CLM-25'],'MODERATE','Design rationale and control/compatibility evidence do not quantify resistance.'),
('C14','The claim that this experiment demonstrates gVisor escape prevention is unsupported.',['S32'],[N],['CLM-25'],'HIGH','HIGH concerns confidence that the positive claim is unsupported here; escape prevention itself remains NOT DEMONSTRATED.'),
('C15','Layer combination supports functional separation and bounded authority, not a quantified overall risk reduction versus one layer.',['S01','S03','S06','S18','S20','S23'],[E,A],['CLM-13','CLM-19','CLM-26','CLM-27'],'MODERATE','No full factorial ablation; shared trusted control-plane dependencies.'),
('C16','Fresh-data reproduction supports the working-tree setup, not published-HEAD/offline reproducibility.',['S24','S27','S28'],[E],['CLM-30'],'HIGH','Source/artifact publication, dependency availability and manual visual acceptance remain limited.'),
('C17','Broad TypeScript-specific classifier effectiveness is not established by the JavaScript-labeled frozen corpus.',['S07','S15'],[N],[],'HIGH','W2 supplies limited direct typed-runtime execution evidence; no language-specific attack population.'),
('C18','The main question is supported with important limitations for the controlled PoC, strongest in authority/effect containment.',['S01','S02','S03','S08','S09','S14','S19','S22','S23','S26'],[E,C,A,N],[],'MODERATE','Composite qualitative judgment; not every named layer succeeds simultaneously or contributes measured security gain.')]
save('evidence-to-conclusion-matrix.json',{'confidenceMeaning':'HIGH/MODERATE/LOW assess confidence in the scoped research conclusion, not Jev confidence or numeric probability. HIGH on an explicit non-conclusion means confidence in the stated evidence gap, never confidence that the unsupported positive security claim is true.','conclusions':[dict(conclusionId=a,statement=b,evidenceSources=c,evidenceTypes=d,phase5ClaimIds=e,confidence=f,limitation=g) for a,b,c,d,e,f,g in conclusions]})
md('evidence-to-conclusion-matrix.md','# Evidence-to-conclusion traceability\n\nConfidence is qualitative research judgment, not model confidence. Each source ID resolves to exact artifacts/hashes in source-register.json. Unsupported positive claims stay explicit.\n\n| ID | Statement | Sources / Phase5 claims | Evidence types | Confidence | Limit |\n|---|---|---|---|---|---|\n'+''.join(f"| {a} | {b} | {', '.join(c)}; {', '.join(e)} | {', '.join(d)} | {f} | {g} |\n" for a,b,c,d,e,f,g in conclusions))
md('results-interpretation-nonconclusions.md','''# Discipline of interpretation

| RESULTS | INTERPRETATION | NON-CONCLUSION |
|---|---|---|
| Deno denies known restricted operations; some caught activity remains observed | Scoped authority and some review evidence work together | Every denial is observed; all behavior detected |
| Final Docker controls inspected; bounded Phase2 UID/root-write/OOM probes | Concrete policy plus selected behavior evidence | Every setting attack-tested or escape prevention |
| Jev modes16/25; baseline24/25; Jev-only0 | No incremental modal label-agreement gain in this corpus | AI analysis generally inferior/useless |
| 23/25 Jev cases unanimous; own-mode121/125 | High descriptive repeatability can coexist with disagreement | 96.8% correct or calibrated confidence |
| runsc9/10 compatible; W8 DNS failure; durations higher for comparable workloads | Optional boundary has practical integration/cost trade-offs | DNS failure is intentional security denial; universal slowdown/security gain |
| Collector receives reconstructed spans; outage keeps tested restrictions | Observability export is separable from enforcement | OTel detects attacks, stores all durable evidence or whole-system HA |
| E8 reaches trusted Paper confirmation; forged route mapping rejects | Transport and application authority are distinct | One capability validates all host APIs or exactly-once delivery |
| All25 classifier records declare JavaScript; W2 is typed TypeScript | Language-specific evidence is narrower than the main question's broad framing | Dedicated TypeScript classifier study |
''')
checks=[
('Detection versus enforcement','Passed','Deno denial does not imply an audit event; HOL-008 and collection uncertainty remain.'),
('Credit to correct layer','Passed','Deno denials under runsc are not credited to gVisor escape blocking.'),
('Labels versus ground truth','Passed','Researcher reference labels, known development cases and related holdouts are explicit.'),
('Jev scope','Passed','One model/policy/schema/corpus; no general AI inferiority or validated ensemble/reviewer benefit.'),
('Timing scope','Passed','Supervisor/end-to-end WSL2 metric, W6/W8 exclusions and five repeats explicit.'),
('OTel versus durable evidence','Passed','PostgreSQL holds project evidence; debug exporter non-durable; no full Paper spans.'),
('Configuration versus exploits','Passed','Original Phase5 control classes retained; historical probes separate; escape prevention unsupported.'),
('Host capability scope','Passed','Only chat.broadcast; no general-purpose/persistent-event API or global anti-spam claim.'),
('Negative results','Passed','HOL-008, Jev disagreement/variability, runsc DNS/overhead and failure records retained.'),
('Strong conclusion traceability','Passed','C01–C18 map to registered sources and limits; no numeric security-effect estimate.'),
('TypeScript framing','Passed','25 JavaScript-labeled classifier records and limited typed-runtime evidence disclosed.'),
('Official subquestions','Passed with limitation','No official current list found; themes labeled analytical, not invented formal questions.'),
('Combined system/causality','Passed with limitation','Normal runc path and separate runsc failure distinguished; no full layer-ablation claim.'),
('Failure-evidence provenance','Passed','Shared admission unit assertion distinguished from local artifact counter; DNS health diagnostic separate from same-image host success.')]
save('self-critique.json',[dict(question=a,status=b,resolution=c) for a,b,c in checks])
md('self-critique.md','# Self-critique before finalization\n\n'+''.join(f'- **{a} — {b}:** {c}\n' for a,b,c in checks))
save('research-question-verdict.json',{'verdict':'SUPPORTED WITH IMPORTANT LIMITATIONS','refersTo':'Controlled-PoC ability to constrain scoped authority/host effects and selected resource behavior while correlating available evidence.','doesNotReferTo':['Exhaustive risk detection','Incremental Jev security/detection effectiveness','Empirically established gVisor escape prevention','Successful transparent combined runsc/host-chat deployment','General arbitrary TypeScript/production security','Measured percentage advantage over a single layer'],'basis':['C01','C02','C04','C05','C06','C07','C09','C11','C12','C13','C15','C17','C18'],'confidence':'MODERATE','phase7Status':'COMPLETE WITH LIMITATIONS','officialSubquestions':'Not located; documentation/analytical mapping limitation disclosed.'})
print(json.dumps({'sourceRegisterEntries':len(register),'layers':len(layers),'risks':len(risks),'conclusions':len(conclusions),'verdict':'SUPPORTED WITH IMPORTANT LIMITATIONS'}))
