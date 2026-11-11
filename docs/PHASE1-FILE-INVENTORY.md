# Phase 1 file inventory

| File | Purpose |
|---|---|
| `.env.example` | Document blank required independent credentials and pinned model identifiers. |
| `README.md` | Document the current Phase 1 boundaries/provenance and supersede stale descriptions without changing research history. |
| `apps/api/src/db/migrations/009_host_command_provenance.sql` | Add separate trusted origin/correlation columns and unique gateway call identity; preserve old rows as unknown. |
| `apps/api/src/host/provenance.ts` | Validate exact gateway command shape and queue-side trusted correlation. |
| `apps/api/src/middleware/bridge-auth.ts` | Reject default/missing bridge credentials so default tokens cannot forge confirmations. |
| `apps/api/src/providers/execution.ts` | Carry collection status across supervisor responses; label mock/infrastructure observations unavailable. |
| `apps/api/src/repositories/host.ts` | Enqueue only authenticated sandbox mappings bound to API root; constrain confirmation/replay. |
| `apps/api/src/risk/collected-evidence.ts` | Add versioned collection extension without changing frozen evidence schema v1. |
| `apps/api/src/risk/comparison.ts` | Carry collection context alongside unchanged baseline comparison. |
| `apps/api/src/risk/jev-input.ts` | Validate evidence; distinguish secret names/values; expose collection; avoid silent observation truncation. |
| `apps/api/src/risk/jev-policy.ts` | Load the single current policy and compute exact policy hashes. |
| `apps/api/src/risk/jev-route.ts` | Validate explicit routes and provider-specific pinned models; reject moving aliases. |
| `apps/api/src/risk/jev.ts` | Unify offline/live request construction; attach exact provenance; tighten output and latency validation. |
| `apps/api/src/routes/host.ts` | Disable public/debug enqueue and derive confirmation attribution only from trusted stored mapping. |
| `apps/api/src/routes/internal.ts` | Authenticate gateway enqueue and security-event posts without default-token fallback. |
| `apps/api/src/routes/research.ts` | Preserve collection extension/provenance and reconstruct actual language from script version. |
| `apps/api/src/services/mock-execution.ts` | Persist collection state before advisory analysis and attach it to stored assessment context. |
| `apps/api/tests/config_test.ts` | Correct pre-existing stale assertions discovered during full-suite validation. |
| `apps/api/tests/host_activity_db_test.ts` | Focused Phase 1 regression coverage or update existing fixtures for the new explicit boundaries. |
| `apps/api/tests/jev_risk_test.ts` | Focused Phase 1 regression coverage or update existing fixtures for the new explicit boundaries. |
| `apps/api/tests/phase1_boundaries_test.ts` | Focused Phase 1 regression coverage or update existing fixtures for the new explicit boundaries. |
| `apps/api/tests/phase1_bridge_auth_test.ts` | Focused Phase 1 regression coverage or update existing fixtures for the new explicit boundaries. |
| `apps/api/tests/phase1_jev_test.ts` | Focused Phase 1 regression coverage or update existing fixtures for the new explicit boundaries. |
| `apps/api/tests/project_context_test.ts` | Correct pre-existing stale assertions discovered during full-suite validation. |
| `apps/web/src/components/Inspector.tsx` | Disable obsolete direct broadcast and show audit collection status; no layout redesign. |
| `apps/web/src/types.ts` | Represent audit collection on the frontend result type. |
| `compose.yaml` | Require explicit secrets, app-only admin DNS alias and administrative port; keep sandbox transport narrow. |
| `config/jev-risk-policy-v2.md` | Versioned current policy; preserve historical v1 and explain collection uncertainty. |
| `docs/EXECUTION-EVIDENCE.md` | Document the current Phase 1 boundaries/provenance and supersede stale descriptions without changing research history. |
| `docs/HOST-GATEWAY.md` | Document the current Phase 1 boundaries/provenance and supersede stale descriptions without changing research history. |
| `docs/JEV-RISK-COMPARISON.md` | Document the current Phase 1 boundaries/provenance and supersede stale descriptions without changing research history. |
| `docs/OTEL-EXECUTION-RECONSTRUCTION.md` | Document the current Phase 1 boundaries/provenance and supersede stale descriptions without changing research history. |
| `docs/PHASE1-FILE-INVENTORY.md` | Per-file implementation inventory and validation commands. |
| `docs/PHASE1-STABILIZATION.md` | Document the current Phase 1 boundaries/provenance and supersede stale descriptions without changing research history. |
| `package.json` | Expose the no-network frozen-input validation command. |
| `packages/contracts/src/audit-collection.ts` | Define/normalize or derive explicit audit collection state and loss reasons. |
| `packages/contracts/src/index.ts` | Extend result/queue contracts with audit status and trusted provenance. |
| `packages/contracts/src/service-auth.ts` | Central fail-closed credential validation; reject missing, short and placeholder credentials. |
| `research-results/phase1/checks.json` | Add current local validation results; do not overwrite historical research results. |
| `research-results/phase1/input-validation-v2.json` | Add current local validation results; do not overwrite historical research results. |
| `scripts/test-phase1-db.mjs` | Exercise actual migration and repository SQL in isolated embedded PostgreSQL. |
| `scripts/validate-jev-inputs.ts` | Build and validate all retained frozen requests locally without network permission; emit additive summary. |
| `services/host-gateway/Dockerfile` | Copy shared contract/auth modules while preserving their relative import layout. |
| `services/host-gateway/src/api-client.ts` | Use service-authenticated enqueue, not public route or payload _meta. |
| `services/host-gateway/src/config.ts` | Remove known credential fallback and separate administrative URL/bind configuration. |
| `services/host-gateway/src/main.ts` | Separate capability/admin Hono applications and app-interface listener; require explicit independent secrets. |
| `services/host-gateway/tests/admin_boundary_test.ts` | Focused Phase 1 regression coverage or update existing fixtures for the new explicit boundaries. |
| `services/host-gateway/tests/gateway_http_test.ts` | Focused Phase 1 regression coverage or update existing fixtures for the new explicit boundaries. |
| `services/host-gateway/tests/trace_forgery_test.ts` | Focused Phase 1 regression coverage or update existing fixtures for the new explicit boundaries. |
| `services/runner/Dockerfile` | Copy shared contract/auth modules while preserving their relative import layout. |
| `services/runner/src/audit-collection.ts` | Define/normalize or derive explicit audit collection state and loss reasons. |
| `services/runner/src/config.ts` | Remove known credential fallback and separate administrative URL/bind configuration. |
| `services/runner/src/docker.ts` | Derive collection state and ensure failure cleanup; drain/start timeout before source writes. |
| `services/runner/src/frames.ts` | Distinguish complete, absent, malformed and duplicate framing. |
| `services/runner/src/gateway.ts` | Use app-only administration endpoint and explicit credential; bound service-call deadlines. |
| `services/runner/src/main.ts` | Return explicit collection status, including Docker-unavailable errors. |
| `services/runner/tests/audit_collection_test.ts` | Focused Phase 1 regression coverage or update existing fixtures for the new explicit boundaries. |
| `services/runner/tests/docker_integration_test.ts` | Focused Phase 1 regression coverage or update existing fixtures for the new explicit boundaries. |

## Validation commands

Run from the repository root with Deno 2.1.4 on PATH (the audit used a workspace-local runtime).

```sh
deno check --no-lock apps/api/src/main.ts services/runner/src/main.ts services/host-gateway/src/main.ts
deno test --no-lock --allow-read --allow-env --allow-net=127.0.0.1,localhost,api,host-gateway,host-gateway-admin --allow-run --allow-sys --allow-write services/runner/tests/ services/host-gateway/tests/ apps/api/tests/
deno run --no-lock --allow-read --allow-env --allow-write=research-results/phase1 scripts/validate-jev-inputs.ts
node apps/web/node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/web/tsconfig.json
cd apps/web
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1
```

Embedded SQL test, from repository root, with PGlite 0.3.14 installed separately:

```sh
node --experimental-strip-types scripts/test-phase1-db.mjs /absolute/path/to/pglite/dist/index.js
```

Compose configuration was checked with three synthetic (non-production) environment credentials:

```sh
docker compose config --quiet
```

Results: 160 Deno passes, 0 failures, 23 ignored (22 Docker; 1 deployed DB); 13 frontend passes; 25/25 offline inputs; embedded PostgreSQL SQL checks pass. All type checks and Compose configuration pass. Docker runtime tests remain unavailable. See `research-results/phase1/checks.json`.

No commits, pushes, deployments, real Jev calls or gVisor experiments were performed.
