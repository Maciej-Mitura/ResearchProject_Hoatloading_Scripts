# Current research status — through Phase 6 cleanup

This is a factual status index, not the final Phase 7 research interpretation.
Results are controlled observations; limits and negative findings remain intact.

## Evidence index

- [Phase 3 Jev completed report](../research-results/phase3-jev/resume-after-credit-2026-11-09/report.md)
- [Phase 4 matched runc/runsc report](../research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched/report.md)
- [Phase 5 integrated validation](../research-results/phase5-final-validation/2026-11-09T15-24-05Z/report.md)
- [Phase 5 33-claim matrix](../research-results/phase5-final-validation/2026-11-09T15-24-05Z/security-claim-matrix.md)

These local evidence packages are not all published at HEAD. See reproduction
limits and the Phase 6 publication checklist before claiming a clean checkout.

## Deno / Docker

Scoped filesystem/environment permissions and caught restricted observations
were empirically demonstrated. Fresh job lifecycle, timeout/output bounds,
capacity=2 rejection/recovery and isolation between tmpfs jobs were demonstrated.
Non-root user, read-only root, dropped capabilities, no-new-privileges and memory/
PID/CPU limits were inspected in actual container configuration; this does not
prove resistance to all exploitation or constitute new pressure tests of each.
Admission is single-runner, not distributed. Audit access/check observations do
not independently encode denial; incomplete collection and native blind spots
remain. `complete` is collection success, not omniscient instrumentation.

## Host Gateway

Only narrow `chat.broadcast` is sandbox-accessible. Real Paper confirmation,
trusted execution/trace/call/command correlation and admin separation were
empirically demonstrated. A queued command is not confirmed delivery. The runner,
gateway, API, DB and authenticated plugin remain trusted.

## Deterministic baseline

Version 1 agrees with researcher labels on 15/15 development and 9/10 holdout,
24/25 combined. HOL-008 stays low against review reference, reflecting the known
observation blind spot. These labels do not establish general malware accuracy.

## Jev

Frozen model `typesafe-ai/jev-1.14.0`, 25 cases × five repetitions = 125 primary
classifications. Modal agreement with researcher reference labels is 16/25 versus
deterministic 24/25. Twenty-three of 25 cases were unanimous; two varied across
repetitions. No modal reference-agreement improvement was demonstrated. The
experiment completed technically after Vercel account verification; earlier
failures remain recorded. Jev is advisory, not an enforcement/authorization layer.
Policy/input/transformation/analyzer version 2 remains frozen.

## gVisor

Native Ubuntu WSL2, Docker 29.9.3, runsc release-20261102.0, systrap. Same project
sandbox image under runc/runsc, 100 measured executions with trusted runtime
attribution; 9/10 workloads compatible. W8 host-chat failed unchanged runsc Docker
DNS behavior: runc Paper 5/5, runsc 0/5. Comparable non-timeout workload median
runsc/runc ratios were approximately 1.62–2.61x, workload/environment-specific
end-to-end measurements rather than universal overhead. Escape prevention was
NOT DEMONSTRATED. Native environment was intentionally stopped after evaluation;
normal demo uses runc. No DNS fix or benchmark rerun is part of cleanup.

## OpenTelemetry

Actual collector receipt of correlated execution/sandbox.run spans and advisory/
host events was demonstrated. PostgreSQL remains durable application evidence.
The debug exporter is not durable trace storage; late Paper acknowledgements lack
a complete independently exported distributed span chain. One collector outage
retained Deno/Docker restrictions, Host Gateway authorization, Paper execution and
DB evidence; export error was visible and subsequent receipt recovered. This is
not a database/API outage or whole-system fault-tolerance guarantee.

## Reproduction and validation

Phase 5 recorded 217 passing tests, zero failures; a local guarded DB skip later
passed deployed. Its E1–E8 and fresh-data setup passed. Reproduction used current
uncommitted working-tree source, fresh volumes and independent secrets, with build
caches/network downloads. It was not a fresh published-HEAD or offline/no-cache
build. Phase 6 records its own post-cleanup checks separately.
