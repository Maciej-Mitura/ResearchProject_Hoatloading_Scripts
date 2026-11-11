# E8 final host-capability chain

Execution `bb1822d2-d658-41f9-a9fe-75c37b5f6bb8`; trace `7084637143e659da97f96bfe2d550a87`; call `799569a8-fb01-4293-bb7b-4c7e2d71d517`; command `c623b4d3-eadc-45cc-ac95-7054f8e9d35d`.

| Arrow | Evidence class | Evidence / limit |
|---|---|---|
| User/script request -> execution ID | empirically observed | API-created script/version and durable execution (executions/E8.json) |
| Execution ID -> admission | inferred from trusted stored relationship | Current mandatory admission path; E8 starts and completes; actual occupied bound tested separately (admission-regression.json) |
| Admission -> runner | inferred from trusted stored relationship | Trusted API Docker provider calls deployed runner; deployed sources match (deployed-source-integrity.json) |
| Runner -> container/runtime | empirically observed | Docker events and create/start inspections: runc, fixed image and resource controls (executions/E8.json) |
| Container -> Deno profile | empirically observed | Deno 2.9.7, host-chat manifest, native permission records and successful scoped SDK call (executions/E8.json) |
| Deno profile -> capability session | inferred from trusted stored relationship | Runner mints/revokes a scoped gateway session; gateway accepts E8 call. Token value deliberately not recorded (services/runner/src/gateway.ts) |
| Capability session -> Host Gateway call ID | empirically observed | host_api.requested/allowed share trusted execution and call IDs (executions/E8.json) |
| Gateway call -> API enqueue | empirically observed | host_api.queued names command; unauthorized and forged mapping routes separately rejected (security-boundaries.json) |
| API enqueue -> PostgreSQL command ID | empirically observed | origin=sandbox_capability and exact execution/trace/call/capability mapping in DB (executions/E8.json) |
| Command -> SecureBridge poll/delivery | inferred from trusted stored relationship | Completed command, authenticated confirmation and plugin handling imply delivery. No independent poll packet capture or persisted delivery timestamp (apps/api/src/repositories/host.ts) |
| SecureBridge -> Paper execution | empirically observed | server_broadcast event plus successful broadcasted command result, not merely queued acceptance (executions/E8.json) |
| Paper execution -> bridge confirmation | empirically observed | completed command and server_broadcast event agree on command ID and message (executions/E8.json) |
| Bridge confirmation -> security evidence | empirically observed | Late host.command.result uses the same trusted command/call/trace mapping (executions/E8.json) |
| Execution evidence -> deterministic advisory | empirically observed | assessmentStatus=ok, low, analyzerVersion=1; stored separately from completed execution (executions/E8.json) |
| Execution/advisory -> OTel export | empirically observed | Actual collector receipt of execution and sandbox.run, host_api and risk.classified events with matching trace (otel-validation.json) |
| Late Paper confirmation -> complete distributed Paper trace | configuration only | NOT OBSERVED: late host.command.result remains PostgreSQL evidence; no exported Paper span (otel-validation.json) |
