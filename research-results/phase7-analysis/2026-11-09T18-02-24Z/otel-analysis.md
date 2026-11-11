# OpenTelemetry's actual contribution

## RESULTS (S22–S23)

Collector debug logs contain E1/E8 trace IDs with execution and sandbox.run spans,
execution IDs, advisory risk.classified and E8 host_api requested/allowed/queued
events. Counter names are observed. Receipt is verified independently from DB rows.
Paper confirmation arrives after E8 process completion and is not in its earlier
exported root span. PostgreSQL durably holds command/result/correlation and UI
timeline evidence; OTel supplies a separate standardized span/event export view.

During one collector outage, the script's restricted read remained denied,
unauthenticated gateway action rejected, authorized broadcast Paper-confirmed,
and DB evidence persisted. Export timeout was visible; collector restoration and
later receipt worked. Lost exports were not shown replayed.

## INTERPRETATION

Beyond PostgreSQL alone, OTel added trace/span/event structure, correlation visible
in the collector and operational timing/counter export for orchestration, host calls
and advice. This is a functional observability contribution; investigator time saved
or improved attack detection was not measured. The API reconstructs telemetry from
execution evidence, not independent sensors at every service. Consequently it
does not close upstream observation blind spots such as HOL-008.

The outage supports limited coupling between collector availability and tested
enforcement. It does not establish zero export latency impact, guaranteed delivery,
DB/API resilience or general fault tolerance.

## NON-CONCLUSION

No IDS, authorization, complete security telemetry, durable trace backend,
independent full Paper distributed trace, guaranteed detection or tamper-proof
forensic evidence. Shared trace IDs alone do not prove a span was exported.
