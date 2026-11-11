# Original timeout investigation

Execution `c65141ae-4521-451f-bbef-9d8f11c31995`, created 2026-11-10T01:49:12.560Z (02:49 CET), is the screenshot record. Its source and executed version were retrieved before editing. See original-execution.json and original-deployed-projection.json.

| Field | Stored evidence and interpretation |
|---|---|
| Terminated | Result timedOut=true, failureCategory=timeout; terminal API status terminated. |
| 10,440 ms | Stored runner lifecycle duration, consistent with manifest timeoutMs=10000 plus 440 ms overhead. API queue/validation time is separate. |
| host-chat | Manifest recorded this exact profile; it is not merely the currently selected editor option. |
| HIGH | Linked deterministic v1 assessment, status ok, sole reason `[R006] Execution timed out (resource limit)`. Unavailable evidence was not an additional matched reason. |
| Unavailable | auditCollection status unavailable; reasons job_wall_timeout and missing_audit_frame. Zero permission events were persisted. |
| Observed | The former path generally meant an API/result/status/assessment record existed; it did not mean collection succeeded. This ambiguous presentation caused the apparent contradiction. |
| Inferred | The former runner stage was derived from the stored Docker provider result, not an independent runner attestation; host delivery was derived from a correlated acknowledgement, without an independent delivery timestamp. |

The script was more than console logging: broadcastGreeting logged Hello world, called host.chat.broadcast, ran once immediately and then every 3,000 ms through setInterval. Twelve host API phase events correspond to FOUR requested/authorized/queued commands. PostgreSQL contains four correlated completed SecureBridge commands with success=true. Timeout, unavailable native audit, and confirmed host effects therefore legitimately coexist.

Trace: API execution and version -> Docker runner timeout branch -> sandbox entrypoint -> stored result/auditCollection -> linked deterministic assessment -> frontend. services/runner/src/docker.ts marks deadline termination, bounds output collection, sets unavailable with the two reason codes, and cleans up/revokes in finally. services/sandbox/entrypoint.sh emits final AUDIT/RUNTIME trailers after Deno returns. A nonterminating interval does not return normally; the timeout branch does not recover/parse a final frame. This justifies the conservative unavailable status. **The original raw transport frame was not retained**, so its literal byte-level absence cannot now be independently re-inspected. The new bounded-loop regression reproduces the same result. Do not upgrade that historical limitation to independent runtime attestation.

No deterministic rule, evidence status, sandbox permission or runner lifecycle behavior was changed. The only backend change exposes securityEvents already queried by GET /api/executions/:id (existing limit 500). It replaces the frontend's smaller global-security read for selected details; no query or authority was added.
