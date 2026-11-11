# Uitvoering, voortgang en technisch bewijs

1. Workbench selecteert een opgeslagen scriptversie en een profiel. Vuile bron wordt eerst opgeslagen. `POST /api/executions` verwacht `scriptId`, optioneel `scriptVersionId` en `permissionProfile`. Onbekende profielen en ruwe permission- en Docker-opties worden geweigerd.
2. `ExecutionService.start` in `apps/api/src/services/mock-execution.ts` valideert de versie en maakt een record. Voor manifestmodus bouwt de API een versiegebonden execution-authority op. Ontbrekende vereiste review of keuze voor legacy host-chat bij een manifestversie wordt vóór de recordaanmaak afgewezen en de route retourneert HTTP 400.
3. API retourneert het record met HTTP 201 na de synchrone startvalidatie. De eigenlijke job en advisory-afhandeling lopen asynchroon. De Docker-provider stuurt de opgeslagen snapshot naar de supervisor via `POST /execute`. Mock is een gesimuleerde provider.
4. De runner valideert de aanvraag, reserveert lokaal capaciteit en configureert een verse container. Vol betekent supervisor-HTTP 429, zonder wachtrij. Het frontend heeft al een apart API-record en ziet de uitkomst via dat record. Bij onzekere cleanup blijft capaciteit behouden totdat de runner herstel kan bevestigen. Zie `admission.ts`, `docker.ts` en `main.ts`.
5. De sandbox materialiseert de geselecteerde snapshot met `materialize.ts` in zijn tijdelijke workspace. `entrypoint.sh` start Deno zonder permissieprompts. De runner beheert capture, wall-time, inspectie en cleanup. Met hostprofiel krijgt deze job een tijdelijke Gateway-sessie.
6. De runner retourneert processtatus, begrensde stdout/stderr, duur, auditstatus en runtimegegevens. De container wordt opgeruimd. API schrijft resultaat en observaties in PostgreSQL, gevolgd door afzonderlijke advisory-analyse op de beschikbare records. Een analysefout blijft een analysefout.
7. `useExecutionMonitor` leest record en gebeurtenissen via polling, typisch om de 3 s. De API heeft tevens een events-SSE-route. De werkbank toont meteen een verzendstatus en verstreken tijd. De UI toont geen percentage of bewezen container-starttijd als alleen een API-status bekend is. Na terminale status kan een begrensde extra refresh late evidence/advisory ophalen. Een laadfout heeft retry met backoff.

## Runtimewaarden en profielen

Standaard Deno 2.9.7, UID/GID 1993:1993, vaste image `research-poc-sandbox:local`. Configuratie gebruikt 0,5 CPU, 256 MiB geheugen en begrensde swap, 64 PIDs, `--read-only`, tmpfs 64 MiB voor workspace en 16 MiB voor tmp, alle capabilities gedropt, no-new-privileges, 10.000 ms wall-time en 1.048.576 bytes output. Auditbudget 200 observaties en 65.536 bytes. Twee actieve jobs per runner. Configuratie is bronaudit. Fasen 2, 4 en 5 bevatten afzonderlijke gedragsproeven voor geselecteerde controls. De Deno audit logt access/check, stdout blijft scripttekst.

| Profiel-ID | UI / API-label | Grants | Voorbeeld |
|---|---|---|---|
| none | No permissions | Geen runtimegrants, netwerk none | console.log(2 + 2) |
| read-fixture | Read test fixture | Alleen lezen binnen /fixtures, netwerk none | Lees baked-in fixture |
| env-demo | Demo environment in Workbench / Demo environment variable in public config | Alleen SANDBOX_DEMO_VALUE, netwerk none | Log de demowaarde |
| host-chat | Chat broadcast (fixed) in de tooltip / Chat broadcast in public config | SDK-read, beperkte env en netwerk naar Gateway, vaste legacy-chatgrant, alleen historische versies zonder manifest | Serverbrede demo-aankondiging |
| host-capabilities | Per-script permissions / Approved host capabilities | Dezelfde smalle SDK-transportgrants, authority uit de opgeslagen review | server.status na review |

Geen profiel geeft algemeen bestands-, netwerk-, subprocess-, schrijf- of FFI-recht. Statische moduleloading van opgeslagen lokale modules is iets anders dan willekeurige `Deno.readTextFile`-toegang. Het vertrouwde importmap maakt `host` beschikbaar in de hostprofielen.

## Uitkomst, fouten en provenance

`completed` betekent normale procesuitkomst. `failed` kan een onopgevangen scriptfout of infrastructurele fout betekenen. `terminated` wordt onder meer gebruikt voor de wall-time stop. `blocked` gaat over een geweigerde start. API-statussen zoals `validating` en `running` hebben de betekenis van het API-record. `ExecutionFeedback.tsx` projecteert Request, Process, Result, Evidence, Assessment op basis van beschikbare gegevens. `execution-errors.ts` maakt onder andere host-SDK/importfouten, syntax/runtimefouten, permissieweigering, ontbrekende module, timeout en infrastructuur leesbaar. Output wordt begrensd en voor weergave ontdaan van ANSI/control sequences. Een herkende bronlocatie kan het overeenkomstige bestand en regel in de editor openen. De ruwe opgeslagen uitkomst blijft behouden.

Runner `frames.ts` onderscheidt scriptstdout van de vertrouwde audit-/runtimeframes. Het resultaat bewaart een exitcode indien beschikbaar, truncatie en een foutcategorie. De runner redigeert bekende execution-credentials in de vastgelegde uitvoer. Afwezigheid van een frame of een capturelimiet wordt expliciet als collectieconditie behandeld. Een gebruikersbericht dat op een diagnostische melding lijkt, krijgt daarmee geen bronprovenance. Bron `services/runner/src/{frames,output,docker,audit-collection}.ts`.

Bij een oneindige lus grijpt de wall-time deadline in. Eerdere stdout kan reeds in de buffer staan. `job_wall_timeout` verklaart de stop. `missing_audit_frame` zegt dat de verwachte terugmelding van de audit ontbreekt. Termination kan een HIGH-regel voeden. Dat label staat los van bewijsbeschikbaarheid en procesuitkomst. Het bekeken record toont 10.440 ms gemeten duur rond een geconfigureerde grens van 10 s.

| Term | Betekenis | Voorbeeld |
|---|---|---|
| complete | Collectie eindigde volgens de collectiecriteria | Een geldige audit kan nul records hebben |
| partial | Slechts deel van de waarnemingen bruikbaar | Event- of bytecap |
| unavailable | Geen bruikbare verzameling | Ontbrekend auditframe na timeout |
| legacy_unknown | Oud record mist actuele collectieprovenance | Historische onderzoekscorpusrecords |
| Observed | Ondersteund door vertrouwd record | Opgeslagen Paper-antwoord |
| Inferred | Afgeleid uit gerelateerde records | Delivery uit gekoppeld commandresultaat |
| Not recorded | Benodigd record ontbreekt | Onafhankelijk deliverytijdstip |
| Not applicable | Stap was niet relevant | Hostpad bij pure console-run |
| Configured | Ingestelde waarde | Verwachte Deno-versie uit runnerconfig |

Een native auditobservatie bewijst geen allow/deny-beslissing voor die individuele toegang. Volledige collectie garandeert alleen de status van het collectieproces. Een niet-geregistreerde poging zoals HOL-008 kan onzichtbaar blijven.

Bronnen `apps/api/src/routes/executions.ts`, `apps/api/src/services/mock-execution.ts`, `services/runner/src/{config,permissions,admission,docker,audit-collection}.ts`, `services/sandbox/{Dockerfile,entrypoint.sh,materialize.ts}`, `apps/web/src/{execution-errors,execution-ux,useExecutionMonitor}.ts`.
