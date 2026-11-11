# Onderzoeksresultaten en verdediging

## Actueel adviespad

LOW staat voor geen gevonden escalatieregel in het beschikbare bewijs, REVIEW voor relevante signalen die beoordeling vragen en HIGH voor sterkere regels. Een gefaald script met complete collectie en LOW is mogelijk, bijvoorbeeld bij een gewone scriptfout zonder escalatiesignaal. Het omgekeerde kan ook bij opgevangen gedrag. Advies beslist niet over autorisatie.

De deterministische analyzer leest gestructureerde termination, permission observations en Host Gateway-evidence. `deterministic.ts` en `rules.ts` leveren vaste labels, score en reden/rule-ID's. Hoogste severity wint. R001 permissiegerelateerde procesfout, R004 geweigerde hostcall, R007 truncatie, R009 onverwachte read, R011 onverwachte env en R012 onverwachte netobservatie leiden tot REVIEW. R002 subprocess, R003 FFI, R005 herhaalde hostweigering/budget en R006 timeout leiden tot HIGH. Geen match betekent LOW binnen die regels. De actuele lokale analyzer is deterministisch. `comparison` behoudt het deterministische runtimepad. `jev` kan met passend account en configuratie als adviespad draaien. Fouten/time-outs leveren een afzonderlijke falende assessmentstatus.

Jev ontvangt een door de adapter geconstrueerde, begrensde representatie van gestructureerde evidence en policy. Geen bron, stdout, referentielabels of deterministisch antwoord als classificatie-invoer. Er is een providerkeuze TypeSafe/Vercel, met verschillende sleuteltypes. Standaardmodel per route `jev-1.14.0` respectievelijk `typesafe-ai/jev-1.14.0`, deadline standaard 30.000 ms. De adapter valideert onder meer klasse/distributie. Providerstatus, schema, latency en versies worden bij het resultaat bijgehouden waar beschikbaar. Modelvertrouwen is modeloutput en de weergegeven reden kan lokaal gegenereerd zijn. Zie `apps/api/src/risk/{jev,jev-input,jev-policy,jev-route,rules,deterministic}.ts`, `providers/risk.ts` en `services/advisory.ts`. De post-research capability-review staat los van beide analyzers.

## Phase 3 bevroren Jev-vergelijking

Vercel AI Gateway, pin `typesafe-ai/jev-1.14.0`. Na eerdere accountblokkade waren 3 smoke-, 125 primaire en 15 sensitiviteitscalls technisch geldig, 143 totaal. De 125 zijn 25 scenario's × vijf herhalingen. Geen retries of providerfouten in de afgeronde batch. Corpus bestaat uit 15 gesloten ontwikkelcases en 10 holdout-varianten.

| Partitie | Jev individueel | Jev modus | Deterministisch |
|---|---:|---:|---:|
| Development | 54/75 | 10/15 | 15/15 |
| Holdout | 30/50 | 6/10 | 9/10 |
| Totaal | 84/125 (67,2%) | 16/25 (64%) | 24/25 (96%) |

Beide volgen de referentie in 16 cases, deterministisch alleen in 8, Jev alleen in 0 en geen van beide in 1. Er zijn 23 unanieme cases. SCN-010 en SCN-013 splitsten 3 tegen 2. 121/125 antwoorden volgen de eigen casemodus (96,8%) en 238/250 antwoordparen stemmen overeen (95,2%). Primaire latency 180–535 ms, mediaan 230 ms, gemiddelde 246,232 ms en p95 397 ms. HOL-008 mist een vertrouwde observatie van de subprocesspoging. Beide zien LOW tegenover referentie REVIEW. Het ontbrekende signaal kan niet betrouwbaar uit de beschikbare records worden herleid. Jev was op dit corpus minder vaak in overeenstemming met de referenties en bood geen aangetoonde incrementele overeenstemmingswinst. Dit is geen algemene malwarebenchmark of generaliseerbare accuratesse.

Er was bovendien één bewaarde mislukte poging vóór het hervatten, HTTP 403 met `customer_verification_required`. Die kreeg geen risicoklasse en blijft buiten de successtatistiek. De sensitiviteitsproef gebruikte vijf cases met drie vooraf vastgelegde presentaties van dezelfde feiten. Vier cases hielden hun klasse. SCN-010 wisselde tussen REVIEW en HIGH. Eén call per vorm en bestaande variatie laten geen causale toeschrijving aan opmaak toe.

Bron `research-results/phase3-jev/resume-after-credit-2026-11-09/report.md` en `per-case-analysis.md`.

## Phase 4 bevroren runc/runsc-vergelijking

Native Docker binnen Ubuntu 24.04.2/WSL2, kernel 6.6.87.1, Docker 29.9.3, containerd 2.4.2, runc 1.5.2, runsc release-20261102.0 met systrap, Deno 2.9.7. De normale Desktop-stack bleef gescheiden. Per workload/runtimetype vijf gemeten pogingen, 100 totaal, plus 20 warm-ups en 10 runc-preflights. 85 completed, 10 geplande timeouts, 5 W8-fouten, nul ongeldige infrastructuurmetingen en nul reruns.

| Workload | Taak | Mediane duur runc / runsc ms | Ratio |
|---|---|---:|---:|
| W1 | JavaScript | 429 / 799 | 1,862× |
| W2 | TypeScript | 426 / 777 | 1,824× |
| W3 | begrensde read | 451 / 781 | 1,732× |
| W4 | begrensde env | 434 / 798 | 1,839× |
| W5 | opgevangen readweigering | 477 / 801 | 1,679× |
| W6 | verwachte timeout | 10289 / 10257 | 0,997×, geen overheadmaat |
| W7 | outputcap | 483 / 1113 | 2,304× |
| W8 | host-chat | runc 5/5 bevestigd, runsc 0/5 | geen vergelijkbare succesratio |
| W9 | zwaardere CPU | 521 / 844 | 1,620× |
| W10 | zwaardere toegestane I/O | 592 / 1548 | 2,615× |

Negen workloads voldeden in beide runtimes. W8 faalde bij DNS voor Gateway-hostnaam onder onveranderd runsc-netwerk. Een aparte direct-IP-healthdiagnose bevestigde dat die route bereikbaar kon zijn. Dat verandert de W8-score niet. Operationele runtime-attributie kwam uit host/daemonrecords en geselecteerde controls, geen cryptografische attestatie. gVisor biedt conceptueel een extra kernelabstractie, het experiment kwantificeerde geen beveiligingswinst en testte geen algemene ontsnappingsbestendigheid. Normale Compose laat de Engine-runtime standaard kiezen, runsc vereist opt-in en registratie. Bron `research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched/report.md`, `compose.gvisor.yaml`, `docs/PHASE4A-NATIVE-WSL.md`.

## OpenTelemetry en Phase 5

`apps/api/src/telemetry/otel.ts` exporteert vanuit API een OTLP-reconstructie met execution- en sandbox-spans, timing en gerelateerde gebeurtenissen. Execution-, trace-, call- en command-ID's helpen records koppelen. De collector gebruikt een debug-exporter in `infrastructure/otel/otel-collector-config.yaml`. PostgreSQL staat los van ontvangst door de collector. Bij één geteste collectoruitval bleven Deno-beperking, Gateway-controle, Paper-effect en PostgreSQL-writes werken. Exportfout was zichtbaar en een latere trace kwam weer aan. Geen garantie op replay of volledig end-to-end geïnstrumenteerde Paper-spans. Phase 5 testte E1–E8 op Desktop/runc en een verse geïsoleerde reproductiestack. Bron `research-results/phase5-final-validation/2026-11-09T15-24-05Z/report.md`.

## Fasen en resultaten

| Fase | Doel en resultaat |
|---|---|
| 0 | Read-only begininventaris. Gedateerde uitgangssituatie onderscheiden van latere reparaties. |
| 1 / 1B | Vertrouwensgrenzen en evidence stabiliseren, gevolgd door gedeployde controle. Zie phase1- en phase1b-artifacts. |
| 2 | Admissie, lifecycle, herstel en afzonderlijk falend advies. Controls in control-matrix en failure-matrix. |
| 3 | Bevroren vergelijking van Jev en deterministische baseline. 24/25 tegenover 16/25 modaal. |
| 4 / 4A–C | Native WSL-runsc voorbereiden en matched workloads uitvoeren. 9/10 compatibel, DNS-verschil bij W8. |
| 5 | End-to-end bevestiging op normale stack, verse reproductie en één collectoruitval. |
| 6 | Demo-, documentatie- en regressieopruiming met 190 gedocumenteerde passes en een later gedeployde DB-check. |
| 7 | Claims, beperkingen en beantwoording aan het bewijs koppelen. |
| 7.5 | Professionele UI-polish, ontwerp en toegankelijkheid. |
| Later | Herstelde Gemini, evidence-UX, Runlattice, manifests, tien capabilities, multi-file en nieuwe Insights-periodeflow. |
| Nu | Read-only dossier van werkboom en draaiende lokale interface. |

## Onderzoeksvraag beantwoorden

**Detecteren.** Audit en hostrecords ondersteunen interpretatie van zichtbaar gedrag. HOL-008 toont dat geregistreerde evidence geen volledig beeld geeft. Jev kon ontbrekende observaties niet herstellen. De deterministische regels hadden in dit experiment hogere referentieovereenstemming.

**Isoleren.** Jobs draaien tijdelijk met beperkte Deno-grants, afzonderlijke containers en beperkte netwerken. Phase 4 valideerde specifieke operationele kenmerken en compatibiliteit van een extra runsc-grens. De architectuur motiveert die grens. Algemene ontsnappingsbestendigheid werd niet aangetoond.

**Beperken.** Timeout, output, CPU/geheugen/PID-configuratie, lokale capaciteit en de geautoriseerde hostinterface begrenzen verschillende effecten. Phase 5 demonstreerde reële weigering en Paper-bevestiging binnen het historische chatpad. De huidige tien-capability-interface heeft eigen post-research validaties.

**Defense-in-depth.** De collector mag wegvallen zonder de toegangscontrole over te nemen. Een bereikbare Gateway controleert alsnog bevoegdheid. Een onjuiste of ontbrekende classificatie kan de run of goedkeuring niet omzetten.

**Academisch.** De gecontroleerde waarnemingen ondersteunen het vermogen van de architectuur om geselecteerde effecten te isoleren en begrenzen, en waargenomen gedrag te interpreteren. De mate van detectie hangt af van instrumentatiedekking, de gebruikte labels, de taakverdeling en de geteste omgeving. De onderzochte runsc-configuratie levert bewijs voor compatibiliteits- en prestatieverschillen, geen gemeten universele beveiligingswinst.

**Eenvoudig.** We kunnen scripts tijdelijk en met weinig bevoegdheden uitvoeren. We kunnen terugzien wat de instrumentatie registreerde en Paper-acties controleren. Sommige pogingen blijven onzichtbaar en de risicolabels zijn alleen advies.

**Mondeling, circa twintig seconden.** “We voeren scripts uit in tijdelijke containers met vaste rechten. Minecraft-acties gaan door een aparte controle en Paper meldt het resultaat terug. De logs tonen een deel van het gedrag. In onze 25 testcases volgden vaste regels de referenties vaker dan Jev.”

## Getallen en claims

| Getal | Onthoud waarom |
|---|---|
| 24/25, 16/25, 84/125 | deterministisch, Jev-casemodus, individuele Jev-calls tegen referentie |
| 5, 23/25 | herhalingen per case, unanieme cases |
| 9/10, 100 | compatibele workloads en gemeten runs |
| 1,62–2,62× | runsc-medianen voor vergelijkbare succesvolle niet-timeout workloads |
| 2, 10 s, 256 MiB, 64 | standaard actieve jobs, tijdgrens, geheugen en PIDs |
| 10, 12 | actuele capabilities en totale manifestcallgrens |

Veilige claims zijn dat de geselecteerde proeven dit gedrag aantoonden, dat de Gateway een aanvraag buiten scope weigert, en dat bij de geteste collectoruitval handhaving bleef werken. Vermijd “onmogelijk te ontsnappen”, “Jev detecteert malware”, “complete audit ziet alles”, “gVisor is X procent veiliger” en “alle nieuwe capabilities zijn in Phase 3 of 4 getest”.
