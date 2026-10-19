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
                                   │
                             ┌────────────┐
                             │   runner   │  (mock foundation only)
                             └────────────┘
```

## Trust boundaries (current)

| Component | Trust level | Notes |
|-----------|-------------|-------|
| `web` | Developer workstation UI | Talks only to public API |
| `api` | Trusted control plane | Owns DB, mock pipelines, bridge auth |
| `postgres` | Trusted persistence | Internal network only |
| `otel-collector` | Trusted observability sink | Debug exporter only for now |
| `runner` | Future untrusted boundary | **Does not execute code yet** |
| `paper` + `SecureBridge` | Trusted host + tiny allowlisted bridge | No Docker control, no shell |
| Uploaded script source | **Untrusted data** | Stored as text; not executed |

## Trust boundaries (planned research)

Future work will place real untrusted execution inside an isolated runner (Deno permissions + gVisor on Linux), with advisory risk analysis (Jev) and richer OpenTelemetry security events. Policies are **not invented** in this foundation.

## Component roles

### Web (`apps/web`)

React + TypeScript workbench: conversations, scripts, mock execution visualization, host inspector.

### API (`apps/api`)

Deno + Hono REST API + SSE for execution updates. Owns migrations, mock chat, mock risk, mock execution state machine, bridge endpoints.

### Runner (`services/runner`)

Interface/boundary for future sandbox orchestration. Health + mock accept endpoint only.

### SecureBridge (`minecraft/bridge`)

Minimal Paper plugin: heartbeat/events to API; polls allowlisted commands (`broadcast_message`, `request_status`, `request_player_list`).

### Contracts (`packages/contracts`)

Shared TypeScript types + JSON Schema for bridge wire protocol v1.

## Project context (assistant grounding)

See [`docs/PROJECT-CONTEXT.md`](PROJECT-CONTEXT.md).

Every chat turn receives: assistant policy + effective project settings + implemented host capabilities + dynamic host state + conversation history + user message. Effective settings = `config/project-spec.yaml` merged with PostgreSQL overrides from the Project Settings UI.

## Data flow highlights

1. **Chat**: UI → API → `ProjectContextService` / `AssistantContextBuilder` → `ChatProvider` (mock / Gemini / OpenAI) → messages in PostgreSQL (optional script proposal).
2. **Mock execution**: UI → `POST /api/executions` → state machine → SSE → OTLP span attempt.
3. **Host bridge**: Paper plugin heartbeats → API stores connection; UI/API enqueue allowlisted commands → plugin polls and executes enum actions only.
4. **Project settings**: UI → `PATCH /api/project/settings` → JSONB overrides; next chat turn picks them up without restart.
5. **Host observability**: SecureBridge → `host_events` (join/leave/chat/command). Shown in the Server Info tab. This is **not** OTEL security telemetry or sandbox/script logs.
