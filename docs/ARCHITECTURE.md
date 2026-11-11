# Current architecture

The research PoC executes stored untrusted JS/TS outside Paper. The normal demo
uses Docker/runc; the separately researched alternative is Docker/runsc/gVisor.
See [current evidence status](RESEARCH-STATUS.md), not historical setup blockers,
for empirical findings.

## Execution and host path

```text
Client -> API -> PostgreSQL execution record
             -> trusted runner (single-process admission / fixed policy)
                -> Docker -> runc (normal) OR runsc/gVisor (Linux research)
                   -> Deno trusted permission profile -> one-shot source
                      -> Host Gateway (host-chat only; chat.broadcast)
                         -> authenticated internal API enqueue
                            -> PostgreSQL host command
                               -> SecureBridge poll -> Paper
                                  -> authenticated command result -> API/DB
```

```text
Collected execution evidence -> deterministic v1 OR configured Jev advisory
API orchestration -> PostgreSQL durable records / reconstructed UI timeline
                  -> best-effort OTLP/HTTP -> collector debug exporter
```

Execution occurs before advisory analysis. A failed/unavailable assessment has
null classification and does not change the sandbox outcome. Comparison mode
keeps the hot path deterministic; research tooling compares frozen evidence.
Jev does not grant capabilities. No paid provider is required for the demo.
The selected Docker provider reports supervisor/engine failure rather than silently
falling back to mock execution; this is a design property, not a new engine-outage test.

## Trust boundaries

| Component | Responsibility and limit |
|---|---|
| React client | Public API, source editor, profile picker, output/evidence; no Docker socket |
| API | Trusted orchestration, migrations, DB, provider configuration, internal enqueue and bridge authentication |
| Runner | Only service with Docker socket; validates known profile IDs, owns image/runtime/limits/mounts and cleanup |
| Job | Untrusted source in fresh non-root container; no app keys/bridge/admin secrets; only an ephemeral scoped capability credential for host-chat |
| Host Gateway | Separate public capability/admin surfaces; per-execution session, capability and budget checks; transport reachability is not authority |
| PostgreSQL | Durable execution/security/command/correlation/advisory records; no DB-outage/high-availability guarantee demonstrated |
| SecureBridge/Paper | Trusted allowlisted host adapter; Paper confirmation separate from enqueue acceptance |
| Collector | Observability only, detailed debug exporter, no durable trace backend |

Fixed profiles: `none`, `read-fixture` (`/fixtures`), `env-demo`
(`SANDBOX_DEMO_VALUE`) and `host-chat`. Non-host jobs have no network; host-chat
uses the dedicated internal sandbox-host network and narrow gateway transport.
Inspect real result manifests for selected grants and live controls. Memory/PID,
read-only root, user and privilege flags are configuration-verified; Phase 5 did
not perform a new exploit/pressure test for every setting.

## Evidence semantics

Permission audit records access/check observations, not independent allow/deny
outcome bits. `auditCollection` is complete/partial/unavailable/legacy_unknown;
timeout/truncation/missing frame can make collection unavailable. Zero observations
alone is not proof of no activity; complete collection is not exhaustive native
instrumentation. Script stdout is untrusted output, not security evidence.

Queue origin and correlation come from authenticated gateway/trusted DB mapping,
not script metadata. `accepted` means queued. Paper result is durably correlated
later; it can arrive after execution completion and root span export. The API
synthesizes `execution`/`sandbox.run` spans; there is no complete independently
instrumented distributed Paper trace. Collector failure did not weaken enforcement
in the tested outage; that is not whole-system fault tolerance.

## Context versus authority

[Project Settings](PROJECT-CONTEXT.md) guide the next assistant turn. They do not
reconfigure Paper or Docker/Deno. Legacy `executionEnforcement` metadata is retained
for compatibility and is not runtime detection. Selected execution provider/profile
and its observed manifest/evidence are the runtime source of truth.

## Deliberate scope

Only sandbox `host.chat.broadcast` exists. Backend server status/player listing
are not sandbox APIs. No event subscriptions/persistent scripting, arbitrary Paper
access, production end-user authentication or distributed queue. Admission is
bounded within one runner. Runtime selection/compatibility is not escape proof.

[Normal setup](REPRODUCTION.md) is separate from [native gVisor setup](PHASE4A-NATIVE-WSL.md).
