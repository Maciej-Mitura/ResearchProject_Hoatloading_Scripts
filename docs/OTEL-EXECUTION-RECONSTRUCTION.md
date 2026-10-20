# OpenTelemetry Execution Reconstruction

Research milestone: **one script execution → one trusted root trace**, correlated
with durable PostgreSQL evidence so a run can be reconstructed from creation
through completion/failure/termination.

## What OpenTelemetry is (and is not)

OpenTelemetry here provides **correlation and observability**:

- timing across trusted components
- shared identifiers (`executionId` ↔ `traceId` ↔ `callId` ↔ `commandId`)
- span/event shape for reconstruction in the Collector debug exporter

It does **not** enforce:

- Deno permissions
- Docker / sandbox boundaries
- Host Gateway capability authorization
- SecureBridge allowlisting

It is **not** authorization, sandboxing, an IDS, or guaranteed complete forensic
storage. PostgreSQL `security_events` / execution rows remain the durable
application record.

## Trace model

Trusted API creates the root trace when an execution is created
(`startExecutionTrace` in `apps/api/src/telemetry/otel.ts`).

Conceptual shape (names adapt to code):

```
execution                          (root span)
├── events: execution.started, permission.accessed*, host_api.*, …
├── sandbox.run                    (child span)
└── attributes: execution.id, provider, language, duration_ms, …
```

Untrusted scripts are **not** instrumented with an OpenTelemetry SDK. Scripts
must not choose `traceId`, `executionId`, parent span, or trusted context.

## Identifier relationships

| ID | Role |
|----|------|
| `executionId` | Durable application correlation key (DB, Host Gateway session) |
| `traceId` | OpenTelemetry correlation (32-hex), persisted on `result.traceId` |
| `callId` | Host Gateway capability call |
| `commandId` | Queued host command → SecureBridge `command_result` |

```
executionId
  → traceId
  → host API callId
  → host commandId
```

`traceId` is never used as authorization.

## Context propagation (trusted only)

| Hop | Mechanism | Trusted? |
|-----|-----------|----------|
| API → supervisor | HTTP `traceparent` + body `traceId` | Yes (internal network) |
| Supervisor → Host Gateway session create | Admin token + optional `traceId` on session | Yes |
| Sandbox → Host Gateway | Capability token only | Auth = token; ignore sandbox `traceparent` |
| Host Gateway → API enqueue | `payload._meta` `{executionId,callId,traceId}` | Yes (gateway-built) |
| SecureBridge → API `command_result` | Lookup command payload `_meta` → `host.command.result` | Yes |

If `traceparent` crosses a boundary a script can touch, it is **correlation only**.
Forging it must not grant `chat.broadcast` or any other capability.

## Event provenance

| Source | Meaning |
|--------|---------|
| `application` | API lifecycle (`execution.created/started/completed/…`) |
| `deno_permission_audit` | Trusted `DENO_AUDIT_PERMISSIONS` JSONL → `permission.accessed` |
| `supervisor` | Supervisor classifications (e.g. `execution.failure.deno_permission`) |
| `host_gateway` | `host_api.requested/allowed/denied/queued` |
| `secure_bridge` | `host.command.result` after Paper/bridge reports |
| `script_output` | Untrusted stdout (UI timeline only) |
| `mock` | Mock risk assessment — clearly labeled |

`permission.accessed` means Deno reported an access/check. It is **not**
`permission.allowed` / `permission.denied`. A separate supervisor
`execution.failure.deno_permission` event may exist when stderr indicates
`NotCapable`; do not merge those semantics.

## DB evidence vs OTel evidence

| Concern | Durable (PostgreSQL) | Telemetry pipeline |
|---------|----------------------|--------------------|
| Lifecycle | `security_events` + execution status | Root span events/attrs |
| Permissions | `permission.accessed` rows | Span events |
| Host API | `host_api.*` rows | Span events |
| Bridge result | `host.command.result` | Correlated via same IDs |
| UI timeline | **Built from DB** | Not queried |

OTel export failure must not remove DB rows. Critical security events must not
depend on sampling.

## Sampling

PoC: **100% recording** of execution traces when the exporter is configured.
Suitable for a small research lab; **not** a production recommendation.

## High-cardinality caution

Appropriate attributes: `execution.id`, `capability`, `permission.type`, status,
runtime, profile.

Keep `permission.target` for controlled experiments but treat it as
high-cardinality. Avoid full script source, arbitrary chat text, full URLs,
player names, and raw secrets in attributes.

Never put `HOST_CAPABILITY_TOKEN`, `HOST_GATEWAY_ADMIN_TOKEN`, or `BRIDGE_TOKEN`
into traces/logs.

## Collector outage behavior

Manual PoC (2026-10-19, Docker Desktop):

1. `docker compose stop otel-collector`
2. Run `console.log("collector down")` with `EXECUTION_PROVIDER=docker`
3. Result: `status=completed`, `exitCode=0`, `traceId` still minted and stored on
   `result.traceId`; security/timeline rows present in PostgreSQL
4. Host Gateway authorization still rejects missing tokens (`401`)
5. API warns on export (`[otel] export error (ignored): Signal timed out.`)
6. `docker compose start otel-collector`

**Telemetry availability ≠ security enforcement availability.**

## UI reconstruction

Inspector → **Execution timeline** is built from durable DB events (and untrusted
`SCRIPT_OUTPUT` marked as such). Expand **Advanced details** for `traceId`.

## Example reconstructions

### Normal (`console.log("hello")`)

CREATED → STARTED → COMPLETED (+ SCRIPT_OUTPUT). No host API.

### Permission failure (`Deno.readTextFile("/etc/hosts")`)

CREATED → STARTED → PERMISSION read /etc/hosts → FAILURE deno_permission → FAILED.

Audit access ≠ proof of denial by itself; supervisor classification is separate.

### Caught permission

STARTED → PERMISSION read /etc/hosts → SCRIPT_OUTPUT "handled" → COMPLETED.

Completed does **not** mean no restricted-capability activity occurred.

### Host chat (`host.chat.broadcast`)

STARTED → env/net permission.accessed → host_api requested/allowed/queued →
(optional) HOST command result → COMPLETED. Same `executionId`.

### Host denial (no/invalid capability)

host_api.requested → host_api.denied. No Paper command queued. Still enforced
with Collector down.

### Trace forgery

Sandbox-supplied `traceparent` does not grant capabilities or change session
`executionId`. See `services/host-gateway/tests/trace_forgery_test.ts`.

## Local trace viewer (optional, not added)

For a slightly richer local view than the Collector debug exporter, a small
OTLP→Jaeger or Zipkin all-in-one could be wired later. Not required for this
milestone; debug exporter is enough for correlation validation.

## Limitations

- Collector debug exporter is ephemeral (stdout); not long-term storage.
- Permission audit does not encode allow/deny outcomes on Deno 2.9.7.
- SecureBridge correlation requires `_meta` on queued payloads (smallest change).
- Script `console.log` is never trusted security telemetry.
- 100% sampling and keeping permission targets are PoC trade-offs.
