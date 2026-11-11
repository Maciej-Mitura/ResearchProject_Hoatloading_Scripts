# Current research boundaries

See [current status](RESEARCH-STATUS.md) and the [Phase 5 claim matrix](../research-results/phase5-final-validation/2026-11-09T15-24-05Z/security-claim-matrix.md)
for measured results and evidence classes. This is a controlled local PoC, not
production-grade arbitrary-code security or malware detection.

## Normal application

`EXECUTION_PROVIDER=docker` really executes stored JS/TS once in fresh restricted
Docker/Deno 2.9.7 jobs, normal runc. Explicit mock simulates source and is labeled.
Trusted profiles are none, read-fixture, env-demo and host-chat. Only the runner
has Docker socket access and owns image/runtime/mounts/limits. User settings guide
assistant context, not runtime permissions. Live manifests/configuration verify
non-root/read-only root/privilege and resource settings; timeout/output/admission
behavior was demonstrated. Single-runner capacity is not a distributed queue.

Only `host.chat.broadcast` is sandbox-accessible, via Host Gateway capability
session, authenticated enqueue, DB command and SecureBridge/Paper confirmation.
Backend status/player views do not make those methods available to scripts.
No persistent event subscriptions, arbitrary Paper methods or direct enqueue UI.

## Evidence and advisory analysis

Permission access/check observations do not provide standalone allow/deny outcomes.
Collection complete/partial/unavailable/legacy_unknown and reasons are explicit;
zero observations alone cannot prove no activity, and complete collection does
not remove native instrumentation blind spots. PostgreSQL stores durable records
and reconstructs UI timelines. Script stdout is untrusted output.

OTel receives best-effort API-reconstructed execution/sandbox spans/events; the
debug exporter is not durable storage. Late Paper confirmation is DB evidence,
not a complete independent Paper span. A tested collector outage retained
restrictions/authorization/evidence, not whole-system fault tolerance.

Deterministic v1 and optional Jev remain advisory and never grant authority or
block execution based on their score. Controlled reference agreement is 24/25
versus Jev modal 16/25; HOL-008 blind spot and two variable Jev cases remain.

## Separate researched runtime

Linux/WSL runsc comparison completed: 100 measured attested executions, 9/10
compatible workloads, W8 DNS incompatibility and workload-specific overhead.
Not the normal demo runtime; escape prevention was not demonstrated.

## Outside current scope

Production end-user authentication, distributed scheduling, database high
availability, broad egress/dependency downloads, arbitrary permission combinations,
new capabilities and exploit campaigns are not supplied by this validation.
Source publication remains pending; fresh-data working-tree reproduction is not
published-HEAD reproducibility. [Normal setup](REPRODUCTION.md) is separate from
[native experimental setup](PHASE4A-NATIVE-WSL.md).
