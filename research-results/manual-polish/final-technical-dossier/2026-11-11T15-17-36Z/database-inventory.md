# PostgreSQL-inventaris

| Tabel | Inhoud en relatie | Migratie |
|---|---|---|
| conversations, messages | gesprek 1:N berichten, role/content en metadata | 001 |
| scripts | scriptidentiteit, metadata, optionele conversation/source_message link | 001, 007, 008 |
| script_versions | script 1:N, bron/language, versionNumber en project JSONB | 001, 013 |
| executions | verwijst naar scriptversie, status/tijden/result JSONB | 001, 004 |
| execution_events | lifecycle-events per uitvoering | 001 |
| security_events | permissie- en hostobservaties met execution/trace-context | 001 |
| risk_assessments | classificatie, confidence, redenen, provider/schema/latency/failure | 001, 005, 006 |
| host_connections | heartbeat en status | 001 |
| host_events | zichtbare Paper/bridge-events | 001 |
| host_commands | type, payload, status en result, origin/correlation JSONB | 001, 009, 011, 013 |
| project_settings | opgeslagen overrides voor projectcontext | 003 |
| script_capability_manifests | één manifest per scriptversie, source_sha256, requests en waarschuwingen | 011 |
| script_capability_reviews | append-only reviews per manifest, approved en denied JSONB | 011, 012 |
| execution_capability_authorities | één immutable snapshot per uitvoering | 011 |

`013_script_projects.sql` bewaart bestanden in JSONB, zonder aparte file-tabel. De trigger blokkeert wijziging van opgeslagen bron, taal of project. `011_capability_manifests.sql` beschermt manifest, review en execution-authority tegen updates. De 012-migratie voegt deterministische reviewvolgorde toe. Legacy null-projecten blijven bruikbaar. Commandcorrelatie legt request/result aan uitvoering, manifest en call vast. Een unieke index beschermt manifestcall-ID's. De periodequery gebruikt een tijd/ID-index. De API is de schrijver voor deze gebruikers- en evidencegegevens. Collector-data gaan naar de debug-exporter en leven niet als collectorontvangst in deze tabellen.

Bronnen `apps/api/src/db/migrations/001_init.sql` tot `013_script_projects.sql`, `apps/api/src/repositories/{scripts,executions,execution-period,execution-history,risk}.ts`. Tabellen zijn geïnventariseerd uit actuele migraties. Er is geen export van live rijen gemaakt.
