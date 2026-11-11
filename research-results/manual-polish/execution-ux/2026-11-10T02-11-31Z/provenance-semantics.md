# Provenance and collection semantics

- **Observed:** Directly supported by a trusted stored/runtime record. Recorded does not mean successful.
- **Inferred:** Derived from trusted related records; this exact stage was not independently recorded.
- **Not recorded:** No reliable record is available for this stage. This does not prove nothing happened.
- **Not applicable:** This execution did not use this stage.

Unavailable describes collection/analysis availability, not universal provenance. Evidence's caption says Observed status record when an explicit status was persisted. The primary label remains Complete / Partial / Unavailable / Legacy status unknown / Pending / Not recorded. A recorded status of Unavailable is not a claim that native permission activity was observed.

Complete means collection finished normally, never exhaustive visibility. Partial means known collection limits. Unavailable means reliable permission collection could not be completed; other records may survive. Legacy status unknown means no explicit historical collection record. Pending is reserved for an active execution without its final result.

Status audit: outcome badge reads execution.status (terminated amber, failed danger, completed positive); class reads the linked stored assessment (HIGH danger, independent of process outcome); collection reads auditCollection or truthful fallback (unavailable neutral badge plus explanatory warning); observed/inferred captions describe the specific supporting record, never a security verdict. Host partial/failed badges describe aggregate completion and remain explained by correlated counts. Missing OOM/exit/limits/timestamps are Not recorded, never invented false/zero.

Complete + zero: No permission observations were recorded. Incomplete/unknown + zero: No observations are available; collection was incomplete or unknown. This cannot be interpreted as absence of activity. Native observations remain access/check evidence, not permission decision or malicious-intent labels. Insights uses the same CollectionBadge and mapper.
