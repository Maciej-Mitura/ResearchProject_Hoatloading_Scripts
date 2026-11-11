# Validation
| Check | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Frontend Vitest (11 files) | 146 | 0 | 0 |
| API Deno tests | 131 | 0 | 3 |
| Host Gateway Deno tests | 32 | 0 | 0 |

Frontend typecheck passed. Production frontend build and deployment passed (web-final-build.json/web-final-deploy.json). API build/deployment passed (build.json/deploy.json). API ignored tests are the three explicitly opt-in PostgreSQL suites; SQL and manifest queries were not changed, so those were not rerun. No frozen experiments rerun.

New targeted repair coverage includes real editor mount/no textarea, edits, history/search/indentation, long source, theme, external source/read-only, Save/drafts, review-before-run, approval without auto-run, manual mode choice, partial denial, dirty/outdated and new-version review, friendly backend-race handling, no invalid POST, correct mode submission and stale manifest response protection. Full-suite logs and machine-readable counts are retained beside this file.
