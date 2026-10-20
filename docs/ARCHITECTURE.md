# Architecture

## Purpose

This repository is the **Proof of Concept foundation** for a Bachelor research project on defense-in-depth for dynamically loaded, untrusted scripts that interact with an active host application through a restricted API.

Minecraft/Paper is **not** the research subject. It is a visual host application used to demonstrate the architecture.

## Current topology

```
┌────────────┐     HTTP      ┌────────────┐     SQL      ┌──────────┐
│  web (UI)  │ ────────────► │    api     │ ──────────► │ postgres │
└────────────┘               │ (Deno/Hono)│             └──────────┘
                             └─────┬──────┘
                                   │ OTLP
                                   ▼
                             ┌────────────┐
                             │otel-collector│ → debug exporter
                             └────────────┘
                                   ▲
┌────────────┐   HTTP poll/HB      │
│   paper    │ ◄───────────────────┤
│+SecureBridge│  allowlisted cmds  │
└────────────┘                     │
                                   │ narrow POST /execute
                                   ▼
                             ┌────────────────────┐
                             │ execution-supervisor│  docker.sock (only here)
                             │   (services/runner) │
                             └─────────┬──────────┘
                                       │ fresh job container
                                       ▼
                             ┌────────────────────┐
                             │ sandbox (Deno)     │  network=none, no socket
                             │ research-poc-sandbox│
                             └────────────────────┘
```

## Trust boundaries (current)

| Component | Trust level | Notes |
|-----------|-------------|-------|
| `web` | Developer workstation UI | Talks only to public API; **no** Docker socket |
| `api` | Trusted control plane | Owns DB, providers, bridge auth; **no** Docker socket |
| `postgres` | Trusted persistence | Internal network only |
| `otel-collector` | Trusted observability sink | Debug exporter only for now |
| `runner` (supervisor) | **Trusted** execution supervisor | Sole Docker Engine client; narrow `/execute` API |
| `sandbox` image / job containers | Untrusted workload | Fresh container per run; no secrets; no Docker socket |
| `paper` + `SecureBridge` | Trusted host + tiny allowlisted bridge | No Docker control, no shell; **not** reachable from sandbox yet |
| Uploaded script source | **Untrusted data** | Executed only when `EXECUTION_PROVIDER=docker` |

## Execution path

```
Web UI → API → ExecutionService pipeline
              → RiskAnalyzer (still mock/advisory)
              → ExecutionProvider
                   ├── mock  → simulated running step
                   └── docker → supervisor POST /execute
                                    → docker run (fixed image/limits)
                                    → stdin source → Deno --no-prompt
```

Provider selection is **only** via `createExecutionProvider()` / `createExecutionService()` from `EXECUTION_PROVIDER`. Route handlers do not branch on the env var.

## Component roles

### Web (`apps/web`)

React + TypeScript workbench: conversations, scripts, execution visualization (status, exit code, stdout/stderr), host inspector.

### API (`apps/api`)

Deno + Hono REST API + SSE for execution updates. Owns migrations, chat/risk/execution providers, bridge endpoints.

### Trusted execution supervisor (`services/runner`)

Owns sandbox image name, Docker runtime (future `runsc`), resource limits, network mode, and cleanup. Exposes only:

- `GET /health`
- `POST /execute` `{ executionId, language, source }`

Rejects client-supplied image/mounts/env/privileged/runtime overrides.

### Sandbox (`services/sandbox`)

Minimal image: pinned Deno **2.9.7** + trusted `entrypoint.sh`. Writes stdin to `main.js` / `main.ts` under tmpfs `/workspace`, then:

```text
deno run --no-prompt <script>
```

Supervisor sets `DENO_AUDIT_PERMISSIONS=/workspace/permission-audit.jsonl` and collects the JSONL after the run. Trusted permission profiles: `none`, `read-fixture`, `env-demo`, `host-chat`. Clients send only a profile ID — never raw Deno flags. Host-capable jobs use the dedicated `sandbox-host` network and the Host Gateway (`chat.broadcast` only). See [`DENO-PERMISSION-BASELINE.md`](DENO-PERMISSION-BASELINE.md) and [`HOST-GATEWAY.md`](HOST-GATEWAY.md).

No application `.env`, API keys, `BRIDGE_TOKEN`, or Docker socket.

### SecureBridge (`minecraft/bridge`)

Minimal Paper plugin: heartbeat/events to API; polls allowlisted commands. Not connected to sandbox scripts in this milestone.

### Contracts (`packages/contracts`)

Shared TypeScript types + JSON Schema for bridge wire protocol v1; execution result / supervisor request types.

## Docker socket security

| Service | Docker socket |
|---------|---------------|
| api | no |
| web | no |
| paper | no |
| sandbox job containers | no |
| runner (supervisor) | **yes** (local PoC) |

## Project context (assistant grounding)

See [`docs/PROJECT-CONTEXT.md`](PROJECT-CONTEXT.md).

## Data flow highlights

1. **Chat**: UI → API → `ProjectContextService` / `AssistantContextBuilder` → `ChatProvider` → PostgreSQL.
2. **Execution**: UI → `POST /api/executions` → pipeline → SSE → OTLP span; docker provider calls supervisor.
3. **Host bridge**: Paper plugin heartbeats → API; allowlisted commands only.
4. **Project settings**: UI → `PATCH /api/project/settings` → JSONB overrides.

## Planned (not this milestone)

- gVisor (`runsc`) experiments on Linux
- Jev behind `RiskAnalyzer` (advisory System One Choice; see `docs/JEV-RISK-COMPARISON.md`)
- Sandbox → restricted host client → SecureBridge
- Richer security-event taxonomy
- Production hardening / proven optimal limits
