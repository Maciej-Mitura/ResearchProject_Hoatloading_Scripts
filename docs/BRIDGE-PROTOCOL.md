# Bridge protocol (v1)

Wire format version: **1**  
Schema: `packages/contracts/schemas/bridge-protocol.v1.json`  
Types: `packages/contracts/src/index.ts`

Transport (current): HTTP polling + heartbeat  
Auth (current): `Authorization: Bearer <BRIDGE_TOKEN>`  
This token is a **local development secret**, not the final security architecture.

## Host → platform

### `POST /api/host/bridge/heartbeat`

Registers/refreshes the active host connection.

```json
{
  "protocolVersion": 1,
  "pluginVersion": "0.1.0",
  "serverVersion": "...",
  "onlinePlayers": 0,
  "maxPlayers": 10,
  "motd": "optional"
}
```

### `POST /api/host/bridge/events`

```json
{
  "protocolVersion": 1,
  "eventType": "player_join",
  "payload": { "playerName": "Steve", "onlinePlayers": 1 }
}
```

`eventType` values: `plugin_started`, `heartbeat`, `player_join`, `player_leave`, `player_chat`, `player_command`, `command_result`.

These are **host observability** events (Paper activity via SecureBridge). They are separate from OpenTelemetry security telemetry, sandbox execution logs, and advisory risk analysis.

`player_command` payloads are sanitized: auth-style commands (`/login`, `/register`, `/password`, …) store arguments as `[REDACTED]`.

## Platform → host

### `GET /api/host/bridge/commands/pending`

Claims pending allowlisted commands (status → `delivered`).

```json
{
  "protocolVersion": 1,
  "commands": [
    {
      "id": "uuid",
      "commandType": "broadcast_message",
      "payload": { "message": "Hello" }
    }
  ]
}
```

### Allowlisted `commandType` values

| Type | Payload | Effect |
|------|---------|--------|
| `broadcast_message` | `{ "message": string }` | Broadcast text in-game |
| `request_status` | `{}` | Return online/max/version/motd |
| `request_player_list` | `{}` | Return player names |

**Not allowed:** console commands, reflection, filesystem, shell, generic execute.

### `POST /api/host/bridge/commands/result`

```json
{
  "protocolVersion": 1,
  "commandId": "uuid",
  "success": true,
  "message": "broadcasted",
  "data": {}
}
```

## Developer enqueue (not bridge-auth)

`POST /api/host/commands` from the workbench/API uses the same allowlist without bridge token (local single-researcher PoC). RESEARCH TODO: tighten once auth model is researched.
