# Execution path semantics and mapping

The contract was inspected before changing the stepper. It remains a projection of related records, not five independently measured spans or a pass/fail pipeline.

| Stage | Source | Possible displayed states | Provenance and absence |
|---|---|---|---|
| Request | Local submission / persisted execution identity | Sending / Accepted | Local sending not recorded; accepted API record observed. A POST failure remains a request error, not a fabricated accepted stage. |
| Process | Coarse execution.status + execution.result | Waiting / Checking request / Running / Returned / Stopped / terminal state when no result | Running inferred from coarse API state; stored result observed. No independent container-start attestation. |
| Result | Stored result plus execution.status | Pending / Available during finalization / Completed / Failed / Terminated / Blocked / Not recorded | Result presence observed; absent result not recorded. Outcome is now explicit rather than always saying Available. |
| Evidence | result.auditCollection, historical fallback | Pending / Complete / Partial / Unavailable / Legacy status unknown / Not recorded | Explicit status record observed even when unavailable. Missing historical status remains unknown. |
| Assessment | Exact linked stored assessment | Pending / Assessing / LOW / REVIEW / HIGH / Failed / Unavailable / Unclassified / Not recorded / Not applicable for blocked request | Stored assessment observed; missing record not recorded. Not applicable only when genuinely supported by the blocked path. |

A failed process result can coexist with complete evidence and LOW. A timeout can coexist with unavailable native audit and completed HIGH assessment. Assessment checks indicate the analyzer record returned, not that the script is safe. No node failure propagates to later nodes.

Visual state mapping: ✓ reached record/stage; × failed/blocked; ! terminated/partial; ↻ active with aria-current=step; ? unavailable/unknown/not recorded; ○ pending/not applicable; ≈ inferred completed stage such as host delivery. Icons, accessible labels and words supplement color. Active state is understandable without animation; reduced motion disables the pulse.

Default content is stage name + status + one small info trigger. Descriptions and exact Observed/Inferred/Not recorded/Not applicable explanation are in keyboard-accessible InfoTip. The existing global legend remains. An ordered list connects nodes with neutral arrows; no independent bar tracks, filled progress bar or percentage. Below 850 px it becomes a compact vertical list with downward arrows.

Workbench and Insights both render the same ExecutionDetail/ExecutionJourney. Actual host usage adds a separate Requested -> Authorized -> Queued -> Delivered -> Confirmed flow in Evidence, using the same node component. The previous correlation/count logic and loaded-record limits are unchanged; profile alone never creates it. Delivered remains inferred, independently confirmed Paper results remain observed.
