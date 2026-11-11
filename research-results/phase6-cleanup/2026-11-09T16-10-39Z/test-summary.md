# Final relevant regression checks

190 passed, 0 failed, 1 local guarded DB test skipped; the separate deployed DB test passed. Typecheck/config/audits are command checks, not added to testcase totals.

- api: PASS, {'passed': 102, 'failed': 0, 'skipped': 1}; `resume-validation/api-tests.json`
- frontend: PASS, {'passed': 13, 'failed': 0, 'skipped': 0}; `resume-validation/frontend-tests.json`
- frontend-typecheck: PASS, command check; `resume-validation/frontend-typecheck-tests.json`
- docker-integration: PASS, {'passed': 22, 'failed': 0, 'skipped': 0}; `resume-validation/docker-integration-tests.json`
- postgres: PASS, {'passed': 1, 'failed': 0, 'skipped': 0}; `resume-validation/postgres-tests.json`
- runner: PASS, {'passed': 52, 'failed': 0, 'skipped': 0}; `resume-validation/runner-tests.json`

Gateway/Java suites SKIPPED: source/config unchanged; historical Phase 5 results not counted as new passes. Manual walkthrough UNAVAILABLE.
