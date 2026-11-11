# Execution UX polish result

COMPLETE WITH LIMITATIONS

# 1. Timeout screenshot investigation

The saved values were semantically consistent, but the presentation was confusing. Original execution `c65141ae-4521-451f-bbef-9d8f11c31995` recorded Terminated, timedOut=true, failureCategory=timeout, duration 10,440 ms and manifest timeout 10,000 ms. The extra 440 ms is compatible with runner lifecycle overhead. Its recorded profile was host-chat.

HIGH came solely from stored deterministic reason **[R006] Execution timed out (resource limit)**. Collection Unavailable was not an additional matched rule. Zero native permission observations and reasons job_wall_timeout / missing_audit_frame were persisted. The timeout branch conservatively marks the final audit unavailable; the sandbox normally emits its audit trailer only after Deno returns. The historical raw transport frame was not retained, so byte-level absence cannot be independently re-inspected.

Observed previously meant a record existed, including a record saying collection unavailable. Inferred meant a stage was derived from related provider/acknowledgement records. Neither meant every action was observed or every stage independently attested.

The source actually called host.chat.broadcast immediately and every 3 s. All **four correlated commands were confirmed by Paper**. This was not merely a console loop. Existing security/execution/classifier semantics remain intact. See original-observation-analysis.md and original-execution.json.

# 2. Root UX problems

No clear immediate running feedback, stale-run ambiguity, unexplained provenance, collection-state/provenance conflation, raw reason codes, hidden classifier reasons and weak incomplete-evidence empty states. Host aggregation could also make one success look representative of multiple commands. These presentation/projection problems are addressed without changing grants or classifier rules.

# 3. Live execution experience

Run immediately clears old selected evidence and shows a restrained spinner, request-relative elapsed timer and requested profile. Same five-column path transitions through coarse API states to the final result/evidence/assessment. Output explains that it becomes available when execution returns. Terminal state removes the activity animation automatically. Reduced-motion styling uses a static indicator.

# 4. Progress data integrity

Request acceptance is a stored API fact. Running/validating/analysing are coarse API lifecycle states, not independent admission/container-start observations. Result and collection status are stored facts; assessment must match both the linked assessment ID and execution ID. No fake percentages or synthetic event times.

Existing SSE plus serial 3 s reads update the selected execution automatically. Old selections and older polling responses cannot replace the current terminal execution. Terminal analysis/host follow-up is bounded to 30 s. Refresh errors retain last data and say updates are unavailable; they do not imply script failure.

# 5. Evidence terminology

**Observed:** directly supported by a trusted record. **Inferred:** derived from trusted related records, without an independent record for that exact stage. **Not recorded:** no reliable record available; not proof of no activity. **Not applicable:** this execution did not use that stage. Collection uses its own states, including Unavailable. Its provenance caption explicitly says Observed status record.

# 6. Information tooltips

One reusable accessible circle-i component covers profiles, outcome, duration, assessment, collection states, provenance, permission observations, host confirmation, runtime controls and technical metadata. It supports hover, focus, click/tap, Escape/outside dismissal and viewport clamping. Insights shares the collection mapper. Help now includes Understanding execution evidence.

# 7. Execution profile tooltips

The native picker remains; its adjacent Profile guide supplies one info icon per option. Exact tooltip bodies:

- **none:** Deno receives no filesystem, network, environment, subprocess or FFI permissions. These configured grants are not a general security guarantee.
- **read-fixture:** Configured Deno permissions: read /fixtures only (baked-in test file). Not general filesystem access. These configured grants are not a general security guarantee.
- **env-demo:** Configured Deno permissions: env SANDBOX_DEMO_VALUE only. Application secrets are not injected. These configured grants are not a general security guarantee.
- **host-chat:** Host capability chat.broadcast via Host Gateway. Deno may reach only the gateway; authority is enforced by the gateway, not by network access alone. These configured grants are not a general security guarantee.

Verified against the existing contracts, runner permissions and sandbox entrypoint.

# 8. Timeout diagnostics

The new controlled loop displays **Execution terminated after reaching its 10 s limit.** It shows unavailable final permission audit, human explanations Execution exceeded time limit / Final audit frame not received, and the actual R006 advisory reason. Its recorded duration was 10,383 ms; the deadline comes from its own manifest, never a hardcoded global UI value.

# 9. Detailed post-run information

Failure-first summary and an automatically expanded Why this result? disclosure expose outcome, request/processing/finish timestamps, exit code, failure category, deadline, OOM, truncation, cleanup, collection reasons and stored analyzer reasons/status/failure. Evidence adds observation counts/categories and correlated host counts. Runtime retains configured controls; collapsed technical details expose IDs, exact times and raw codes. Missing fields say Not recorded. Stdout remains labelled untrusted and is not host-effect proof.

# 10. Timeline improvements

Chronological PostgreSQL lifecycle/security records now have understandable labels, source/type and precise stored times. Script output placed at result time is explicitly marked reconstructed placement. No admission/container-start timestamp or distributed-trace attestation is invented.

# 11. Host capability correctness

A host-chat profile is permission, not usage. Only actual host-call/result evidence creates the chain; administrative session metadata does not. Correlated command counts distinguish queued, confirmed, failed and pending. All-commands success requires all queued IDs to have trusted successful SecureBridge acknowledgements. Delivered remains Inferred; Paper confirmation is Observed. Original run: four of four confirmed. New host runs: one of one each. No host chain for the new console-only timeout.

# 12. Empty-state correctness

Complete + zero observations uses the ordinary no-observations state. Partial/Unavailable/unknown + zero uses an uncertainty warning and explicitly says absence of activity cannot be concluded. Active evidence is Pending. Historical missing fields remain truthful fallbacks.

# 13. Tests

| Suite | Passed | Failed | Ignored/skipped |
|---|---:|---:|---:|
| Frontend | 68 | 0 | 0 |
| API | 116 | 0 | 2 opt-in DB cases |
| Deployed history PostgreSQL | 1 | 0 | 0 |
| Deployed host PostgreSQL | 1 | 0 | 0 |

**186 executed passes, zero failures.** The two locally ignored database cases were separately run and passed above. Frontend typecheck, production API/web build, redeploy and diff whitespace check passed. Final assertions are in validation-summary.json; exact logs in *-tests.json/log. No Jev/gVisor experiment rerun.

# 14. Live regressions

| Case | Stored outcome | Collection / assessment |
|---|---|---|
| Normal | completed, 959 ms API / 742 ms UI | complete, zero observations, LOW/R010 |
| Controlled timeout | terminated, 10,383 ms, timeout | unavailable, zero observations, HIGH/R006; no host request |
| Thrown script error | failed, 630 ms, exit 1 | complete, zero observations, LOW/R010 |
| Real host-chat | completed, 765 ms API / 884 ms UI | complete, four observations, LOW/R010; Paper confirmed |
| Caught restricted read | completed, 554 ms | complete, one observation, REVIEW/R009 |
| Analysis failure representation | completed process preserved in component double | failed assessment/rate_limit remains separate |

Seven real executions; browser initiated timeout, normal and host cases. No manual refresh was needed for their terminal transition. The analysis-failure check used a test double; provider configuration was not broken.

# 15. Wider smoke regression

Script create/read/save/version history and disable/restore workflow passed (there is no delete endpoint). Profile selection, execution details, Insights, Host Activity, Settings preview and Help passed. Restored real Gemini header/history/proposal remain usable; effective settings and overrides are unchanged. No additional paid assistant call was sent. Desktop light/dark, tablet and phone tooltip bounds and keyboard Escape were checked. A stale lazy chunk during local redeploy was resolved by reloading the final bundle before final navigation checks.

# 16. Frozen research integrity

**1,294 pre-existing research files unchanged; none missing.** Six previous seals verify 779 artifacts; the Phase 3 manifest verifies 131 more, for 910 sealed entries. No frozen result, label, policy or methodology was modified. Only the additive current manual-polish directory holds new evidence.

# 17. Files changed

19 source files: 18 frontend files for shared mappers, host aggregation, monitoring, accessible help, feedback, Workbench/Insights integration and focused regressions; one API route returns its already queried securityEvents array. SQL, grants and execution authority are unchanged. Full list and current hashes: changed-files.md and integrity-and-scope.json. No commit or push.

# 18. Remaining limitations

Progress remains coarse; stdout is returned after execution. Native audit is not exhaustive, and unavailable historical transport cannot be recovered. Security events are bounded to 500 loaded records; counts explain their loaded scope. Late analysis/host records beyond the 30 s grace need manual refresh. Actual OOM/infrastructure outages and new paid assistant generation were not induced; focused fixtures cover their presentation. No formal screen-reader certification. Reload an already-open tab after local redeployment to load the new asset set.

# 19. Recommendation

Review the controlled timeout Evidence view and use the adjacent Profile guide for option help. All requested implementation and focused validation are complete within the stated observational limits. **Do NOT start Phase 8.**

READY FOR MANUAL REVIEW
