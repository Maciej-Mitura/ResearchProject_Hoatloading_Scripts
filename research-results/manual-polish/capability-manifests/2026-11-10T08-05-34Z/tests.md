# Regression and validation results
All figures below describe the final passing runs. Earlier development/regression failures remain in this package and are described below. API ignored tests are PostgreSQL opt-in suites, executed separately against the deployed database.

| Suite | Passed | Failed | Ignored/skipped |
|---|---:|---:|---:|
| api | 131 | 0 | 3 |
| runner | 53 | 0 | 0 |
| gateway | 32 | 0 | 0 |
| frontend | 121 | 0 | 0 |
| postgres | 1 | 0 | 0 |
| history-postgres | 1 | 0 | 0 |
| java | 13 | 0 | 0 |
| docker-integration | 22 | 0 | 0 |
| capability-postgres | 1 | 0 | 0 |

Frontend TypeScript check and Docker frontend production build passed. Compose config validation passed. All application/sandbox/Gateway/runner/SecureBridge images built. The generated Paper registry resource passed --check. API and Paper were healthy/connected at the final check; no probe containers remained.

Commands are recorded by run-tests.py: Deno tests for API, Gateway and runner (runner unit suite excludes Docker integration); Vitest and tsc in apps/web; deployed API opt-in host-activity/history/manifest database tests; Gradle/JUnit 13 tests in the built bridge image; 22 deployed Docker runner integration tests. Building web runs tsc --noEmit and vite build. No frozen Jev/gVisor experiment was run.

Real Gemini integration: five requests, five HTTP201 responses, zero provider failures/retries. Pure calculation requested []; chat requested chat.broadcast; spawn requested status+spawn; composition requested all four; unsupported arbitrary commands produced an explanatory response without a proposal. No Jev calls. Generated spawn and composition source were saved/reviewed by the integration harness and each produced exactly three successful Paper spawn results. GoldennBullet was offline, so private delivery success was not validated.

Resolved failures: initial Docker suite 11 passed/11 failed (output flood cleanup and subsequent capacity quarantine), isolated retry 11/11, daemon-log-bound retry 11/11, CLI-reaping retry 12/10, workload-stop retry 11/11. Capturing overflow now stops the flooding job rather than continuing until timeout, stops/reaps the process, drains handles and bounds removal; final suite 22/0. The revoked new-capability endpoint initially returned404; active cross-sandbox checks already denied correctly, and the endpoint now returns401 after revocation. Database review selection originally tied on transaction timestamps and random UUID ordering; the preserved failure led to additive migration012 and monotonic append ordering. The database test then passed three consecutive runs (repeats are not counted as distinct test cases).

Browser: observed partial-approval summary, unchecked defaults on reopening, Cancel, selected-run usage counts, Paper confirmation separate from process completion, human-readable denial and export control. Automated UI checks cover all unchecked defaults, selected-only submission, partial denial, reopening, dirty source, unsupported capability and historical legacy state. Screenshot: permission-review.png.
