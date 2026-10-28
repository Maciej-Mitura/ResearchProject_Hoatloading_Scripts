# Restore the local workbench

The repository contains the application source, Docker definitions, migrations,
sandbox/bridge sources, Jev integration, and tests. Build outputs and dependencies
are regenerated when building the stack.

After cloning, copy `.env.example` to `.env`, then privately restore your local
settings and credentials. Never commit `.env` or API keys. The example uses mock
chat/execution and deterministic risk by default; select your intended providers.
The latest observed development stack used Gemini chat, Docker execution, and
deterministic risk. To enable Jev assessment use `RISK_ANALYZER=jev`,
`JEV_PROVIDER=vercel`, `JEV_MODEL=typesafe-ai/jev-1.14.0`, and your private
`AI_GATEWAY_API_KEY`. Gemini requires your private `GEMINI_API_KEY`.

```powershell
Copy-Item .env.example .env
# Edit .env privately before starting.
docker compose up -d --build
```

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
