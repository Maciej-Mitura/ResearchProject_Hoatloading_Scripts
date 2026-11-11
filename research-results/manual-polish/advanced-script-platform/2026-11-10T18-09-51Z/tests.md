# Final validation
| Suite | Passed | Failed | Skipped/ignored |
|---|---:|---:|---:|
| frontend | 155 | 0 | 0 |
| api | 153 | 0 | 4 |
| runner | 54 | 0 | 0 |
| gateway | 33 | 0 | 0 |
| postgres | 4 | 0 | 0 |
| docker | 27 | 0 | 0 |
| shared-contract | 3 | 0 | 0 |
| java | 19 | 0 | 0 |

API's4 ignored tests are the opt-in PostgreSQL suites; all4 passed separately against the deployed database. Frontend typecheck, production builds/deployment, Compose validation and git diff whitespace checks passed. Shared-contract generation/resource consistency passed. No frozen Jev/gVisor scientific experiments rerun.

Coverage includes project paths/counts/UTF8 bytes/canonical hashes; one/multiple files, immutable Save/version/review; real CodeMirror tabs/editing/drafts/JSON/keyboard/cache themes; helper diagnostics/navigation; structured Assistant validation; six capability argument schemas, constraints/denial/quota/session boundaries; date presets/custom/empty/stale replies/pagination/full aggregates; running-registry Limits and accessibility. Expected runtime/provider failures are retained as evidence. Original Docker error-location assertion was corrected to strip ANSI formatting before comparison.

Dependency audit:production0 findings; full tree6 (3 moderate,1 high,2 critical), all in development tooling. The exact affected packages/advisories/fix metadata are in dependency-summary.json and raw audits. Major toolchain upgrades were not applied automatically. The deployed site serves a production build, not the Vitest UI/development server. Audit is npm's view of this dependency graph, not a whole-system vulnerability assessment.
