# Regression tests and live checks

Final frontend suite: **107 passed, 0 failed, 0 skipped** across six files. Typecheck exit 0. Production API/web build and local redeployment exit 0 (no API/provider source change). API/provider tests were not repeated because their data contracts/implementations did not change. Diff whitespace check exit 0. No Jev or gVisor experiment rerun.

Compared with the 68-test baseline: 38 new error/stepper checks plus one stale-save navigation regression. Existing profile-help test now verifies the user's consolidated title tooltip rather than the removed guide. Tests cover ANSI/Unicode/plain output, three wrong profiles and correct-profile setup failure, unrelated import/runtime errors, missing fields/location, exact source locations, actual failure labels, static import recognition, duplicate suppression, normalized copy, unchanged historical input, LOW/failed/complete independence, explicit suggestion without run/save, all stepper examples, active/inferred/unknown/not-applicable, semantic responsive structure and derived timeline placement.

The wider smoke uncovered a pre-existing savedVersion refresh race: a late response could refill a New script editor. The small frontend guard now checks the selected script ID both before and after the read. A deferred-response App test reproduces it; a live save immediately followed by New script now retains a clean creation editor. No backend behavior changed.

Five actual new executions:

| Case | Execution ID | Result |
|---|---|---|
| Host import / none | 1712f8e4-554e-4f5e-b512-e9cb3d2bd4aa | failed, exit 1, 780 ms, complete, LOW/R010 |
| Same source/version / host-chat | b0bba90c-81cf-411e-af98-7ac1860ba2c7 | completed, 879 ms, complete, LOW/R010, one Paper-confirmed broadcast |
| Generic throw | 69e35655-091b-408d-b3fe-6ba853aab608 | failed, exit 1, 584 ms, no host-profile suggestion |
| Normal | 5a4a48dd-8518-4c42-b9ee-fc1b41ed918b | completed, 542 ms, all five nodes reached |
| Bounded active run | 15646a71-055e-4aa8-bef8-37f17433cf72 | running at 0.8 s with inferred provenance; automatically completed at stored 5,338 ms, no refresh |

Also reopened the original ANSI host-import error and the existing 10,383 ms timeout. Historical API record equality and stored ANSI preservation were checked. Wrong-profile setup is reproduced live; failing host-chat setup, memory/infrastructure and analysis failure use focused fixtures rather than deliberately breaking deployment.

Desktop dark/light and actual 820x1000 / 390x844 viewports checked. Narrow node x positions are equal and y positions increase; page width does not exceed viewport. Keyboard focus exposed provenance, Escape dismissed it, and copy displayed Copied. Gemini header/existing response, client host guidance, script create/read/rename/save/version/disable/restore, profiles, progress, details, Insights, Host Activity, Settings preview and Help were checked. Settings effective/overrides unchanged. Final browser console error list empty.

Development checks caught invalid fixture expectations, a missing fixture field, a Unicode encoding issue and an incomplete edit of the risk-aware card signature. These were corrected before final green tests/build/deploy. Initial fixture-failure logs are retained separately; final *-tests.json/log and validation-summary.json are authoritative final counts.
