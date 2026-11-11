# Vragen voor de mondelinge verdediging

Koppel antwoorden aan de hoofdstukken over uitvoering, security, registry, onderzoek en UI. Iedere vraag gaat over dit project.

## Architectuur

1. **Wat is de kleinste uitleg van Runlattice?** Een werkbank voor tijdelijke, begrensde scripts die alleen via benoemde bevoegdheden Minecraft kunnen aanroepen.
2. **Waarom een aparte runner?** Daar ligt de job-lifecycle en Docker-socket. De API beheert verzoeken en opslag.
3. **Waarom is Paper geen onderdeel van de sandbox?** De hostwereld blijft buiten de levensduur en bevoegdheden van het script.
4. **Wat is het verschil tussen API en Gateway?** API beheert productrecords. Gateway controleert hostcalls en gebruikt het interne API-pad om ze te queuen.
5. **Is Azure nodig?** Nee. Compose kan lokaal starten en mockproviders zijn beschikbaar.

## Beveiliging

6. **Kan de browser Docker-flags kiezen?** Nee. De route valideert een profiel-ID en de runner bouwt vaste flags.
7. **Kan Gemini een bevoegdheid toestaan?** Nee. Gemini doet een voorstel. Een review van de versie levert de invoer voor Gateway-autoriteit.
8. **Is een bereikbaar Gateway-adres voldoende?** Nee. De sessie, het peerverband, de capability, de argumenten en quota blijven gecontroleerd.
9. **Wat laat één collectoruitval zien?** In de geteste situatie bleven uitvoering, autorisatie en duurzame DB-evidence werken.
10. **Is de API productie-authenticated?** Er zijn servicecredentials voor technische paden. Er is geen algemeen productiegebruikersmodel.

## Deno

11. **Wat krijgt none?** Geen extra Deno-runtimegrants en geen Docker-netwerk.
12. **Wat geeft read-fixture?** Read-grant voor /fixtures.
13. **Kan env-demo API-secrets lezen?** Het profiel geeft alleen SANDBOX_DEMO_VALUE.
14. **Wat betekent een native permissieobservatie?** Een geregistreerde access/check, zonder zelfstandig allow/deny-resultaat.
15. **Waarom werkt import uit host alleen bij hostprofielen?** Daar levert de trusted importmap de bare specifier en het profiel geeft smal transport.

## Docker

16. **Welke standaard joblimieten onthoud je?** 10 s wall-time, 0,5 CPU, 256 MiB geheugen, 64 PIDs en 1 MiB capture.
17. **Waarom read-only root met tmpfs?** De job kan op voorspelbare tijdelijke locaties werken terwijl de image niet blijvend wijzigt.
18. **Wat gebeurt er bij een derde actieve job?** De runner weigert met 429 bij de standaardcapaciteit van twee en heeft geen wachtrij.
19. **Waarom kan capaciteit bezet blijven na een fout?** Zolang cleanup onzeker is, wil de runner geen slot onterecht opnieuw toekennen.
20. **Waarom toont timeout toch stdout?** De output is tijdens de job al deels gecaptured. De auditafsluiting kan nog ontbreken.

## gVisor

21. **Wat is runsc?** De optionele gVisor OCI-runtime.
22. **Was de normale demo runsc?** De normale Docker Desktop-stack gebruikt de Engine-default; het gematchte runsc-experiment draaide apart.
23. **Waarom telde W6 als compatibel?** De vooropgestelde taak was gecontroleerde timeout en cleanup.
24. **Wat faalde bij W8?** De Gateway-hostnaam resolveerde niet onder het gemeten runsc-netwerk.
25. **Bewijst direct-IP dat W8 slaagde?** Nee. Een afzonderlijke healthdiagnose beperkte de mogelijke oorzaak. De gemeten W8-uitkomst bleef ongewijzigd.
26. **Was runsc aantoonbaar veiliger?** Het onderzoek toonde geselecteerde controls en compatibiliteit, zonder universele effectiviteitsmaat.

## Gateway en manifests

27. **Waar worden requests opgeslagen?** In script_capability_manifests, gekoppeld aan script_versions.
28. **Kan een review worden herschreven?** De database-update-trigger beschermt de geschiedenis. Een nieuwe review wordt toegevoegd.
29. **Wat doet partial approval?** Alleen de gekozen subset komt in de execution-authority.
30. **Wat gebeurt met de review na wijziging van één helper?** De canonieke bundel en hash wijzigen bij Save. De nieuwe versie heeft een eigen review.
31. **Wat is de totale manifestcallgrens?** 12 per sessie, daarnaast geldt een per-capabilitygrens.
32. **Is QUEUED hetzelfde als Paper-succes?** QUEUED bevestigt enqueue. Een gekoppeld Paper-resultaat is het bewijs voor CONFIRMED.
33. **Waarom staan sommige posities niet toe?** De eerste wereld, spawnzone en geladen chunks begrenzen wereldimpact.
34. **Kan world.setBlock bedrock aanpassen?** CommandExecutor beschermt bedrock en TileState.

## Jev en regels

35. **Wat geeft de deterministische analyzer terug?** Klasse, score en rule-gebaseerde redenen voor bekende evidence.
36. **Wat wint als REVIEW en HIGH beide matchen?** HIGH heeft voorrang.
37. **Kan FAILED tegelijk LOW zijn?** Ja. Procesfout en risicoklasse beantwoorden verschillende vragen.
38. **Welke modelpin is gebruikt?** typesafe-ai/jev-1.14.0 via Vercel.
39. **Waarom tellen 125 calls als 25 scenario's?** Elke case kreeg vijf herhaalde classificaties.
40. **Wat was het resultaat?** Deterministisch 24/25, Jev 16/25 per casemodus en 84/125 per afzonderlijke call.
41. **Wat is HOL-008?** De subprocesspoging ontbreekt in vertrouwde observaties. Beide analyzers labelden LOW bij REVIEW-referentie.
42. **Kon Jev redenen teruggeven?** De adapter ontving een getypeerde keuze en kansen. Getoonde evidence-redenen konden lokaal ontstaan.

## Telemetry en database

43. **Welke service emit de hoofdtrace?** De API reconstrueert OTLP-spans op basis van vertrouwde records.
44. **Is een opgeslagen execution bewijs van collectorontvangst?** Nee. Daarvoor is afzonderlijke export/collectorobservatie nodig.
45. **Is er een duurzame tracebackend?** De huidige collectorconfig gebruikt debug-export. PostgreSQL bewaart applicatie-evidence.
46. **Waar staan projectbestanden?** JSONB project in script_versions, met legacy ondersteuning.
47. **Wat bindt een hostresultaat aan een run?** Execution-, trace-, call- en commandcorrelatie waar beschikbaar.

## Editor en product

48. **Welke bestanden zijn toegestaan?** Maximaal twintig .ts-, .js- of .json-bestanden binnen de bundellimieten.
49. **Is JSON een entrypoint?** Nee. Entrypoint is bestaand .ts of .js.
50. **Krijgt een actieve run een procentmeter?** Nee. De interface gebruikt bekende API-statussen en elapsed time.
51. **Waarom werkt een opgeslagen run buiten de periode?** Een directe Workbench-link kiest een execution-ID apart van het periodefilter.
52. **Wat staat in capability export?** Execution-ID, authority-manifest en verzamelde hostcalls.
53. **Is Settings netwerkintentie een permission?** Nee. Het is context voor voorstellen.

## Methodologie en toekomst

54. **Waarom verschilt reproduceerbaarheid van referentieovereenstemming?** Een model kan consistent hetzelfde afwijkende label geven.
55. **Wat zegt 9/10 over andere servers?** Het is een resultaat voor de tien bevroren workloads en opstelling.
56. **Waarom zijn nieuwe features niet bij frozen onderzoek geteld?** Ze zijn later toegevoegd en hebben eigen post-research validatie.
57. **Wat zou je eerst verbeteren voor gedeeld gebruik?** Gebruikersidentiteit, autorisatie en netwerkexposure krijgen prioriteit.
58. **Hoe verbeter je empirische externe validiteit?** Meer diverse scenario's, onafhankelijke labels en meerdere hostopstellingen.
59. **Hoe leg je de dependency-audit eerlijk uit?** De actuele npm-scan vindt dev-problemen. De productie-only frontendscan is geen audit van alle services.
