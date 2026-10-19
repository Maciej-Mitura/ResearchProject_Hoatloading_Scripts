# Research boundaries

Explicit status of capabilities in this repository foundation.

## KNOWN / IMPLEMENTED

- Docker Compose stack for web, API, PostgreSQL, OTel Collector, mock runner, Paper, bridge builder
- React workbench UI (conversations, scripts, mock execution pipeline, host inspector)
- Deno/Hono API with migrations, seed data, REST endpoints, SSE execution updates
- Chat providers: `MockChatProvider` (default), optional `GeminiChatProvider`, and optional `OpenAIChatProvider`; selection via `CHAT_PROVIDER`
- Mock risk analyzer (advisory metadata only)
- Mock execution state machine (does **not** run script source)
- SecureBridge Paper plugin with tiny allowlisted host API
- HTTP polling bridge transport + shared `BRIDGE_TOKEN` (dev-only)
- OpenTelemetry OTLP export scaffolding from API (best-effort)
- Shared contracts package + bridge JSON Schema v1
- Sample scripts as **text/data only**
- Fixture directory placeholders
- Basic automated tests
- `compose.gvisor.yaml` override documented for future Linux use

## MOCKED

- Generative AI chat when `CHAT_PROVIDER=mock` (`MockChatProvider`); Gemini (preferred) / OpenAI paths are optional and conversational only
- Jev / risk analysis (`MockRiskAnalyzer`) — advisory only
- Untrusted script execution (`MockExecutionService` + mock runner)
- Permission grant/deny enforcement for scripts
- Security telemetry schema / incident reconstruction
- gVisor isolation in normal development

## RESEARCH TODO

- Final sandbox architecture (Deno permissions, mounts, egress, limits, watchdogs)
- Real untrusted execution orchestration + gVisor (`runsc`) experiments on Linux
- Jev integration behind `RiskAnalyzer` (still advisory — never an authorization authority)
- Mandatory security event types, retention, sampling, redaction rules
- Authoritative vs untrusted telemetry sources
- Restricted host API design after literature research (may replace HTTP polling)
- Resource limits and policy values (do not invent prematurely)
- Controlled legitimate / suspicious / malicious fixtures under ethics constraints
- Whether/how script proposals map to host events (e.g. player join → script)

## OUT OF SCOPE (foundation)

- Claiming that arbitrary code execution is currently safe
- Docker socket access from application containers
- Privileged containers
- Broad host filesystem mounts
- Arbitrary shell / console / reflection APIs on the host bridge
- Anthropic providers (Gemini/OpenAI are optional behind `ChatProvider`)
- Browser-side API keys or direct frontend→LLM calls
- Kubernetes, Redis, message brokers, auth providers, vector DBs
- Turning Paper into a hosting platform
- Implementing real exploitation payloads
