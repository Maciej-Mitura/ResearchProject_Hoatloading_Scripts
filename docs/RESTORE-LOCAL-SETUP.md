# Restore the local workbench

The repository contains the application source, Docker definitions, migrations,
sandbox/bridge sources, Jev integration, and tests. Build outputs and dependencies
are regenerated when building the stack.

After cloning, copy `.env.example` to `.env`, then privately restore your local
settings and credentials. Never commit `.env` or API keys. The example uses mock
chat/execution and deterministic risk by default; select your intended providers.
The validated normal demo uses mock chat, Docker/runc execution and deterministic
advisory analysis. Follow [normal reproduction](REPRODUCTION.md) and the
[demo runbook](DEMO-RUNBOOK.md). Optional model calls are not needed. Current
integrated changes are uncommitted; published HEAD is not this validated state.

```powershell
Copy-Item .env.example .env
# Edit .env privately before starting.
docker compose up -d --build web
```

For Paper, first accept the Minecraft EULA and set `EULA=TRUE`, then run
`docker compose up -d --build paper`. Replace the bridge/gateway token placeholders
with independent local random values.

Open http://localhost:5173. API startup automatically applies database migrations.
For Jev authentication: `npm run jev:preflight` (requires Node.js). This checks
model-list access, not whether classification requests are permitted.

## Local data is separate

A fresh clone does not restore existing conversations, saved scripts, execution
history, project overrides, Minecraft worlds, or machine-local research exports.
Conversations and history live in the PostgreSQL Docker volume, and the Minecraft
world lives in the Paper Docker volume. Keep or privately back up/restore those
volumes separately if you need the same data on a different machine. Restoring
`.env` is also a private step. Do not run `docker compose down -v` if you need to
preserve existing local data.

Ignored frozen evidence, smoke outputs, logs, dependencies, and credentials are
intentionally excluded from GitHub. See `.gitignore` for the complete exclusions.
