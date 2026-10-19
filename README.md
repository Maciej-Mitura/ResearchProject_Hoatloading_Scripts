# Research PoC — Defense-in-Depth Script Host Foundation

Bachelor Multimedia & Creative Technology / Next Web Developer research project foundation.

## Research question (approved direction)

> In welke mate kan een defense-in-depth architectuur met Deno-permissies, gVisor-isolatie, Jev-gebaseerde risicoanalyse en OpenTelemetry-observability risico’s detecteren, isoleren en beperken bij het uitvoeren van dynamisch geladen, onbetrouwbare scripts die via een beperkte API interageren met een actieve hostapplicatie?

**Literature research is still ongoing.** This repository is the PoC **foundation**. It does **not** claim a finished security solution and does **not** execute arbitrary uploaded scripts.

Minecraft/Paper is a **replaceable demonstration host**, not the research subject.

## What is implemented now

- Dockerized stack: web, API, PostgreSQL, OpenTelemetry Collector, mock runner, Paper, SecureBridge builder
- React workbench UI (chat, scripts, mock execution pipeline, host inspector, Project Settings, How to use panel)
- Deno + Hono API with migrations, seed data, SSE
- **Project context system**: `config/project-spec.yaml` + DB overrides → effective settings grounded into every AI turn (see [`docs/PROJECT-CONTEXT.md`](docs/PROJECT-CONTEXT.md))
- Chat providers: mock (default) or optional Gemini (`CHAT_PROVIDER=gemini`); OpenAI remains an optional alternative
- Mock advisory risk analysis + mock execution state machine
- Minimal SecureBridge Paper plugin (allowlisted host commands only)
- Shared contracts + docs describing trust boundaries

## What is mocked / deferred

See [`docs/RESEARCH-BOUNDARIES.md`](docs/RESEARCH-BOUNDARIES.md).

In short: execution/sandbox/Jev remain mocked; gVisor is optional on Linux; **no arbitrary script execution**. Chat can stay mock or use Gemini.

## Required software

- Git
- Docker + Docker Compose
- Minecraft Java Edition client (to join the local Paper server)
- Node.js 18+ only if you use `npm run dev` on the host (optional; Docker alone is enough)

You do **not** need local Deno, Java, or PostgreSQL to start the stack.

## Quick start

```bash
cp .env.example .env
# Optionally edit BRIDGE_TOKEN (do not commit .env)

docker compose up --build
# or: npm run dev / npm run dev:build
```

First start downloads Paper and builds images; this can take several minutes.

### Chat providers (mock vs Gemini)

The API selects the provider from `.env` (passed only into the **api** container). The browser never receives the API key.

**Mock mode (default — no key required):**

```env
CHAT_PROVIDER=mock
```

```bash
docker compose up --build
# or recreate only the API after editing .env:
docker compose up -d --build api
```

Open http://localhost:5173 — the chat header shows `Assistant · Mock`.

**Gemini mode:**

```env
CHAT_PROVIDER=gemini
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-3.8-flash
```

Then recreate the API (and web if you rebuilt UI) so Compose injects the new env:

```bash
docker compose up -d --build api web
```

Open http://localhost:5173. Confirm `Assistant · Gemini` (and the model name) in the chat header. Send:

> Hello. Briefly explain what you can help me do in this application.

Your message should appear on the **right**; the assistant reply on the **left**. Refresh the conversation — the reply should still be there (Postgres is the source of truth).

How to tell Gemini from mock: the header shows `Gemini`, `GET http://localhost:3000/api/config/public` returns `{"chatProvider":"gemini","chatModel":"..."}` (never an API key), and mock-only keyword scripts (e.g. forced “welcome” demos) no longer apply.

### Endpoints (host)

| Service | URL |
|---------|-----|
| Web UI | http://localhost:5173 |
| API health | http://localhost:3000/health |
| Minecraft | `localhost:25565` |

PostgreSQL and the OTel Collector stay on the internal Docker network by default.

### Connect Minecraft

1. Wait until the `paper` container finishes starting (look for “Done” in logs).
2. Minecraft Java Edition → Multiplayer → Add Server → `localhost` (port 25565).
3. `ONLINE_MODE=false` by default for local offline testing.

### Verify bridge

```bash
curl -s http://localhost:3000/api/host/status
```

When SecureBridge is loaded and heartbeating, `"connected": true`.

Queue a broadcast (appears in-game if you are online):

```bash
curl -s -X POST http://localhost:3000/api/host/commands \
  -H "Content-Type: application/json" \
  -d '{"commandType":"broadcast_message","payload":{"message":"Hello from API"}}'
```

## Stop / reset

```bash
docker compose down
```

Destroy volumes (DB + world + built plugin JAR volume):

```bash
docker compose down -v
# or: sh scripts/reset.sh
```

## Logs

```bash
docker compose logs -f api web paper otel-collector
docker compose logs -f paper   # SecureBridge + server
docker compose logs otel-collector | findstr /i mock.execution
```

## Tests

Backend unit tests (inside API image):

```bash
docker compose run --rm --no-deps api deno test --allow-net --allow-env --allow-read --allow-sys tests/
```

Bridge unit tests (inside builder image):

```bash
docker compose run --rm --no-deps bridge-builder gradle test --no-daemon
```

Frontend unit tests (Node container):

```bash
docker compose run --rm --no-deps -w /app web sh -c "cd /usr/share/nginx/html && echo 'built image has no vitest; use build stage'"
```

Preferred frontend test via one-off Node:

```bash
docker run --rm -v "%CD%/apps/web:/app" -w /app node:22-alpine sh -c "npm install && npm test"
```

API smoke (stack running):

```bash
# Git Bash / WSL / Linux:
sh scripts/smoke.sh
```

## gVisor (Linux only, optional)

Normal development does **not** need gVisor. See [`docs/GVISOR.md`](docs/GVISOR.md).

```bash
docker compose -f compose.yaml -f compose.gvisor.yaml up
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PROJECT-CONTEXT.md`](docs/PROJECT-CONTEXT.md)
- [`docs/RESEARCH-BOUNDARIES.md`](docs/RESEARCH-BOUNDARIES.md)
- [`docs/BRIDGE-PROTOCOL.md`](docs/BRIDGE-PROTOCOL.md)
- [`docs/GVISOR.md`](docs/GVISOR.md)
- [`docs/DECISIONS.md`](docs/DECISIONS.md)

## Security notes (read this)

- Do not expose this stack to the public internet.
- `BRIDGE_TOKEN` is a local shared secret — not a final auth architecture.
- Mock risk scores never grant permissions.
- Uploaded script source is stored as data and is **not** executed by this foundation.
- No Docker socket mounts, no privileged containers, no unrestricted host commands.

## Bridge rebuild

If you change the Java plugin:

```bash
docker compose run --rm bridge-builder
docker compose up -d paper
```

`docker compose up --build` also rebuilds the bridge when the builder service runs.
