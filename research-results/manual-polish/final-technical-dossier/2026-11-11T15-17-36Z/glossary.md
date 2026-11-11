# Begrippenlijst

| Term | Betekenis in Runlattice |
|---|---|
| Sandbox | tijdelijke jobomgeving met Deno en Docker |
| Untrusted code | bron van gebruiker of assistant die alleen binnen de job wordt uitgevoerd |
| Defense-in-depth | onafhankelijke grenzen voor proces, resourcegebruik en hosteffecten |
| Deno permission | runtimegrant voor een specifiek type en domein |
| Container | geïsoleerde Docker-job met eigen lifecycle |
| runc | normale OCI-runtime in de onderzochte Desktop-opstelling |
| runsc | optionele gVisor-runtime |
| gVisor | extra syscall- en kernelabstractie tussen job en Linux-host |
| Capability | expliciet benoemde Minecraft-operatie met schema en quota |
| Capability manifest | opgeslagen aanvraagset voor één versie en bronhash |
| Host Gateway | service die hostauthority controleert vóór enqueue |
| SecureBridge | Java-plugin die beperkte Paper-opdrachten uitvoert en bevestigt |
| Evidence | beschikbare proces-, permissie- en hostrecords |
| Observation | geregistreerde access/check, zonder per-event allow/deny-betekenis |
| Provenance | herkomst en bewijskracht van een UI-feit |
| Observed | ondersteund door een vertrouwd vastgelegd record |
| Inferred | afgeleid via bekende correlatie |
| Advisory | afzonderlijke risicointerpretatie zonder uitvoerbevoegdheid |
| Deterministic | gelijke evidence en rules geven dezelfde class |
| Jev | modelgebaseerde optionele evidenceclassificatie |
| OpenTelemetry | telemetrystructuur voor spans en reconstructie |
| OTLP | protocol voor export naar de collector |
| Trace / span | gekoppelde observaties / één onderdeel met timing |
| Correlatie | verbinden van execution, trace, call en command IDs |
| Timeout | runner stopt job bij wall-timegrens |
| OOM | out-of-memory, een resourceprobleem, niet hetzelfde als timeout |
| Fail-closed | weigering of behoud van blokkade bij ontbrekende geldige autorisatie of onzekere cleanup |
