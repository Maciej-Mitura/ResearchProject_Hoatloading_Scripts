# Host Gateway (chat.broadcast)

This document describes the restricted path from an untrusted Deno script to a
visible Minecraft chat message.

## End-to-end flow

```text
untrusted script
  import { host } from "host"
  await host.chat.broadcast("…")
        ↓
Deno permissions (transport only)
  --allow-net=host-gateway:3200
  --allow-env=HOST_GATEWAY_URL,HOST_CAPABILITY_TOKEN
  --allow-read=/trusted/host   (SDK load)
        ↓
Host Gateway (authoritative capability check)
  session token → capabilities=["chat.broadcast"]
  validate message + call budget
        ↓
API host_commands queue (broadcast_message)
        ↓
SecureBridge (BRIDGE_TOKEN; never in sandbox)
        ↓
Paper → Minecraft chat
```

## Critical distinction

| Layer | What it decides |
|-------|-----------------|
| Deno `--allow-net=host-gateway:3200` | Script may open TCP to the gateway host:port |
| Host Gateway session | Script may invoke `chat.broadcast` (or not) |
| SecureBridge / Paper | Trusted execution of the queued host command |

**Network access to the gateway is NOT authority to perform arbitrary host actions.**

## Docker networks

| Network | Members | Purpose |
|---------|---------|---------|
| `internal` | api, postgres, runner, host-gateway, paper, … | Trusted application network |
| `research-poc-sandbox-host` (`internal: true`) | host-gateway + host-capable sandboxes only | No internet; no postgres/api/paper DNS for sandboxes |

Normal executions (`none`, `read-fixture`, `env-demo`) keep Docker `--network none`.

## Permission profile `host-chat`

Trusted supervisor mapping (clients send the ID only):

```text
deno run --no-prompt
  --import-map=/trusted/import_map.json
  --allow-read=/trusted/host
  --allow-net=host-gateway:3200
  --allow-env=HOST_GATEWAY_URL,HOST_CAPABILITY_TOKEN
  /workspace/main.js
```

Host capabilities recorded separately in the manifest:

```json
{ "hostCapabilities": ["chat.broadcast"] }
```

## Capability credentials

1. Supervisor calls Host Gateway `POST /internal/sessions` with **admin token**
   (never injected into the sandbox).
2. Gateway returns an opaque execution-scoped token for `chat.broadcast`.
3. Supervisor injects `HOST_CAPABILITY_TOKEN` + `HOST_GATEWAY_URL` into the job.
4. After completion/timeout/failure, supervisor revokes the session.
5. TTL fallback: execution timeout + 30s (default ~40s). Configurable via
   `HOST_SESSION_TTL_MS` / session `ttlMs`.

Sandbox must **not** contain: `BRIDGE_TOKEN`, `HOST_GATEWAY_ADMIN_TOKEN`,
API keys, `DATABASE_URL`, Docker socket.

## Script syntax

```js
import { host } from "host";

const result = await host.chat.broadcast("Hello from the sandbox");
console.log(result);
// { accepted: true, commandId, callId, capability }
// accepted = queued — not proof Minecraft displayed the message yet
```

## Validation and budget

- message: non-empty string, max 256 chars (PoC)
- budget: max **5** `chat.broadcast` calls per execution (PoC experimental)
- unknown capability paths → 404 (no dynamic dispatch)
- invalid/missing/expired token → 401

## Events

Trusted gateway evidence (allow/deny known):

- `host_api.requested`
- `host_api.allowed`
- `host_api.denied`
- `host_api.queued`

Source: `host_gateway`. Distinct from neutral Deno `permission.accessed`.

## PoC status

This is a research prototype demonstrating one restricted host capability.
It is not production-ready arbitrary code execution.
