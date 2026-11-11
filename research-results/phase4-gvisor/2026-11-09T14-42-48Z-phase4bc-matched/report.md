# Phase 4 result

**COMPLETE WITH LIMITATIONS**

# Executive summary

- The frozen comparison completed: 10 runc functional preflights, 20 warm-up attempts and all 100 measured executions, with no reruns or infrastructure-invalid/unattested jobs.
- Nine workloads performed their defined task under both runtimes in all five measured repetitions. W6's intended outcome was controlled timeout, not normal completion.
- W8 host-chat was incompatible under unchanged runsc networking: 5/5 measured runc calls reached Paper confirmation; 0/5 runsc calls reached the gateway because hostname lookup failed.
- All six W8 negative outcomes, including its warm-up, remain recorded. A separate post-experiment direct-IP health check reached the gateway, supporting DNS rather than general routing as the failure.
- For successful non-timeout workloads with comparable results, runsc median supervisor-duration ratios ranged from 1.62x (W9 CPU) to 2.61x (W10 allowed I/O) in this WSL2 setup. W8 has no successful-run overhead ratio.
- Deno permission observations matched between runtimes. Both retained the same audit limitations for timeout, output truncation and the audit-event cap.
- Selected runsc controls were inspected; non-root identity, writable tmpfs and timeout/cleanup were behaviorally checked. This did not test escape prevention or general security effectiveness.
- Prior research and Docker Desktop were preserved. No Phase 5 work, commit or push occurred.

# 1. Frozen environment/configuration

Manifest frozen at **2026-11-09T14:57:09.830532+00:00**, after all ten runc preflights and before the first warm-up. Manifest, environment, source and workload hashes are retained and rechecked.

| Item | Frozen value |
|---|---|
| Linux | Ubuntu 24.04.2 LTS, amd64, WSL 2.5.7.0 |
| Kernel | `6.6.87.1-microsoft-standard-WSL2` |
| CPU | AMD Ryzen 7 3800X 8-Core Processor; 16 visible logical CPUs |
| Memory | Approximately 15.6 GiB visible to WSL; exact total/available snapshot and detectable WSL overrides in environment.json |
| Native Docker / containerd / runc | 29.9.3 / 2.4.2 / 1.5.2 |
| runsc | release-20261102.0, explicit systrap; Docker default remains runc |
| Native engine ID | `a82ddab9-8f47-4bd6-bc17-3bb5d18d08b1` |
| Sandbox image ID | `sha256:90ab4f290356c3b4d307775656227f1b4a2fff68bf64ae0082705d7d98f82efc` |
| Deno / effective UID:GID | 2.9.7 / 1993:1993 |
| CPU / memory+swap / PIDs | 0.5 CPU / 256 MiB ceiling / 64 |
| Filesystems | Read-only root; /workspace tmpfs 64 MiB; /tmp tmpfs 16 MiB |
| Privileges | Non-root deno, cap-drop ALL, no-new-privileges |
| Wall / output / audit limits | 10,000 ms; 1,048,576 bytes; 200 events / 65,536 audit bytes |
| Admission / experiment concurrency | Capacity 2 per trusted runner; globally one experiment job at a time |
| Profiles | none, read-fixture, env-demo, host-chat |
| Non-host / host networking | none / internal phase4bc-sandbox-host bridge |
| Gateway | host-gateway:3200 capability listener; host-gateway-admin:3201 admin listener on application network only |
| Host policy | chat.broadcast only; budget 5, maximum length 256, session TTL 40 seconds |
| Paper / SecureBridge | 1.21.1-133-3cb8529 (MC: 1.21.1) / 0.1.0 |
| Native published ports | Loopback API 23000/23001 and Paper 25575; no gateway/admin exposure |

Both API/runner pairs remained running, using the same respective image IDs and shared database/gateway/Paper/collector. Their trusted configuration fixed runtime selection and the API-to-runner target; clients gained no runtime override. The metric is supervisor duration, not API-instance response time. The Desktop project continued independently on its existing engine/ports.

The initial experiment override had an inheritance error and a later pre-measurement WSL service interruption. Both were preserved and corrected before preflights/freeze. A bounded keepalive process prevented WSL idle shutdown during the comparison. No WSL/security settings were changed. Image builds, pulls and Paper initialization were completed before measurements; trusted SDK/import map dependencies were local. Job DENO_DIR was fresh tmpfs, equally for both runtimes. Warm-ups do not eliminate all OS/cache/background effects.

# 2. Workload definitions

The exact scripts are stored under workloads/. Hashes below are full SHA-256 values. The same bytes/profile were submitted for every runtime pair.

| ID | Purpose / exact operation | Profile | SHA-256 |
|---|---|---|---|

| W1 | Basic JavaScript | none | `c6356ce40f239d398c5eedac96117b2d8df213eb5ef0d3b5f2ad9c13aa95d5dd` |

| W2 | Basic TypeScript | none | `540e1828ff71fcf39d29095818b394291d5f291bc528b322f9c43e1cb94824ff` |

| W3 | Scoped filesystem | read-fixture | `07e36d8e53879442b2c60f3cfb94203a651e1d4536da338ac96009600e4315c8` |

| W4 | Scoped environment | env-demo | `ef47856d2a5ea8690b8fcca488c5abdd8c8fd4578d9f2eb0bf5fd7ffc7699030` |

| W5 | Caught restricted read | none | `4f1337c8486b39594bb10f7d9bebf78bfe73746e98780dded9a8b8c7f7a17464` |

| W6 | Timeout | none | `4054a22eaf38790ab3298e4780705596b578817bea361ed2aaa50ed36ea374cf` |

| W7 | Output capture limit | none | `f032e2d8436cc1a42ab3642945ff148f7eeb0858b9a1bcd971c88b0739ec56c2` |

| W8 | Host chat | host-chat | `9e77a137f93097ff0f6f54c6c25777aedfcfea2ad502e266770cf565f87b34d7` |

| W9 | CPU-heavier | none | `22ed9140300ff41f084234f4fa1964650889e75c3a37d13e00a3d11dc407a67d` |

| W10 | Allowed I/O-heavier | read-fixture | `b0314e03dda14da3ac3738f2016a4e432e072208a795d32d53d27b5f1308b18c` |

W1 sums 0 through 99,999. W2 is a typed 6x7 calculation. W3 reads the permitted fixture and catches an outside-read denial. W4 reads the demo variable and catches HOME denial. W5 completes after a caught restricted read. W6 is the existing infinite loop. W7 is the existing controlled 400x4096-character output fixture. W8 uses the real Host SDK and the identical message `Phase 4 runtime comparison`; trusted IDs provide correlation. W9 advances a deterministic 32-bit recurrence 30,000,000 times. W10 reads the allowed fixture 500 times. W10 intentionally exceeds the unchanged 200-event audit cap.

# 3. Execution accounting

| Stage | Planned | Completed attempts | Expected task semantics | Unexpected task failures |
|---|---:|---:|---:|---:|
| Runc functional preflight | 10 | 10 | 10 | 0 |
| Warm-ups | 20 | 20 | 19 | 1 W8/runsc DNS failure |
| Primary measured | 100 | 100 | 95 | 5 W8/runsc DNS failures |

The measured process outcomes were **85 completed, 10 intentionally terminated by timeout, and 5 failed**. The ten expected W6 timeouts are included in the 95 successful *task-semantics* outcomes, not misrepresented as normally completed scripts. Infrastructure-invalid jobs: **0**. Unattested jobs: **0**. Reruns: **0**. Unattempted measured jobs: **0**.

Warm-ups and preflights are excluded from primary latency statistics. Two post-experiment probes are analytically separate. Warm-up runtime order was runc then runsc per workload; measured odd rounds used runc then runsc, even rounds reversed it. Actual sequence is recorded for all 120 warm-up/measured attempts. Five repetitions of one workload are not five independent workload designs.

# 4. Runtime evidence

All **130** functional-preflight/warm-up/measured jobs have trusted runtime attribution. The native host collector continuously watched Docker events, selected the sole serialized poc-exec container, inspected allowlisted runtime/image/control fields before cleanup and retained start/destroy events. Each record binds execution ID, source hash, profile, container/image identity, requested and inspected runtime, and native engine identity. runsc version/configuration is frozen in the manifest/environment. A missing/mismatched runtime record would have made the run invalid and stopped the batch under the predeclared zero-rerun rule.

The collector is outside the untrusted job; stdout is not runtime proof. This is operational host/daemon evidence, not cryptographic attestation. Collection adds host-side observation activity equally to both groups and may contribute timing noise. No raw container environment or capability-token value was saved.

# 5. Compatibility matrix

Definitions were frozen before warm-ups: COMPATIBLE means expected task semantics in all five runs under both runtimes; an observed material evidence/outcome difference can qualify as COMPATIBLE WITH OBSERVED DIFFERENCE; functional inability under the frozen policy is INCOMPATIBLE; unrelated invalid infrastructure is INCONCLUSIVE. Timing alone does not make a workload incompatible.

| Workload | runc | runsc | Verdict | Difference |
|---|---|---|---|---|

| W1 | 5/5 expected outcomes | 5/5 expected outcomes | COMPATIBLE | Same task/evidence semantics; timing reported separately |

| W2 | 5/5 expected outcomes | 5/5 expected outcomes | COMPATIBLE | Same task/evidence semantics; timing reported separately |

| W3 | 5/5 expected outcomes | 5/5 expected outcomes | COMPATIBLE | Same task/evidence semantics; timing reported separately |

| W4 | 5/5 expected outcomes | 5/5 expected outcomes | COMPATIBLE | Same task/evidence semantics; timing reported separately |

| W5 | 5/5 expected outcomes | 5/5 expected outcomes | COMPATIBLE | Same task/evidence semantics; timing reported separately |

| W6 | 5/5 expected outcomes | 5/5 expected outcomes | COMPATIBLE | Expected timeout and cleanup in both |

| W7 | 5/5 expected outcomes | 5/5 expected outcomes | COMPATIBLE | Same task/evidence semantics; timing reported separately |

| W8 | 5/5 expected outcomes | 0/5 expected outcomes | INCOMPATIBLE | DNS failure before gateway; no confirmation |

| W9 | 5/5 expected outcomes | 5/5 expected outcomes | COMPATIBLE | Same task/evidence semantics; timing reported separately |

| W10 | 5/5 expected outcomes | 5/5 expected outcomes | COMPATIBLE | Same task/evidence semantics; timing reported separately |

# 6. Host-chat / DNS result

**Runc: 5/5 measured calls traversed REQUESTED -> AUTHORIZED -> QUEUED -> DELIVERED -> CONFIRMED.** The preflight and warm-up also reached real Paper confirmation. Stored command results report success/broadcasted from SecureBridge; execution, trace, call and command IDs are retained. Delivery is also supported by the guarded database transition: a completed command must first have been claimed/delivered. A separate delivery timestamp is not retained, and enqueue alone was never treated as success.

**Runsc: 0/5 confirmed.** The script attempted the unchanged `http://host-gateway:3200/v1/capabilities/chat.broadcast` endpoint on phase4bc-sandbox-host. Each measured stderr contains DNS lookup failure / temporary failure in name resolution. No gateway request, authorization, command queue entry, call ID or command ID was observed. Gateway health was OK and Paper remained connected. These are network/runtime compatibility failures, not evidence that gVisor intentionally blocked a capability for security.

Measured runc queue-to-confirmation duration: n=5, min 1059.007 ms, median 1572.660 ms, mean 1557.973 ms, max 2037.970 ms. This wall-timestamp metric is separate from supervisor duration and starts at queue insertion, not at script invocation.

# 7. Performance comparison

Metric: **runner/supervisor end-to-end duration, milliseconds**. It includes container create, attached startup/source transfer, capture, inspection, removal and session revocation. It excludes API validation/queue/polling and later Paper confirmation. Startup-only and pure JavaScript duration are unavailable separately.

Successful/expected-semantic measured results only; n=5 per runtime except runsc W8, which has no successful comparable result.

| Workload | runc median | runsc median | Median difference | Ratio | Difference % |
|---|---:|---:|---:|---:|---:|

| W1 | 429 | 799 | 370 | 1.862x | +86.2% |

| W2 | 426 | 777 | 351 | 1.824x | +82.4% |

| W3 | 451 | 781 | 330 | 1.732x | +73.2% |

| W4 | 434 | 798 | 364 | 1.839x | +83.9% |

| W5 | 477 | 801 | 324 | 1.679x | +67.9% |

| W6 | 10289 | 10257 | -32 | 0.997x | -0.3% |

| W7 | 483 | 1113 | 630 | 2.304x | +130.4% |

| W8 | 748 | N/A | N/A | N/A | N/A |

| W9 | 521 | 844 | 323 | 1.620x | +62.0% |

| W10 | 592 | 1548 | 956 | 2.615x | +161.5% |

Full measured distributions (min / median / mean / max, ms):

| Workload | runc n | runc min / median / mean / max | runsc n | runsc min / median / mean / max |
|---|---:|---|---:|---|

| W1 | 5 | 408 / 429 / 443.8 / 484 | 5 | 763 / 799 / 797.6 / 825 |

| W2 | 5 | 391 / 426 / 423.4 / 441 | 5 | 772 / 777 / 792.4 / 859 |

| W3 | 5 | 436 / 451 / 459 / 499 | 5 | 723 / 781 / 786.4 / 854 |

| W4 | 5 | 389 / 434 / 420.4 / 448 | 5 | 732 / 798 / 806 / 884 |

| W5 | 5 | 414 / 477 / 463.4 / 508 | 5 | 747 / 801 / 838 / 1045 |

| W6 | 5 | 10266 / 10289 / 10284.6 / 10297 | 5 | 10221 / 10257 / 10251.8 / 10270 |

| W7 | 5 | 441 / 483 / 515.2 / 655 | 5 | 980 / 1113 / 1115.6 / 1272 |

| W8 | 5 | 734 / 748 / 781 / 893 | 0 | N/A / N/A / N/A / N/A |

| W9 | 5 | 475 / 521 / 517.6 / 550 | 5 | 809 / 844 / 849.2 / 885 |

| W10 | 5 | 548 / 592 / 582.4 / 605 | 5 | 1493 / 1548 / 1549 / 1586 |

W6's 0.997x ratio describes the same fixed wall limit and cleanup, not faster computation under runsc. Excluding that timeout control and incompatible W8, observed workload-specific ratios range from 1.62x to 2.61x. Tiny workloads include considerable startup/supervisor cost. No universal gVisor slowdown is inferred.

Runsc W8 failed-response durations remain separate: n=5, min 1130 ms, median 1202 ms, mean 1233.4 ms, max 1444 ms. Comparing those failed-task times with successful runc broadcast times as an overhead ratio would be misleading.

# 8. CPU vs I/O observation

W9 CPU: 521 -> 844 ms median, **1.620x** (+62.0%). W10 allowed I/O: 592 -> 1548 ms, **2.615x** (+161.5%). The repeated-read workload showed a larger relative/absolute difference in this setup. This does not isolate syscall overhead: both include startup, audit work, source transfer and supervisor lifecycle. W9 also remains partly startup-dominated. Two controlled examples do not establish a general CPU-vs-I/O law.

# 9. Permission/evidence comparison

| Workload | Both-runtime observation / completeness |
|---|---|
| W3 | Allowed fixture read and outside Deno denial; 2 observations, audit complete |
| W4 | Allowed demo variable and HOME denial; 2 observations, audit complete |
| W5 | Script completed with handled denial; 1 /etc/hosts read observation, audit complete |
| W6 | Expected timeout; audit unavailable: job_wall_timeout, missing_audit_frame |
| W7 | Expected output truncation; audit unavailable: missing_audit_frame, output_capture_or_return_limit |
| W8 | 4 permission observations and complete audit in both; transport success differed |
| W10 | 500 intended reads; retained observation count capped at 200, audit partial: audit_limit |

These patterns were consistent across all five repetitions per runtime. Permission access events alone are not per-event allow/deny outcomes; controlled stdout and expected caught errors establish the workload semantics. The Deno layer denied the restricted operations. The results do not independently demonstrate gVisor security blocking. No runtime-specific audit degradation was found in this matrix, but common completeness gaps remain important.

# 10. Runsc resource controls

| Control | Configuration verified? | Behavior validated? | Result |
|---|---|---|---|

| non-root | Yes | Yes | BEHAVIORALLY VALIDATED UNDER RUNSC |

| read-only root | Yes | No | CONFIGURATION VERIFIED UNDER RUNSC |

| timeout and cleanup | Yes | Yes | BEHAVIORALLY VALIDATED UNDER RUNSC |

| tmpfs workspace | Yes | Yes | BEHAVIORALLY VALIDATED UNDER RUNSC |

| 256 MiB memory/swap ceiling | Yes | No | CONFIGURATION VERIFIED UNDER RUNSC |

| 64 PID limit | Yes | No | CONFIGURATION VERIFIED UNDER RUNSC |

| 0.5 CPU quota | Yes | No | CONFIGURATION VERIFIED UNDER RUNSC |

| cap-drop ALL | Yes | No | CONFIGURATION VERIFIED UNDER RUNSC |

| no-new-privileges | Yes | No | CONFIGURATION VERIFIED UNDER RUNSC |

| profile-specific Docker network | Yes | No | CONFIGURATION VERIFIED UNDER RUNSC |

The separate trusted OS probe observed UID/GID **1993/1993** and a writable tmpfs workspace. Its root-path write failed with **Permission denied**; this does not independently distinguish non-root DAC denial from read-only enforcement, so read-only root remains configuration-verified only. Memory/PID/CPU pressure enforcement was not independently tested. W6 behavior validates supervisor timeout and cleanup under runsc, not a gVisor-specific escape defense.

The resource helper initially assumed UID 1000 in a derived boolean. The raw output and pre-freeze environment both showed 1993; offline analysis corrected that interpretation using the recorded nonzero UID without rerunning or changing raw evidence. `analysis-corrections.json` documents this explicitly.

# 11. Failures and incompatibilities

- **Six W8/runsc DNS task failures:** one warm-up and five measured outcomes, all retained with stderr, health and missing downstream host steps. Zero runc W8 failures.
- **Expected timeout outcomes:** one runc preflight, two warm-ups and ten measured W6 executions; retained as intended termination semantics, not discarded process failures.
- **Common evidence limits:** W7 lost audit framing after output capture limits; W10 reached the audit-event cap; W6 lacked a final audit frame. These are recorded limitations rather than invented complete audits.
- **Pre-measurement setup issues:** initial new Compose inheritance omitted the second runner's network/healthcheck, then services stopped between WSL commands. The override was corrected and a bounded WSL keepalive added before preflights/freeze. Sanitized failed startup and interruption records are preserved. Neither affected the frozen batch or triggered a measured rerun.
- **Post-analysis helper issue:** the hardcoded UID assumption above was corrected transparently offline. The root-write result remains a combined-policy denial, not read-only behavioral proof.

There were no infrastructure-invalid measured runs, missing runtime records, unexplained sandbox leftovers or selective reruns. `failures.json` contains all negative experiment task outcomes; the setup artifacts and analysis-correction note retain the separate preparation/checker issues.

# 12. Post-experiment diagnostics

**POST-EXPERIMENT DIAGNOSTIC:** only after all 100 measured runs completed, a disposable runsc BusyBox container on the same internal bridge fetched the gateway's trusted current IP `/health` endpoint successfully. No capability token, broadcast, hostname substitution, /etc/hosts edit, host networking or production change was used. This supports a DNS-specific incompatibility while showing basic IP connectivity to the listener. It does **not** demonstrate successful runsc Host SDK authorization or Paper broadcast. It is excluded from primary compatibility/performance metrics.

The separate resource probe is also excluded. No primary W8 failure was replaced with a diagnostic success.

# 13. Cleanup/orphan inspection

After primary and diagnostics, there were no running or stopped poc-exec sandbox containers. Both runner admission counters were zero and neither was blocked. No host command remained pending or delivered-but-unfinalized. Session enumeration was not exposed through a new debug endpoint; normal revocations had no cleanup errors and the 40-second TTL was unchanged. Stopping the owned gateway after export clears its process-local sessions.

The unused empty network left by initial preparation was removed after confirming project ownership and no attached containers. Native experiment services were intentionally stopped after evidence export; named volumes, images and the two intentional application networks were retained. No Desktop resources were stopped or removed.

# 14. Research integrity

All prior fingerprints, including Phase 1/2/3, frozen risk evidence, labels, deterministic classifier, Jev policy/results and Phase 4A/initial blocked evidence, were checked unchanged. The immutable manifest/source/environment/workload/private-config hashes matched after the batch. All 130 application executions map to the frozen image/profile/source hash and native daemon; all 100 measured records have start/inspection/cleanup runtime evidence. Warm-up and preflight exclusion, five repetitions, balanced order and visible failures were verified.

Configured credential values were scanned across research results and new tooling with no matches. Fresh local credentials reside only in ignored configuration; raw container environments were never exported. Result JSON parsing and syntax/integrity checks passed. Exact counts/fingerprints are in integrity.json. No production source, frozen workload/policy, runtime argument or gateway hostname was changed during the comparison. No Jev provider requests were made.

# 15. Files created

Repository-relative result directory:

`research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched/`

It contains environment.json, immutable experiment-manifest.json and fingerprint, frozen-workloads.json and workloads/, functional-preflight/, runc-functional-preflight.json, warmups/, measured-runs/, runtime-evidence/, intents/, compatibility-matrix.json, performance-summary.json, permission-evidence-comparison.json, host-chat-results.json, resource-validation.json, failures.json, separate post-experiment diagnostics, setup/cleanup evidence, tests.json, integrity.json and report.md.

New configuration/tooling: compose.phase4bc.yaml, scripts/phase4bc-stack.py, scripts/phase4bc-workloads.py, scripts/phase4bc-experiment.py, scripts/phase4bc-postchecks.py, scripts/phase4bc-analysis.py, scripts/phase4bc-cleanup.py and scripts/phase4bc-report.py. Fresh credentials are in ignored .env.phase4bc and are not part of the research result package. Prior artifacts remain untouched.

# 16. Tests

Focused runner permission, audit-collection and lifecycle unit tests: **35 passed, 0 failed, 0 skipped**. No provider/network capability was granted to these local unit tests. Dataset and integrity validations separately check counts, ordering, all runtime identities, image/source/profile equality, policy controls, JSON parsing, credential exclusion and historical preservation.

Actual native integration evidence comprises 130 API-to-runner executions and seven runc Paper confirmations across preflight/warm-up/measured stages. These are experiment outcomes, not extra unit-test passes. The six W8/runsc DNS failures remain visible. Unrelated broad/API/Jev/Docker suites were not rerun because production code was unchanged; no skipped suite is counted as passing. No TypeScript production source changed, so Python syntax and Compose validation were the relevant new-tool checks.

# 17. gVisor research conclusion

**Did runsc work?** Yes: it genuinely executed the frozen project image through the actual restricted runner and performed the intended semantics of **9/10 controlled workloads**, including timeout cleanup. It did not support the unchanged host-chat topology because hostname lookup failed before the healthy gateway. That is a practical integration limitation, not an intentional security-blocking claim.

**Operational cost?** Successful comparable non-timeout workload medians were 1.62x–2.61x their runc counterparts here; absolute differences were hundreds of milliseconds. Whether that is acceptable depends on the latency budget. For a tiny one-shot PoC this is noticeable, and the host-chat incompatibility prevents treating runsc as a transparent drop-in replacement. The timeout-control ratio is not useful-work performance, and failed W8 tasks have no success overhead ratio.

**Evidence/permissions?** Deno restricted-operation behavior and observed audit completeness matched across this matrix. Captured Docker controls remained applied, with selected non-root/tmpfs/timeout behaviors observed. Common output/audit limitations persisted.

**Architectural contribution?** gVisor's userspace/application kernel mediates workload interactions and reduces direct exposure to the host kernel by design. See the [official architecture guide](https://gvisor.dev/docs/architecture_guide/intro/). That architectural claim is separate from these measurements.

**Empirical security contribution?** The experiment established integration, selected compatibility/control semantics and operational overhead for this PoC. It did not demonstrate escape prevention, resistance to exploits/zero-days, arbitrary-source safety, a security improvement percentage or general performance behavior. No escape or kernel-exploit testing occurred.

# 18. Remaining limitations

WSL2 is a shared virtualized host, with the existing Desktop stack and background services still present; the host was not dedicated or CPU-isolated. Lightweight controller/verification activity can add noise. The matched design holds both groups on one host/image/policy but cannot eliminate all scheduling/cache effects. Fixed API/runner pairs are identically built but remain separate processes.

Only ten researcher-designed workloads, **five repetitions** each and **one runsc version/platform** were studied. W9 is only relatively CPU-heavier and still includes startup; W10 combines allowed I/O with audit work. No pure script/syscall timing or meaningful n=5 p95 was claimed. The known DNS limitation is specific to the tested unchanged topology; no production workaround was evaluated. Direct-IP health is not a successful host-capability path. Read-only root, memory/PID/CPU controls were not all independently pressure-tested. There was **no escape testing** or representative real-world security benchmark.

# 19. Recommendation

Phase 4B/C's matched empirical objective is complete, including the retained negative host-chat result. Preserve this frozen package. Do not promote runsc as a transparent drop-in replacement for this topology or change enforcement based on these results. A future phase may use the measured compatibility/overhead findings and clearly separate any agreed DNS integration work from this primary dataset. No Phase 5 work has begun.

READY FOR PHASE 5
