# Insights data contract
GET /api/executions/history?scriptId=<UUID>&limit=100 is a new bounded READ-ONLY projection. UUID and integer limit 1..200 validated before querying. Existing executions(script_id, created_at) index reused. Exact per-script total is count(*) OVER(); newest created_at/id first. Frontend loads latest 100, not all historical rows; date/provider filters and all charts are explicitly scoped to that window. No pagination claim.

| UI field | PostgreSQL source | Missing behavior |
|---|---|---|
| Identity/time/outcome | executions id, script_id, script_version_id, created_at, status | Existing persisted execution record required. |
| Duration | result.durationMs | Null for absent/nonfinite/negative; never substitute zero. |
| Provider/runtime/profile | result.provider / manifest.dockerRuntime / manifest.permissionProfile | Null; display Not recorded. No runc/runsc guess. |
| Collection | result.auditCollection.status | Known enum retained; result without field => legacy_unknown; no result => not_recorded. |
| Advisory | risk_assessments joined on execution.risk_assessment_id AND matching execution_id | No assessment => not_recorded; failed/unavailable separate. Legacy medium label maps REVIEW only for presentation. |

Existing GET execution detail/security events/risk assessments provide selected evidence. Detail selects the execution-linked assessment ID, matching the history projection. Existing script APIs provide source and versions separately. History DTO excludes source, stdout, stderr, tokens, credentials and observation arrays. No mutation route, migrations, security rules, analyzer behavior, execution contracts or shared contracts changed.

Counts group actual statuses; median sorts finite nonnegative measured durations; missing durations remain chart gaps. Completed is process state, not security verdict. Complete collection is instrumentation status, not exhaustive observation. Mock provider is explicitly simulated. Database-resident old experiment runs may be selectable as actual application records; no frozen results JSON is imported.
