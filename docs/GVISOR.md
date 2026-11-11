# gVisor / runsc: completed experimental comparison

Normal application demos use **Docker + runc**. gVisor is a separately researched
optional container runtime boundary, not a mandatory normal/demo layer.

## Frozen Phase 4 result

Native Ubuntu WSL2, Docker 29.9.3, runsc **release-20261102.0**, systrap platform.
The same project sandbox image ran under matched runc/runsc conditions. All
**100 measured executions** had trusted runtime attribution; **9/10 workloads**
were compatible. W8 host-chat failed under unchanged runsc Docker DNS behavior:
matched runc Paper confirmation **5/5**, runsc **0/5**. This negative result remains.
Comparable non-timeout workload median runsc/runc duration ratios were about
**1.62–2.61x**, specific to measured workloads and this WSL/Linux environment.
They are not a universal runtime-only slowdown percentage.

**gVisor escape prevention: NOT DEMONSTRATED.** Runtime attestation, compatibility
and extra boundary architecture are not exploit-resistance evidence.

[Matched experiment report](../research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched/report.md)
contains the methodology and negative findings. The native environment was
intentionally stopped afterward; that is not a normal-stack regression.
[Current research status](RESEARCH-STATUS.md) separates empirical claims from limits.

## Runtime selection and setup

The trusted runner owns runtime selection centrally. API clients/scripts cannot
choose it. `SANDBOX_DOCKER_RUNTIME=runsc` or `compose.gvisor.yaml` requires a Linux
Docker engine with runsc registered. It changes the job runtime, not the runner's
own Docker Engine access. Do not set runtime: runsc on the runner service.

Use [native Phase 4A setup](PHASE4A-NATIVE-WSL.md) and [Linux setup](PHASE4-LINUX-SETUP.md)
for the recorded experimental environment. [Original Desktop preflight](GVISOR-EXPERIMENT.md)
is historical evidence of that engine's limitation, not the final project status.
The normal Desktop engine still need not register runsc; do not claim it runs
under gVisor. Do not fix DNS or rerun the benchmark as part of demo preparation.

[Normal reproduction](REPRODUCTION.md) needs no runsc or benchmark calls.
