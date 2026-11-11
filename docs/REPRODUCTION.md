# Normal application reproduction

## Source and prerequisites

Use the current integrated source snapshot, Git and Docker Compose v2 with Linux
containers. Docker builds supply Node 22, Deno API/runner 2.1.4 and sandbox 2.9.7,
Java 21/Gradle, PostgreSQL 16 and nginx. Network downloads/build caches are normal.
No AI subscription or local language toolchain is required for the demo.

Phases 1–6 changes are uncommitted. Cloning published HEAD alone does not yet
reproduce this state. Phase 5 validated fresh data and independently built images
from the working tree with fresh DB/Paper/plugin volumes, not published-HEAD,
offline or no-cache reproducibility. Publication remains a separate reviewed step.

## Environment and secrets

```powershell
Copy-Item .env.example .env
# Generate independently, once for each of the three service secrets and DB password:
$demoRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$demoBytes = New-Object byte[] 32
$demoRandom.GetBytes($demoBytes)
[BitConverter]::ToString($demoBytes).Replace('-', '').ToLowerInvariant()
$demoRandom.Dispose()
```

Assign distinct generated values to `BRIDGE_TOKEN`, `HOST_GATEWAY_ADMIN_TOKEN`,
`HOST_GATEWAY_SERVICE_TOKEN` (each at least 32 characters), and a private URL-safe
`POSTGRES_PASSWORD`. Do not print/share populated `.env`, store it in Git or pass
it wholesale into job containers. Compose constructs DATABASE_URL from POSTGRES
settings; changing password does not reset an already initialized DB volume.

The following is an intentional offline/reproducibility configuration, not the normal generative assistant selection. Preserve your usual real-provider configuration unless you intend to use the offline mock.

Set `EXECUTION_PROVIDER=docker`, `CHAT_PROVIDER=mock`,
`RISK_ANALYZER=deterministic`, leave `SANDBOX_DOCKER_RUNTIME` empty. `.env.example`
retains an explicit mock execution option, which does not run source. No optional
provider keys are needed. Keep `VITE_API_URL` aligned with API_PORT; rebuild web
when changing it. Ports default to API 3000, web 5173, Paper 25565 and are published
on all interfaces; use only a trusted local development machine/network.

## Build, migration and startup

```bash
docker compose config --quiet
docker compose up -d --build web
docker compose ps
```

Do not print expanded Compose configuration because it includes credentials.
API startup applies numbered SQL migrations automatically. Migration 010 creates
current demo versions only for exact untouched stock seed versions; user-edited
scripts and historical versions/executions remain intact. Explicit migration check:

```bash
docker compose exec api deno run --allow-net --allow-env --allow-read src/db/migrate.ts
```

Verify `/health` reports DB ok and `/api/config/public` reports Docker. The normal
sandbox image builds once; each execution creates and removes a fresh job.
Use a new Compose project/fresh volumes for independent reproduction only with
isolated host ports, sandbox network name and image tags, as shown in
[the Phase 5 override](../compose.phase5-repro.yaml). That override also requires
an independent `.env.phase5-repro` with the same secret/settings expectations.
It is not required for a normal single stack. Never reset existing working volumes.

## Paper / SecureBridge

Read the Minecraft EULA and personally accept it before setting `EULA=TRUE`.
Then `docker compose up -d --build paper`. Compose's one-shot Gradle builder
populates the plugin volume; Paper downloads its configured version on first
startup. Wait for “Done” in `docker compose logs --tail=100 paper` and
`GET /api/host/status` connected=true. A matching Java Edition 1.21.1 client is
optional for viewing messages in-game. ONLINE_MODE=false is local testing only.

## First executions and host verification

Follow the [demo runbook](DEMO-RUNBOOK.md): normal source with none; caught
`/etc/hosts` read with none; host broadcast with host-chat. All five sample files
are in [samples](../samples/README.md). Use their profile IDs explicitly.
Confirm stdout/status/audit collection and advisory result. For host calls,
accepted means queued: verify Paper `server_broadcast` and `host.command.result`
with matching IDs. No direct UI enqueue path exists.

## Tests

Container commands (build first). Standard Deno tests use network dependency
resolution; Jev adapter tests mock provider fetch and do not spend credits.

```bash
docker compose exec api deno test --no-lock --allow-env --allow-read --allow-write --allow-net --allow-sys tests/
docker compose exec runner deno test --no-lock --allow-env --allow-read --allow-write --allow-net --allow-sys --ignore=tests/docker_integration_test.ts tests/
docker compose exec host-gateway deno test --no-lock --allow-env --allow-read --allow-write --allow-net --allow-sys tests/
docker compose exec -e HOST_ACTIVITY_DB_TEST=1 api deno test --no-lock --allow-net --allow-env --allow-read tests/host_activity_db_test.ts
docker compose exec runner deno test --no-lock --allow-env --allow-net --allow-read --allow-write --allow-run=docker tests/docker_integration_test.ts
docker compose run --rm --no-deps --entrypoint gradle bridge-builder --no-daemon test
```

Frontend source tests need Node 22 and npm locally, or equivalent disposable Node
container with source mounted. The served nginx image has no source test toolchain:

```bash
cd apps/web
npm ci
npm test
npx tsc --noEmit
```

API tests have one guarded PostgreSQL test skipped by default; execute it separately
with HOST_ACTIVITY_DB_TEST=1 as above. Record skipped/unavailable checks distinctly.
Do not run risk-freeze or benchmark scripts to prepare an ordinary demo; they can
write experiment artifacts or invoke providers. Verify existing manifests offline.

## Stop and separate experimental setup

`docker compose stop` preserves services/data; `docker compose down` removes
containers/networks but retains named volumes. `down -v` deletes DB/world/plugin
data and is not needed for cleanup or the demo.

Native Ubuntu/WSL runsc setup is separate: [Phase 4A](PHASE4A-NATIVE-WSL.md) and
[Linux setup](PHASE4-LINUX-SETUP.md). Read [gVisor findings](GVISOR.md) before using
it; W8 host-chat DNS incompatibility remains. No new setup/fix/benchmark is required.
