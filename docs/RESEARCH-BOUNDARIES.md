# Research boundaries

Explicit status of capabilities in this repository.

## REAL NOW (restricted execution + Deno permission baseline + scoped profiles)

When `EXECUTION_PROVIDER=docker`:

- Fresh Docker container per execution (created → run → removed)
- Deno **2.9.7** (pinned sandbox image) actually runs the stored JavaScript/TypeScript source
- Trusted permission profiles (client sends ID only — never raw Deno flags):
  - `none` (default): `deno run --no-prompt`, no `--allow-*`
  - `read-fixture`: `--allow-read=/fixtures` (baked-in fixture only; `/etc/hosts` still denied)
  - `env-demo`: `--allow-env=SANDBOX_DEMO_VALUE` (no application secrets injected)
  - `host-chat`: scoped net to Host Gateway + `chat.broadcast` host capability (see [`HOST-GATEWAY.md`](HOST-GATEWAY.md))
- Host Gateway service on dedicated `sandbox-host` network (sandboxes never join app `internal`)
- Script API: `import { host } from "host"; await host.chat.broadcast("…")`
- Native Deno permission audit JSONL collected by the supervisor (`DENO_AUDIT_PERMISSIONS`)
- Structured `permission.accessed` security events (access/check observations — not allow/deny labels)
- Structured `host_api.*` events from the trusted gateway (allow/deny known)
- Execution manifest (runtime version, limits, profile, `denoPermissions`, `hostCapabilities`, network, …)
- Failure category `deno_permission` when Deno reports `NotCapable` / missing allow flag
- Docker `network=none` for non-host profiles; `sandbox-host` only for `host-chat`
- Read-only root filesystem + tmpfs workspace
- Non-root user, `cap-drop ALL`, `no-new-privileges`
- Starting PoC limits: ~0.5 CPU, 256 MB RAM, 64 PIDs, 10s wall clock, ~1 MB output, ~64 MB tmpfs
- Bounded stdout/stderr persisted on the execution record
- Only the trusted execution supervisor mounts the Docker socket

See [`docs/DENO-PERMISSION-BASELINE.md`](DENO-PERMISSION-BASELINE.md).

When `EXECUTION_PROVIDER=mock` (default in `.env.example`):

- Pipeline states are simulated; source is **not** executed
- Mock security evidence is labelled `source: mock` and must not be confused with real audits

## KNOWN / IMPLEMENTED (platform)

- Docker Compose stack for web, API, PostgreSQL, OTel Collector, supervisor, sandbox image, Paper, bridge builder
- React workbench UI (conversations, scripts, execution pipeline + output, host inspector)
- Deno/Hono API with migrations, seed data, REST endpoints, SSE execution updates
- Chat providers: `MockChatProvider` (default), optional Gemini / OpenAI
- Deterministic LOW / REVIEW / HIGH behavioral risk analyzer; optional Jev provider adapter and legacy mock (all advisory)
- SecureBridge Paper plugin with tiny allowlisted host API
- HTTP polling bridge transport + shared `BRIDGE_TOKEN` (dev-only)
- Per-execution OpenTelemetry spans/events from API (best-effort OTLP export; debug collector)
- Shared contracts package + bridge JSON Schema v1
- Execution fixtures under `fixtures/execution/`
- `compose.gvisor.yaml` prepares central `SANDBOX_DOCKER_RUNTIME` (not required for normal dev)

## STILL TO EVALUATE / EXTEND

- Successful live Jev corpus comparison (provider implemented; Vercel uses `AI_GATEWAY_API_KEY`, direct TypeSafe uses `TYPESAFE_API_KEY` or legacy `JEV_API_KEY`; see `JEV-RISK-COMPARISON.md`)
- gVisor isolation in normal development (`runsc` optional later on Linux)
- Additional sandbox host capabilities (`server.status`, `server.player_list`, events, inventory, console)
- Arbitrary / user-defined Deno permission combinations and paths
- Explicit allow/deny outcome bits from Deno audit alone (format does not provide them)
- Automatic malicious/benign classification
- Final validation of the security telemetry taxonomy and reconstruction methodology (execution reconstruction is implemented)
- Dependency downloads / egress proxy
- Production hardening; academically proven optimal resource limits
- Kubernetes or other orchestration platforms

## RESEARCH TODO

- gVisor (`runsc`) comparative experiments on Linux
- Successful live Jev vs deterministic closed/holdout comparisons when provider access permits
- Additional sandbox host capabilities beyond chat.broadcast
- Mandatory security event types, retention, sampling, redaction rules
- Authoritative vs untrusted telemetry sources
- Experimental evaluation of resource/time/output limits
- Controlled legitimate / suspicious / malicious fixtures under ethics constraints

## OUT OF SCOPE (this milestone)

- Claiming production-ready “secure arbitrary code execution”
- Exposing Docker socket to API/web/Paper/sandbox jobs
- Privileged sandbox containers
- Broad host filesystem mounts into the sandbox
- Letting API clients choose image/runtime/mounts/limits
- Direct script access to Paper/SecureBridge (implemented host interaction goes through the restricted Host Gateway)
- Implementing real exploitation payloads
