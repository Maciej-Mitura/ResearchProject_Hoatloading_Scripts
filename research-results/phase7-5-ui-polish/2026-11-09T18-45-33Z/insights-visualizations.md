# Visualization inventory
| Visual | Purpose/source | Aggregation | Caveat/null behavior |
|---|---|---|---|
| Execution outcomes | Reliability of selected script; history status | Actual status counts / filtered loaded rows; compact proportional horizontal bar + labeled counts | Intentional timeout remains terminated; purpose not inferred. No invented category or security verdict. |
| Advisory risk classification | Recorded advisory results; linked risk record | LOW/REVIEW/HIGH and failed/unavailable/not-recorded counts | No maliciousness, threat probability or protection score. Failure overrides stale class. |
| Execution duration | Compare lifecycle duration; result.durationMs | Chronological oldest-to-newest line; tooltip timestamp/duration/status/profile/provider; measured-value median | All outcomes retained. Null gaps, no null-to-zero. Lifecycle includes overhead; no Phase4 benchmark blending. Recharts 3.10.1, React-is 18.3.1. |
| Permission categories (selected Evidence tab only) | Observations by filesystem/env/network/subprocess/FFI/other | Native rows once; fallback matching persisted permission.accessed rows; count and proportion | Access/check observations only; no fabricated allowed/denied. Collection status/reasons and zero-observation caveat visible. |
| Recorded execution path | Explain stored execution stages | API persisted observed; runner inferred from Docker result; sandbox stored process outcome; evidence metadata and linked assessment | No independent distributed-trace or runtime attestation claim; absent stages Not recorded. |
| Conditional host path | Explain requested/authorized/queued/delivered/confirmed | Stored gateway events; successful secure_bridge / sandbox_capability acknowledgement correlated to queued command | Delivered inferred, never independently timestamped; failed ack not confirmed; no events => no chain. |

Distribution legends provide labels/counts outside hover. Duration uses keyboard accessibility layer, disabled animation, responsive container and an equivalent real-value history table. Selected execution evidence is shared, not duplicated as extra dashboard charts.
