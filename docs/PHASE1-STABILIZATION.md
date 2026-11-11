# Phase 1: authority and evidence foundation

Current implementation, November 2026. This supersedes older descriptions of
public host-command submission, payload `_meta` attribution, and Jev defaults.
No real Jev classification or gVisor experiment was performed in this phase.

## Administrative boundary

The Host Gateway has two Hono applications/listeners sharing its process-local
session store. Port 3200 exposes capability use and health only. Session creation
and revocation exist only on port 3201, bound to the IPv4 address resolved from
`host-gateway-admin`. Compose registers this alias **only on the app network**.
Failure to resolve exactly one address prevents startup; there is no wildcard
admin-bind fallback. Neither port is published to the host.

Jobs join only `sandbox-host`; Deno grants only `host-gateway:3200` networking.
Runner administration targets `http://host-gateway-admin:3201`. Thus separate
route tables, interface binding, Docker network separation and Deno transport
permissions all contribute. The app network and its services remain trusted.
Actual Docker DNS/interface isolation must also be checked on the experiment host;
HTTP/unit tests alone do not establish Docker network behavior.

Set independent `HOST_GATEWAY_ADMIN_TOKEN` and `HOST_GATEWAY_SERVICE_TOKEN`
values of at least 32 characters. `BRIDGE_TOKEN` likewise requires an explicit independent secret so default credentials cannot forge bridge confirmations. Empty and recognizable placeholder credentials
are rejected, including the former shipped defaults. Gateway startup fails
closed; API internal routes reject requests if their service secret is invalid.
The admin credential goes only to runner/gateway. The separate service credential
goes only to gateway/API. No credentials are shipped or written into the browser.
For each secret, generate a fresh random value, for example:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Commands and trusted provenance

`POST /api/host/commands` is disabled (403), including debug submission of status,
player-list and broadcasts. Its UI button is disabled. Existing narrow Paper
implementations are retained; no new host capability was added.

Only the service-authenticated `POST /api/internal/host-commands` can enqueue a
sandbox broadcast. It accepts an exact structured body from the gateway, rejects
`_meta`/extra fields, and stores only `{message}` in the Paper payload.

| Identifier/fact | Owner and validation |
|---|---|
| executionId | API execution row; runner places it in gateway session |
| traceId | API root trace; enqueue SQL requires matching API `execution.created` event |
| callId | Gateway generates UUID for each capability invocation; queue enforces uniqueness |
| commandId | PostgreSQL generates queue row ID |
| capability | Gateway session/policy; internal API fixes it to `chat.broadcast` |
| origin | API/repository writes `sandbox_capability`; never accepted from browser payload |
| bridge result | Authenticated SecureBridge reports queue command ID; result links through stored mapping |

Migration 009 adds separate `origin` and `correlation` columns. Old commands remain
`unknown` with null trusted correlation, even if their payload has plausible
`_meta`. No historical attribution is repaired by guessing. A genuine bridge
result confirms that queued command; it cannot upgrade arbitrary payload data.
Only delivered commands can be completed, and a completed result cannot be
rewritten by replay. This does not implement durable delivery leases or exactly
once Paper effects. Gateway service identity is trusted to create call metadata;
the API does not independently inspect the gateway's session memory.

## Audit collection

New runner/API results contain `auditCollection: {version: 1, status, reasons}`:

| Status | Meaning |
|---|---|
| complete | Required frames received and parsed without reported loss |
| partial | Frames/records or execution/output conditions make completeness uncertain |
| unavailable | Required frame absent or collection infrastructure failed |
| legacy_unknown | No valid collection status was recorded historically |

An empty complete audit differs from an empty unavailable audit. Timeout,
output truncation, malformed/missing frames, audit limits, malformed JSON and
runner failures cannot produce confirmed complete collection. Even if frames
survive output truncation, collection is conservatively partial. This retains
the current stdout framing design; it does not recover lost frames.

**Complete collection does not mean complete Deno instrumentation.** In particular,
caught subprocess denial may remain unobserved, and native access/check events
do not encode allow/deny outcomes.

`collected-evidence.ts` adds `evidenceExtensionVersion: 1` and normalized collection
metadata to current schema-v1 evidence. The original schema builder, deterministic
classifier/rules v1, policy v1, fixtures and frozen results remain byte-for-byte
unchanged. Deterministic classifications are not retuned. Stored assessments and
research responses carry collection context alongside those classifications;
LOW is never proof of complete observation or safety.

## Current Jev request provenance

One current policy source: `config/jev-risk-policy-v2.md`, loaded verbatim. The
request stores SHA-256 of its exact policy text, Choice criteria and request body.
Custom policy overrides are explicitly identified and hashed as custom.

Provider routes are explicit: Vercel uses `typesafe-ai/jev-1.14.0`; direct TypeSafe
uses `jev-1.14.0` by default. Moving aliases, unknown providers and mismatched
provider/model/endpoint configuration are rejected. Model availability has not
been verified by an external call during this phase. The intended experiment
route in `.env.example` and the offline validator is Vercel.

Results/dry runs record provider, endpoint, requested model, policy source/version/
hash, criteria hash, analyzer version 2, input schema version 2, transformation
version 2, evidence schema version 1, extension version 1 and presentation.
Actual response model remains separately recorded. All supplied permission
observations (up to the schema's 200 limit) are sent; the old first-50 truncation
has been removed. Transformation metadata lists omitted fields and counts.

Leak checking distinguishes structural fields from values. Research labels,
source/stdout and credential fields are forbidden; an audited environment-variable
name is allowed. Known configured secret values, explicit credential assignments,
bearer values, provider-key signatures and 64-hex capability-token signatures are
rejected. Arbitrary unknown secrets embedded in otherwise permitted strings
cannot be recognized perfectly. Do not interpret the guard as general DLP.

Confidence must be finite in [0,1]. If probabilities are supplied, all three
options must be in range and sum to one (small numerical tolerance); the selected
class must be a maximum-probability option. Confidence remains distribution-derived,
not calibrated correctness or malice probability. Latency includes response-body
consumption and output validation; failures are separate outcomes.

## Local validation and remaining runtime checks

Run from the repository root, using a locally available Deno:

```sh
deno run --no-lock --allow-read --allow-env --allow-write=research-results/phase1 scripts/validate-jev-inputs.ts
```

No `--allow-net` is granted. Output:
`research-results/phase1/input-validation-v2.json`. The local retained corpus
validated **25/25**, all with `legacy_unknown` completeness. Original files are
hashed but never rewritten. Clean clones without the separately retained frozen
files must obtain those original files; the validator fails rather than fabricates
cases. Frozen-input-only tests explicitly skip when that corpus is absent.

Focused HTTP tests cover missing/default/wrong credentials, admin surface absence,
forged metadata and genuine session identity. Audit unit tests cover normal,
caught-read, timeout, output, frame and JSON loss. Mocked Jev tests cover leakage,
configuration, provenance, output validation and body-consumption timing.

The test-only embedded PostgreSQL script exercises migration 009 and real
repository SQL without touching the app database. It uses PGlite/PostgreSQL 17.5,
not the deployed PostgreSQL 16 service; the optional pgcrypto extension line is
omitted in that test environment. Docker/Paper runtime and production-driver
integration still require the actual stack. Do not count skipped Docker tests as
passes.

Before final experiments, verify on the Docker host: app-only admin interface
binding/DNS, sandbox inability to reach admin/API, real collected statuses for
normal/caught/timeout/output runs, migration deployment and confirmed Paper
broadcast correlation. There is no empirical gVisor or Jev effectiveness claim
from this stabilization phase.
