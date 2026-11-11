# Configuratiereferentie

Bronnen `.env.example`, `compose.yaml`, `services/runner/src/config.ts`, `services/host-gateway/src/config.ts`, `apps/api/src/providers/chat.ts` en `apps/api/src/risk/jev-route.ts`. De tabel bevat defaults of voorbeelden. Er zijn geen live geheimen gelezen. Compose stuurt niet iedere gecommentarieerde variabele automatisch door. Voor geavanceerde overrides is gerichte serviceconfig nodig. Browser-API-URL is buildtijd; provider- en serviceconfig worden bij processtart gelezen. Settings-overrides zijn DB-applicatiecontext en vereisen geen nieuwe containerbuild.

## Stack en database

| Variabele | Vereist | Default | Doel | Geheim | Gebruikt door |
|---|---|---|---|---|---|
| `WEB_PORT` | nee | 5173 | hostpoort web | nee | Compose |
| `API_PORT` | nee | 3000 | hostpoort API; container op 3000 | nee | Compose/API |
| `VITE_API_URL` | bij afwijkende API-poort | http://localhost:3000 | browserdoel, buildtijd | nee | web |
| `POSTGRES_USER` | nee | poc | DB-gebruiker | nee | PostgreSQL/API |
| `POSTGRES_PASSWORD` | eigen waarde bij gedeeld gebruik | voorbeeldwaarde in .env.example | DB-authenticatie | ja | PostgreSQL/API |
| `POSTGRES_DB` | nee | research_poc | DB-naam | nee | PostgreSQL/API |
| `DATABASE_URL` | directe API-start | Compose construeert URL | DB-verbinding | ja | API |
| `PROJECT_CONFIG_DIR` | nee | image/projectconfig | locatie Assistant-projectcontext | nee | API |

## Host en Paper

| Variabele | Vereist | Default | Doel | Geheim | Gebruikt door |
|---|---|---|---|---|---|
| `BRIDGE_TOKEN` | ja | geen | Bridge-API-auth | ja | Paper/API |
| `HOST_GATEWAY_ADMIN_TOKEN` | ja | geen | sessiebeheer | ja | runner/Gateway |
| `HOST_GATEWAY_SERVICE_TOKEN` | ja | geen | internal API-auth | ja | Gateway/API |
| `HOST_GATEWAY_PORT` | nee | 3200 | capabilitylistener | nee | Gateway |
| `HOST_GATEWAY_ADMIN_BIND_HOST` | nee | host-gateway-admin in Compose | admin-interface | nee | Gateway |
| `API_BASE_URL` | nee | http://api:3000 in Compose | Gateway naar API | nee | Gateway |
| `BRIDGE_API_URL` | nee | http://api:3000 in Compose | Paper naar API | nee | Paper |
| `HOST_CHAT_BROADCAST_BUDGET` | nee | 5 | legacy quota | nee | Gateway |
| `HOST_CHAT_BROADCAST_MAX_LEN` | nee | 256 | legacy berichtlengte | nee | Gateway |
| `HOST_SESSION_TTL_MS` | nee | 40000 | standaard sessieduur | nee | Gateway |
| `HOST_SESSION_MAX_TTL_MS` | nee | 120000 | bovengrens sessieduur | nee | Gateway |
| `EULA` | voor Paper | FALSE in voorbeeld; Compose fallback TRUE | expliciete Minecraft-acceptatie | nee | Paper |
| `MC_VERSION` | nee | 1.21.1 | Minecraft-versie | nee | Paper |
| `MEMORY` | nee | 1G | Paper-geheugen, los van jobs | nee | Paper |
| `ONLINE_MODE` | nee | false | Paper-identiteitsmodus voor lokale PoC | nee | Paper |
| `MOTD` | nee | Research PoC Paper Server | serverbeschrijving | nee | Paper |
| `MAX_PLAYERS` | nee | 10 | spelerlimiet | nee | Paper |
| `VIEW_DISTANCE` | nee | 8 | view distance | nee | Paper |
| `MC_PORT` | nee | 25565 | gepubliceerde Minecraft-poort | nee | Compose |

## Assistant en Jev

| Variabele | Vereist | Default | Doel | Geheim | Gebruikt door |
|---|---|---|---|---|---|
| `CHAT_PROVIDER` | expliciet voor Assistant | mock in .env.example; Compose leeg indien oningesteld | mock/gemini/openai | nee | API |
| `GEMINI_API_KEY` | bij Gemini | geen | providercredential | ja | API |
| `GEMINI_MODEL` | nee | gemini-3.8-flash | Gemini-model | nee | API |
| `OPENAI_API_KEY` | bij OpenAI | geen | providercredential | ja | API |
| `OPENAI_MODEL` | nee | gpt-5.5 | OpenAI-model | nee | API |
| `RISK_ANALYZER` | nee | deterministic | mock/deterministic/jev/comparison | nee | API |
| `JEV_PROVIDER` | nee | typesafe in code; vercel in voorbeeld | providerprotocol | nee | API |
| `AI_GATEWAY_API_KEY` | bij Vercel | geen | gatewaycredential | ja | API |
| `TYPESAFE_API_KEY` | bij directe TypeSafe | geen | directe credential | ja | API |
| `JEV_API_KEY` | legacy alias | geen | directe credential | ja | API |
| `JEV_MODEL` | nee | providerafhankelijk; 1.14.0 | gekozen model | nee | API |
| `JEV_API_URL` | nee | providerroute | classificatie-endpoint override | nee | API |
| `JEV_MODELS_URL` | nee | providerroute | modellijst override | nee | API |
| `JEV_TIMEOUT_MS` | nee | 30000 | providerdeadline | nee | API |

## Uitvoering, gVisor en OTel

| Variabele | Vereist | Default | Doel | Geheim | Gebruikt door |
|---|---|---|---|---|---|
| `EXECUTION_PROVIDER` | nee | mock | mock of docker | nee | API |
| `EXECUTION_SUPERVISOR_URL / RUNNER_URL` | bij losse deployment | http://runner:3100 in Compose | runner endpoint; tweede legacy | nee | API |
| `RUNNER_PORT` | nee | 3100 | interne runnerpoort | nee | runner |
| `SANDBOX_IMAGE` | nee | research-poc-sandbox:local | jobimage | nee | runner |
| `SANDBOX_DENO_VERSION` | nee | 2.9.7 | verwachte Deno-versie | nee | runner |
| `SANDBOX_TIMEOUT_MS` | nee | 10000 | jobdeadline | nee | runner |
| `SANDBOX_MAX_ACTIVE` | nee | 2 | admissiecapaciteit | nee | runner |
| `SANDBOX_MAX_OUTPUT_BYTES` | nee | 1048576 | capturebudget | nee | runner |
| `SANDBOX_AUDIT_MAX_EVENTS / SANDBOX_AUDIT_MAX_BYTES` | nee | 200 / 65536 | auditbudget | nee | runner |
| `SANDBOX_CPUS / SANDBOX_MEMORY / SANDBOX_PIDS_LIMIT` | nee | 0.5 / 256m / 64 | resourcegrenzen | nee | runner |
| `SANDBOX_WORKSPACE_TMPFS / SANDBOX_TMP_TMPFS` | nee | 64m / 16m | tijdelijke filesystems | nee | runner |
| `SANDBOX_MAX_SOURCE_BYTES` | nee | 524288 | brongrootte | nee | runner |
| `SANDBOX_HOST_NETWORK` | nee | research-poc-sandbox-host | netwerk voor hostjobs | nee | runner |
| `SANDBOX_DOCKER_RUNTIME` | nee | leeg; Engine-default | eventueel runsc | nee | runner |
| `HOST_GATEWAY_URL / HOST_GATEWAY_SANDBOX_URL` | nee | interne admin- en capability-URL | gescheiden Gateway-doelen | nee | runner/SDK |
| `HOST_GATEWAY_NET_ALLOW` | nee | host-gateway:3200 | smalle Deno-netgrant | nee | runner/entrypoint |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | nee | http://otel-collector:4318 in Compose | OTLP HTTP | nee | API |
| `OTEL_SERVICE_NAME` | nee | research-api in Compose | servicelabel | nee | API |
| `HOST_CAPABILITY_TOKEN` | door runtime | per sessie | korte execution-credential | ja | SDK/Gateway |
| `DENO_AUDIT_PERMISSIONS / DENO_DIR` | door runtime | tijdelijke jobpaden | audit en cache | nee | entrypoint |
| `SANDBOX_WORKDIR / SCRIPT_LANGUAGE / SCRIPT_PROJECT / PERMISSION_PROFILE` | door runtime | per vertrouwde jobconfig | workspace, parser, snapshot en grants | nee | runner/entrypoint |
| `SANDBOX_DEMO_VALUE` | door profiel | vaste demowaarde | begrensde env-demo | nee | runner |

