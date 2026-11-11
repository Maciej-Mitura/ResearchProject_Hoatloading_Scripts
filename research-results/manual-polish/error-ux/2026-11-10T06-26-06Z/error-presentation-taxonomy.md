# Error presentation taxonomy

This is deterministic presentation, not a security classifier. Inputs are the stored execution outcome, result fields, recorded manifest profile and normalized diagnostic. Stdout or a mere mention of host is insufficient for Host SDK specialization. Pre-run source checking is a separate lightweight static-import recognizer.

| Class | Grounding | Primary guidance |
|---|---|---|
| Host SDK unavailable | Host module-resolution error + recorded non-host-chat profile | Explicitly select host-chat, then Run |
| Host SDK setup/runtime failure | Same host resolution error + recorded host-chat | Inspect SDK/import-map/setup/runtime; do not suggest reselecting host-chat |
| Module import | Recognized Deno resolution diagnostic | Check supported import path/module |
| Permission | deno_permission or clear Deno missing-grant diagnostic | Check supported scoped profile information |
| Timeout | timedOut or timeout | Actual manifest deadline; inspect loops/bounded work |
| Memory limit | oomKilled or memory_limit | Reduce memory use; inspect recorded limits |
| Infrastructure | supervisor_error, docker_operation_timeout, gateway_admin_timeout, capacity_rejected | Inspect service health/technical failure |
| Generic process failure | Failed outcome without reliable specialized cause | Actual exit code where recorded, otherwise safe generic explanation |
| Generic termination / blocked | Stored terminal outcome without specific cause | Inspect available termination/request details |

Actual category labels additionally include mock_failure -> Simulated execution failure. Unknown codes get Unrecognized execution failure and remain available verbatim in Technical error details. Output truncation remains a separate stored flag/notice; it is not invented as an execution failure category.

Source locations extract an available file URI + numeric line/column and display `main.ts · line 1, column 22`. Parsing failure never prevents rendering; normalized original diagnostics remain available. No module-resolution timestamp is fabricated: the timeline's derived diagnosis is explicitly sourced to process output and placed at stored result time.
