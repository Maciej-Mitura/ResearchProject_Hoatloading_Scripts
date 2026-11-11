# Phase 2 execution reliability

This is a local single-runner bound, not protection against public/distributed DoS.
No queue, production scheduler, new script permissions or Paper capabilities were added.

## Admission and recovery

`SANDBOX_MAX_ACTIVE` defaults to 2 (valid integer range 1–8). The runner owns
admission, including direct calls to its normal sandbox execution function. Excess
or duplicate-active requests receive HTTP 429; there is no waiting queue. The API
retains a failed execution with `capacity_rejected`; it never substitutes mock.
Runner health exposes active/capacity/rejection count and a blocked flag.

Slots cover resource acquisition through cleanup and are released in `finally`.
Container names use supervisor-generated UUIDs, not caller-selected identities.
An unconfirmed container removal or ambiguous create deadline blocks new admissions.
Startup also blocks admission if old `poc-exec-*` resources exist or inspection fails.
Recovery requires a trusted operator to establish/clean daemon state and restart;
there is no automatic deletion of unidentified work and no public reset route.

## Lifecycle and bounds

Validate → admission → optional capability session → Docker create → attached
start/source transfer → wait/capture → inspect → container removal → session revoke
→ release. Docker create is separated from attached execution so resource ownership
and OOM state remain inspectable. Containers are explicitly removed, not auto-removed
before their state can be inspected. All normal sandbox restrictions remain intact.

Docker operations have 5-second deadlines with process cancellation. Gateway
administration/revocation waits have 5-second bounds. The default 10-second job
wall limit includes attached start and source transfer, not just JS CPU time.
On deadline the runner checks actual running state before labeling a job timeout;
a failed/stalled Docker wait is an infrastructure error. It cannot prove the exact
instant user code began; do not report this as a precisely measured JS-only timer.
Capture settling and cleanup have their own finite bounds. Serial stages mean the
whole response can exceed 10 seconds; the API supervisor request has a 60-second
deadline, including body consumption. Increasing runner limits requires reviewing
that API budget. These are lab defaults, not optimal limits.

Cleanup errors are separate from the primary result. Failed revoke is explicitly
reported with TTL fallback; an acknowledged session is revoked on normal/failure
paths. A lost session-create acknowledgement cannot supply a token for revocation:
the gateway's finite expiry remains the authority boundary. Sessions are process-local.

Docker creation/wait failures remain `supervisor_error` or operation-timeout
categories, not script failures or mock successes. OOM is inspected and returned as
`oomKilled`/`memory_limit`. A valid exit plus cleanup failure retains the exit facts
and reports cleanup uncertainty. Missing/malformed audit remains explicit.

## Execution and advisory analysis

Sandbox evidence is persisted before advisory analysis. Analysis exceptions/stalls
become a failed advisory assessment (35-second wait bound), not a changed script
exit. Advisory persistence errors are logged separately; finalization still uses
the observed sandbox outcome. Baseline rules and labels are unchanged.

These changes do not guarantee durable finalization during PostgreSQL failure or
process death. The existing SQL pool/DB layer is not redesigned here. If evidence
cannot be persisted, stop the experiment and report infrastructure/evidence loss;
do not reinterpret an absent result as an empty complete audit. This remains a
limitation of API orchestration beyond the bounded runner lifecycle.

## Reproduction and evidence

`scripts/validate-phase2-runtime.mjs` runs a small capacity-2 experiment, script
failure/timeout/output/memory probes, and an isolated trusted Docker control fixture.
It requires the deployed Docker stack. Run it from Node with Docker access. The
fixture uses Deno `-A` solely to reach OS checks, never as a production profile.
An initial narrower fixture was stopped by Deno's special `/proc` protection;
the retained successful fixture bypasses that protection only inside this trusted test.

Results are additive under `research-results/phase2/`. Memory pressure is bounded
by the existing 256 MiB container limit. Output is a returned/captured-output cap,
not a bound on internal production or Docker logging volume.

Evidence classifications:

| Control | Evidence |
|---|---|
| Non-root UID/GID | BEHAVIORALLY VALIDATED: UID/GID 1993 |
| Read-only root | BEHAVIORALLY VALIDATED: write reached OS and failed EROFS |
| Writable tmpfs | BEHAVIORALLY VALIDATED: write/read succeeded |
| Memory | BEHAVIORALLY VALIDATED: configured 268435456 bytes; job exit 137 and OOMKilled |
| PIDs | CONFIGURATION VERIFIED: 64; exhaustion not exercised |
| Capabilities | CONFIGURATION VERIFIED and runtime flags inspected: zero effective/bounding masks; no exploit/effectiveness proof |
| No-new-privileges | CONFIGURATION VERIFIED and runtime NoNewPrivs=1; no escalation experiment |
| Non-host network | CONFIGURATION VERIFIED: actual normal jobs use network none; Phase 1B host-network evidence retained |
| Timeout | BEHAVIORALLY VALIDATED: termination, incomplete audit, cleanup and admission recovery |
| Output | BEHAVIORALLY VALIDATED: capped returned output, truncation, incomplete audit and recovery |

Controlled mocks cover acquisition/setup/start/wait/audit/revoke/cleanup failure;
actual PostgreSQL-backed execution also verifies a thrown advisory analyzer leaves
a successful script completed with a failed assessment. Mocks are not equivalent
to reproducing every daemon failure on a real Docker engine.
