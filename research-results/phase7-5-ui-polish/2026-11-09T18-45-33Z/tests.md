# Validation
Final final automated test-case invocations: PASS 150; FAIL 0; SKIPPED 2; UNAVAILABLE 0.
- API: 107 passed, 0 failed, 2 ignored locally (database opt-in).
- Frontend: 41 passed, 0 failed, 0 skipped. Includes evidence states, missing metadata, zero observations, all advisory labels/failures, scoped history, stale response, host correlation/absence/failure, dirty Run, draft navigation/StrictMode, settings autosave and linked-assessment identity; existing proposal/conversation/host filtering tests preserved/adapted.
- Deployed PostgreSQL: history projection 1 passed and host activity 1 passed. Fixtures rolled back; both local ignored tests resolved here.
- Frontend tsc --noEmit and production tsc+Vite build PASS, API/web Docker build/redeploy PASS, Compose config --quiet PASS.
- Five fresh real runc sample executions PASS; host-chat Paper-confirmed. No paid Jev calls or gVisor benchmark reruns.
- Runner/shared type/Docker integration condition not triggered: no shared/runner/contract changes. These suites not rerun; normal live Docker execution validated.
- Dependency audit: production 0; existing development toolchain 6 findings (3 moderate, 1 high, 2 critical: Vitest/Vite/tinypool/esbuild dependency tree). Broad toolchain upgrade outside this UI phase; local dev services should not be exposed as a production server. Static nginx production image serves build output.

Initial Docker engine unavailable and a dependency-less redeploy failed while PostgreSQL was stopped. Docker Desktop and existing Compose services restored without deleting volumes, then build/redeploy passed. Earlier automatic approval review briefly failed on usage allowance; user explicitly requested continuation. A test-only unsupported Testing Library option was caught by production TypeScript checking and corrected; the final build passes. A browser polling fetch failed during controlled API restart, then the settled deployment reloaded without error. Final logs are additive in this package; no previous research evidence overwritten.
