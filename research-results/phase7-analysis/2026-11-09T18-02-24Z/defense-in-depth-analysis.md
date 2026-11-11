# Defense-in-depth interactions and failure independence

| Example | Enforcement / containment | Observation / interpretation | Result and limit |
|---|---|---|---|
| Restricted read | Deno denies outside scope; Docker supplies a separate configured filesystem/process boundary | Deno audit where present; PostgreSQL retains evidence; rules advise REVIEW; OTel correlates | E2 fails and E3 catches/completes with activity; does not prove Docker independently blocked that same read (S18) |
| Host broadcast | Deno grants transport/SDK only; gateway authorizes; trusted API/DB enqueue; SecureBridge performs bounded action | Call/command/trace correlation and later Paper acknowledgement; advisory afterward | E8 confirmed. Accepted means queued; delivery inferred from guarded transition, not independently timestamped (S19–S20) |
| Collector outage | Existing Deno/Docker/gateway restrictions remain | Export error visible; DB evidence persists; collector receipt later recovers | One controlled outage, not DB/API fault tolerance or zero overhead (S23) |
| Advisory failure | Existing execution grants and controls unchanged | Completed process with failed/null assessment | Injected analysis failure does not mean execution failed or authority expanded (S06) |
| Timeout/output | Runner stops/bounds job and cleans it up | Collection can become unavailable; classification uses recorded resource facts | E6/E7 containment succeeds while audit quality degrades (S18) |

## What combining layers adds

Different mechanisms address different failure modes: a network grant is still
subject to application authorization; a caught error can be reviewed after successful
process completion; resource/lifecycle limits bound execution without relying on
classifiers; collector availability is not required for permissions to apply.
Persistence and standard telemetry representations support retrospective correlation
rather than preventing host effects. gVisor is an optional researched boundary,
not a prerequisite for the observed normal host chain.

This supports a functional separation argument, not a measured percentage advantage
over a single-layer alternative. Only selected failures were injected/observed.
The trusted runner, engine, API, gateway, DB and plugin are common dependencies;
layers are not statistically independent or immune to shared misconfiguration.

## Single-layer absence/failure matrix

| Layer absent/fails | Supported consequence | Evidence status |
|---|---|---|
| Deno removed/misconfigured | Broader in-container runtime authority; configured Docker/gateway bounds may remain | Design counterfactual; not a Deno-removal experiment |
| Docker unavailable | Current Docker path reports failure; no silent host/mock fallback. Hypothetical standalone Deno lacks a separate container boundary | Design/implementation property, not new engine-outage result |
| gVisor absent | runc normal PoC functions; additional boundary absent | runc executions observed; security delta unmeasured |
| Gateway missing | Intended sandbox host call unavailable; exposing direct host authority would weaken design | Design inference; tested bypasses reject, no gateway-removal experiment |
| Lifecycle bound absent | Resources/concurrency would lack that particular configured bound | Design inference; observed controls tested, not removal |
| PostgreSQL/API fails | Evidence/finalization/queue operation may fail; no durable-outage guarantee | Known design limit, outage/HA not demonstrated |
| OTel collector down | Export degraded; tested enforcement/authorization/DB path intact | Empirical single outage |
| Jev unavailable | Advice unavailable; configured deterministic/containment paths remain | Actual normal deterministic path + preserved provider failure + advisory seam, not automatic fallback proof |
| Deterministic absent | Configured Jev could still advise; experiment gives no modal-agreement reason to prefer it alone | Configuration/design inference; no standalone-detector efficacy claim |

No absent-layer scenario above is silently counted as a new experiment.
