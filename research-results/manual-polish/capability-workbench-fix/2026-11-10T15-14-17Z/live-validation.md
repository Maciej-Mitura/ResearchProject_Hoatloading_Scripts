# Live A-F validation
Local deployed web/API, Docker/runc, deterministic risk advisory, real Paper bridge. These are bounded product checks, not new scientific runs.

| Case | Outcome | Evidence |
|---|---|---|
| A console | Created/edited/saved version 2 in CM; No permissions, no review; completed, stdout 42 | A-ui-run.json |
| B historical host-chat | Existing bounded null-manifest fixture completed; Paper confirmed broadcast | B-legacy-run.json |
| C advanced | Run opened unchecked review; zero executions. Harness review stored; mode visibly selected, no auto-run. Separate UI Run completed; Paper confirmed status/chat. Later fixed-mode Run showed friendly guidance and history remained exactly one | C-history-after-ui-review-prompt.json, C-ui-run.json, C-history-after-incompatible-mode.json |
| D partial | Warning displayed, chat approved/spawn denied; deliberate UI Run completed with chat confirmation and CAPABILITY_NOT_APPROVED for spawn | D-ui-run.json |
| E bypass | Unreviewed fixed-mode request, unreviewed per-script request and forged client authority each rejected HTTP400; zero execution records | E-backend-bypass.json |
| F Gemini | Real Gemini 201 proposal, four requested/unreviewed capabilities saved. Browser showed Review required. Harness explicitly approved; browser showed ready Per-script permissions. Separate Run completed; status, chat, three ZOMBIE effects confirmed by Paper | F-gemini-response.json, F-ui-run.json, workbench-final.png |

F private-message attempt was authorized but Paper returned an offline-player failure for GoldennBullet. Successful delivery was not tested and no user participation was requested. No raw ApiError appeared in normal C/F flow or the preempted wrong-mode attempt. Runtime completion is distinct from individual host-effect success; F therefore includes the message failure rather than claiming all effects succeeded.
