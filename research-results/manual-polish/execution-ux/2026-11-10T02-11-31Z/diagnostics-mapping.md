# Deterministic diagnostics mapping

Timeout summary uses result.timedOut / failureCategory=timeout and the selected result manifest.timeoutMs. Missing deadline gets generic configured-limit wording. Duration remains the stored durationMs. OOM uses explicit oomKilled=true or memory_limit category; absent OOM remains Not recorded. Script failure uses actual exit code. Known supervisor/Docker/gateway infrastructure categories get infrastructure wording. Generic external termination is not relabelled a script error.

The Why this result? disclosure opens for non-success and HIGH/REVIEW/failed/unavailable assessments. It exposes outcome, requested/processing/finished times, actual exit code, failure category, configured deadline, OOM, truncation and cleanup errors. Evidence reasons and stored advisory reasons/analyzer/status/failure are side by side. No LLM explanation is used. Risk reasons are copied from the linked stored assessment rather than inferred from collection quality.

| Raw reason | Human heading |
|---|---|
| job_wall_timeout | Execution exceeded time limit |
| timeout | Execution timed out |
| missing_audit_frame | Final audit frame not received |
| malformed_audit_frame | Audit frame could not be decoded |
| process_terminated | Process was stopped |
| output_capture_or_return_limit | Output capture was limited |
| audit_limit | Audit collection limit reached |
| malformed_audit_records | Some audit records were malformed |
| runner_failure | Runner collection failed |
| execution_not_observed | Execution result not observed |

Unknown codes remain visible with underscores humanized and a neutral explanation; raw codes remain in collapsed Technical details. No unknown cause is invented.

Evidence shows collection quality, observation count/categories, native audit limits and optional correlated host interaction. Runtime retains manifest provider/runtime, profile and configured controls. Technical details retain execution/trace/call/command IDs, exact timestamps and raw reason codes. Timelines use stored PostgreSQL lifecycle/security times; script output is placed at result time and explicitly marked reconstructed placement, never a captured stdout-event timestamp.

Host data is deduplicated by phase + call/command ID across native and stored records. Administrative session events are excluded. Confirmation requires same-execution queued command ID, host.command.result, secure_bridge source, sandbox_capability origin and boolean success. All queued commands are counted; one acknowledgement cannot imply all succeeded. Pending/failed/mixed counts are explicit. Successful delivery is inferred from correlated success; Paper acknowledgement is observed. Counts are limited to loaded correlated records (detail loads at most 500 stored security events).
