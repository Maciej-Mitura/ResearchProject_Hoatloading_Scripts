# Phase 8 source-publication checklist — recommendations only

No files staged, committed, pushed, deleted or published. Exact paths for all categories are in `publication-checklist.json`. Pending-file scope includes modified/deleted tracked, untracked and ignored files; unchanged tracked files are already source-controlled.

- **SHOULD COMMIT: 138 file entries**
- **SHOULD NOT COMMIT: 6209 file entries**
- **LOCAL/SECRET: 3 file entries**
- **GENERATED/RESULTS: 1138 file entries**

## SHOULD COMMIT

- `.env.example` (modified/deleted tracked)
- `README.md` (modified/deleted tracked)
- `apps/api/src/db/migrations/009_host_command_provenance.sql` (untracked)
- `apps/api/src/db/migrations/010_truthful_demo_examples.sql` (untracked)
- `apps/api/src/host/provenance.ts` (untracked)
- `apps/api/src/middleware/bridge-auth.ts` (modified/deleted tracked)
- `apps/api/src/project/assistant-context-builder.ts` (modified/deleted tracked)
- `apps/api/src/project/schema.ts` (modified/deleted tracked)
- `apps/api/src/providers/chat-instructions.ts` (modified/deleted tracked)
- `apps/api/src/providers/chat.ts` (modified/deleted tracked)
- `apps/api/src/providers/execution.ts` (modified/deleted tracked)
- `apps/api/src/repositories/executions.ts` (modified/deleted tracked)
- `apps/api/src/repositories/host.ts` (modified/deleted tracked)
- `apps/api/src/risk/collected-evidence.ts` (untracked)
- `apps/api/src/risk/comparison.ts` (modified/deleted tracked)
- `apps/api/src/risk/jev-input.ts` (modified/deleted tracked)
- `apps/api/src/risk/jev-policy.ts` (untracked)
- `apps/api/src/risk/jev-route.ts` (modified/deleted tracked)
- `apps/api/src/risk/jev.ts` (modified/deleted tracked)
- `apps/api/src/routes/host.ts` (modified/deleted tracked)
- `apps/api/src/routes/internal.ts` (modified/deleted tracked)
- `apps/api/src/routes/research.ts` (modified/deleted tracked)
- `apps/api/src/services/advisory.ts` (untracked)
- `apps/api/src/services/mock-execution.ts` (modified/deleted tracked)
- `apps/api/tests/config_test.ts` (modified/deleted tracked)
- `apps/api/tests/host_activity_db_test.ts` (modified/deleted tracked)
- `apps/api/tests/jev_risk_test.ts` (modified/deleted tracked)
- `apps/api/tests/phase1_boundaries_test.ts` (untracked)
- `apps/api/tests/phase1_bridge_auth_test.ts` (untracked)
- `apps/api/tests/phase1_jev_test.ts` (untracked)
- `apps/api/tests/phase1_result_mapping_test.ts` (untracked)
- `apps/api/tests/phase2_advisory_test.ts` (untracked)
- `apps/api/tests/project_context_test.ts` (modified/deleted tracked)
- `apps/api/tests/providers_test.ts` (modified/deleted tracked)
- `apps/web/src/App.test.tsx` (modified/deleted tracked)
- `apps/web/src/App.tsx` (modified/deleted tracked)
- `apps/web/src/api/client.ts` (modified/deleted tracked)
- `apps/web/src/components/HelpPanel.tsx` (modified/deleted tracked)
- `apps/web/src/components/Inspector.tsx` (modified/deleted tracked)
- `apps/web/src/components/ProjectSettingsPanel.tsx` (modified/deleted tracked)
- `apps/web/src/inspector.test.tsx` (modified/deleted tracked)
- `apps/web/src/types.ts` (modified/deleted tracked)
- `compose.phase4bc.yaml` (untracked)
- `compose.phase5-repro.yaml` (untracked)
- `compose.yaml` (modified/deleted tracked)
- `config/assistant-policy.md` (modified/deleted tracked)
- `config/jev-risk-policy-v2.md` (untracked)
- `config/project-spec.yaml` (modified/deleted tracked)
- `docs/ARCHITECTURE.md` (modified/deleted tracked)
- `docs/DECISIONS.md` (modified/deleted tracked)
- `docs/DEMO-RUNBOOK.md` (untracked)
- `docs/EXECUTION-EVIDENCE.md` (modified/deleted tracked)
- `docs/GVISOR-EXPERIMENT.md` (modified/deleted tracked)
- `docs/GVISOR.md` (modified/deleted tracked)
- `docs/HOST-GATEWAY.md` (modified/deleted tracked)
- `docs/JEV-RISK-COMPARISON.md` (modified/deleted tracked)
- `docs/OTEL-EXECUTION-RECONSTRUCTION.md` (modified/deleted tracked)
- `docs/PHASE1-FILE-INVENTORY.md` (untracked)
- `docs/PHASE1-STABILIZATION.md` (untracked)
- `docs/PHASE2-EXECUTION-RELIABILITY.md` (untracked)
- `docs/PHASE4-LINUX-SETUP.md` (untracked)
- `docs/PHASE4A-NATIVE-WSL.md` (untracked)
- `docs/PROJECT-CONTEXT.md` (modified/deleted tracked)
- `docs/PUBLICATION-REVIEW.md` (modified/deleted tracked)
- `docs/REPRODUCTION.md` (untracked)
- `docs/RESEARCH-BOUNDARIES.md` (modified/deleted tracked)
- `docs/RESEARCH-STATUS.md` (untracked)
- `docs/RESTORE-LOCAL-SETUP.md` (modified/deleted tracked)
- `package.json` (modified/deleted tracked)
- `packages/contracts/src/audit-collection.ts` (untracked)
- `packages/contracts/src/deadline.ts` (untracked)
- `packages/contracts/src/index.ts` (modified/deleted tracked)
- `packages/contracts/src/service-auth.ts` (untracked)
- `samples/README.md` (untracked)
- `samples/scripts/allowed-fixture.ts` (untracked)
- `samples/scripts/caught-restricted-read.js` (untracked)
- `samples/scripts/demo-environment.ts` (untracked)
- `samples/scripts/host-status-query.js` (modified/deleted tracked; stage deletion)
- `samples/scripts/simple-calculation.js` (modified/deleted tracked)
- `samples/scripts/welcome-message.js` (modified/deleted tracked)
- `scripts/analyze-phase3-resume.py` (untracked)
- `scripts/phase3-jev.ts` (untracked)
- `scripts/phase3-resume-batch.ts` (untracked)
- `scripts/phase4-linux-setup.sh` (untracked)
- `scripts/phase4-runtime-preflight.py` (untracked)
- `scripts/phase4a-install-gvisor.sh` (untracked)
- `scripts/phase4a-install-native-docker.sh` (untracked)
- `scripts/phase4a-native-probes.py` (untracked)
- `scripts/phase4a-network-preflight.py` (untracked)
- `scripts/phase4a-runner-probes.py` (untracked)
- `scripts/phase4bc-analysis.py` (untracked)
- `scripts/phase4bc-cleanup.py` (untracked)
- `scripts/phase4bc-experiment.py` (untracked)
- `scripts/phase4bc-postchecks.py` (untracked)
- `scripts/phase4bc-report.py` (untracked)
- `scripts/phase4bc-stack.py` (untracked)
- `scripts/phase4bc-workloads.py` (untracked)
- `scripts/phase5-final-checks.py` (untracked)
- `scripts/phase5-live.py` (untracked)
- `scripts/phase5-offline.ts` (untracked)
- `scripts/phase5-otel.py` (untracked)
- `scripts/phase5-packages.py` (untracked)
- `scripts/phase5-report.py` (untracked)
- `scripts/phase5-repro.py` (untracked)
- `scripts/phase5-tests.py` (untracked)
- `scripts/phase5_common.py` (untracked)
- `scripts/phase6-build.py` (untracked)
- `scripts/phase6-evidence.py` (untracked)
- `scripts/phase6-finalize.py` (untracked)
- `scripts/phase6-live.py` (untracked)
- `scripts/phase6-resume-seed-check.py` (untracked)
- `scripts/phase6-resume-tests.py` (untracked)
- `scripts/phase6-runtime-audit.py` (untracked)
- `scripts/phase6-seed-check.py` (untracked)
- `scripts/phase6-tests.py` (untracked)
- `scripts/phase6_common.py` (untracked)
- `scripts/phase6_resume_common.py` (untracked)
- `scripts/test-phase1-db.mjs` (untracked)
- `scripts/validate-jev-inputs.ts` (untracked)
- `scripts/validate-phase2-runtime.mjs` (untracked)
- `services/host-gateway/Dockerfile` (modified/deleted tracked)
- `services/host-gateway/src/api-client.ts` (modified/deleted tracked)
- `services/host-gateway/src/config.ts` (modified/deleted tracked)
- `services/host-gateway/src/main.ts` (modified/deleted tracked)
- `services/host-gateway/tests/admin_boundary_test.ts` (untracked)
- `services/host-gateway/tests/gateway_http_test.ts` (modified/deleted tracked)
- `services/host-gateway/tests/trace_forgery_test.ts` (modified/deleted tracked)
- `services/runner/Dockerfile` (modified/deleted tracked)
- `services/runner/src/admission.ts` (untracked)
- `services/runner/src/audit-collection.ts` (untracked)
- `services/runner/src/config.ts` (modified/deleted tracked)
- `services/runner/src/docker.ts` (modified/deleted tracked)
- `services/runner/src/frames.ts` (modified/deleted tracked)
- `services/runner/src/gateway.ts` (modified/deleted tracked)
- `services/runner/src/main.ts` (modified/deleted tracked)
- `services/runner/tests/audit_collection_test.ts` (untracked)
- `services/runner/tests/docker_integration_test.ts` (modified/deleted tracked)
- `services/runner/tests/phase2_test.ts` (untracked)

## SHOULD NOT COMMIT

Dependency/build caches, Python caches, temporary marker and transient outputs. Exact file paths are retained in the JSON rather than thousands of repetitive Markdown rows.


## LOCAL/SECRET

- `.env` — private local file; no values included.
- `.env.phase4bc` — private local file; no values included.
- `.env.phase5-repro` — private local file; no values included.

## GENERATED/RESULTS

| Directory | Files | Bytes | Recommendation |
|---|---:|---:|---|
| `research-results/phase1` | 2 | 49655 | Candidate for committing the complete small sanitized package after explicit review; preserve original files/hashes. |
| `research-results/phase1b` | 8 | 64175 | Candidate for committing the complete small sanitized package after explicit review; preserve original files/hashes. |
| `research-results/phase2` | 23 | 77738 | Selectively commit small sanitized summary/manifests; archive full sealed package separately with all raw inputs/results. Do not delete or silently publish. |
| `research-results/phase3-jev` | 336 | 2747697 | Selectively commit small sanitized summary/manifests; archive full sealed package separately with all raw inputs/results. Do not delete or silently publish. |
| `research-results/phase4-gvisor` | 494 | 17796521 | Selectively commit small sanitized summary/manifests; archive full sealed package separately with all raw inputs/results. Do not delete or silently publish. |
| `research-results/phase5-final-validation` | 95 | 1678481 | Selectively commit small sanitized summary/manifests; archive full sealed package separately with all raw inputs/results. Do not delete or silently publish. |
| `research-results/phase6-cleanup` | 96 | 573259 | Selectively commit small sanitized summary/manifests; archive full sealed package separately with all raw inputs/results. Do not delete or silently publish. |
| `research-results/risk-comparison` | 80 | 185513 | Selectively commit small sanitized summary/manifests; archive full sealed package separately with all raw inputs/results. Do not delete or silently publish. |
| `research-results/scenarios` | 6 | 30482 | Candidate for committing the complete small sanitized package after explicit review; preserve original files/hashes. |

## Publication steps

1. Review every SHOULD COMMIT source/test/migration/sample/doc/tool file, including additions from earlier phases. Stage the removed obsolete sample too.
2. Ensure machine-specific research helpers are described as provenance tooling, not portable normal setup. Parameterize defaults later only if needed for publication.
3. Publish a reviewed source commit/archive identity; published HEAD currently lacks the integrated state.
4. Choose explicit evidence delivery. Keep complete frozen packages plus original hash manifests, and document artifact download locations if not in Git.
5. Do not publish populated env files, gateway/bridge/provider secrets or database passwords. No blanket git add -f or git add . over raw local data.
6. Exclude cache/build/temporary paths; review sanitized small result summaries separately. Keep all negative findings and original failures.
7. Recheck clean-checkout links after the chosen artifact publication; current links are verified locally, not promised present at published HEAD.
