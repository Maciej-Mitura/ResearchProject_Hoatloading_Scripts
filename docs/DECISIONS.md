# Decisions

| Decision | Rationale |
|----------|-----------|
| All application services are Dockerized | Developers need only Git, Docker Compose, and a Minecraft client |
| gVisor is a host Docker runtime, not a Compose “app” | Matches how `runsc` works; keeps Windows/macOS usable |
| AI chat uses `MockChatProvider` | No API keys; literature research still ongoing |
| Jev is a second **advisory** `RiskAnalyzer` (TypeSafe System One Choice) | Must never grant permissions or override deterministic denies; compare only on shared `ExecutionEvidenceRecord` |
| Initial restricted Docker/Deno execution is optional via `EXECUTION_PROVIDER` | Default stays `mock` for safer UI work; docker mode is an explicit prototype |
| Only the trusted supervisor mounts docker.sock | API/web/Paper/sandbox jobs must not control the Docker Engine |
| Supervisor rejects client Docker options | Fixed image/limits/runtime prevent API-driven privilege escalation |
| gVisor runtime selected centrally for job containers | Future `runsc` experiments without changing the API contract |
| Sandbox scripts do not call SecureBridge yet | Next milestone after real execution works |
| Paper is a replaceable PoC host | Minecraft is demonstration infrastructure, not the research subject |
| Bridge API is deliberately tiny | Unrestricted host control would undermine the architecture |
| Security policy values are not invented early | Literature research still defines requirements |
| PostgreSQL via migrations (no auto-sync) | Explicit, reviewable schema |
| No auth provider / Redis / K8s / brokers | Out of scope for single-researcher local PoC |
| SSE for execution updates | One-way status stream; WebSocket not required yet |
| Official Deno & OTel images | Avoid ad-hoc installs inside unrelated base images |
| Shared contracts package + JSON Schema | Keep wire formats versioned and documented |
