# Honest progress and update model

| Display | Authoritative input | Provenance / limitation |
|---|---|---|
| Sending request | Local Run invocation, before POST resolves | Local UI state; no API acceptance yet |
| Request accepted | Persisted execution ID returned/read | Observed API record |
| Waiting / checking request | queued / validating | Coarse API lifecycle; no admission/container-start claim |
| Process running | running | Inferred process activity from coarse API status, which begins before provider/container creation |
| Collecting returned result | running with stored result | Result exists; no invented collection percentage |
| Assessing | analysing | Coarse API analyzer phase |
| Result available | Stored execution.result | Observed provider-result record; not independent container attestation |
| Evidence collection | auditCollection.status | Observed status record may itself be unavailable; missing historical status remains unknown |
| Assessment | Exact linked assessment ID + execution ID | Stored class/status; failed analysis remains separate from process outcome |
| Terminal | completed / failed / terminated / blocked | Stops activity timer; no animation that implies ongoing execution |

Same five columns, Request -> Process -> Result -> Evidence -> Assessment, appear during and after execution. Columns are related facts, not five independently instrumented timing stages. No percentage, synthetic durations, random progress, cancellation control or new event streaming was added. The local elapsed timer updates every 250 ms and is labelled elapsed since request, not process duration. Requested profile is explicitly distinct from a later recorded manifest profile. Output is returned after completion and says so while pending.

Existing SSE is retained. Conservative serial polling reads detail and assessments every 3 s; scoped security events are included in detail (legacy API fallback remains). Reads do not overlap; obsolete selections are cancelled/ignored. Older polling results cannot regress a terminal SSE execution. Background active-run monitoring still settles the Run button if another execution is selected or SSE fails. Stop after terminal + linked analysis + queued-host acknowledgements settle; missing analysis/late host acknowledgements get a bounded 30 s follow-up, then remain truthfully not recorded/pending until manual refresh. Refresh errors retain last data, distinguish update failure from script failure, and retry with 3/6/9/10 s backoff. Initial read failure also has an explicit retry notice.
