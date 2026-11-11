# Aanvullende bronverificatie

## Lifecycle, status en runtime

`ExecutionStatus` in `apps/web/src/types.ts` bevat `queued`, `validating`, `analysing`, `running`, `completed`, `blocked`, `failed`, `terminated`. De benaming `queued` hoort bij het persistente API-startrecord en betekent geen algemene schedulerqueue voor volle runner-slots. `ExecutionService.runPipeline` volgt na de aanmaak van dat record. De UI kan lokaal al “Sending” tonen vóór het API-record bestaat. Verstreken tijd is in dat stadium client-observatie. Een proces dat terugkeert kan een ander resultaat, andere collectie en nog geen assessment hebben. De stepper projecteert die losse feiten.

De runner vraagt TTL gelijk aan sandbox-timeout plus 30 seconden. Bij de standaardtimeout is dat 40 seconden. Configuratie noemt daarnaast een Gateway-default en maximale TTL. `SecureBridgePlugin.java` plant heartbeat na 40 ticks en elke 100 ticks, polling na 60 ticks en elke 40 ticks. Minecraft-ticks zijn geen gegarandeerde wall-clock-intervallen. Poll/result-verkeer is asynchroon. Paper voert de wereldactie op de serverthread uit. Getagde demo-entiteiten krijgen opruiming na 1.200 ticks. De hostgame kan gedrag beperken, bijvoorbeeld door `DIFFICULTY: peaceful`.

De tijdens inspectie uitgelezen Engine-default was `runc`. De Compose-config laat de sandbox runtime leeg tenzij expliciet geconfigureerd. De dossierinspectie maakte geen nieuwe job aan om die keuze onafhankelijk te observeren.

## Insights en Settings

De periodedisclosure bevat `Completed`, `Advisory LOW`, `Advisory REVIEW`, `Advisory HIGH`, `Failed`, `Terminated`, `Complete evidence` en `Average duration`. De actieve periodeview gebruikt deze numerieke definitielijst. De totale telling omvat alle passende statussen, ook wanneer geen afzonderlijke statistiek voor die status bestaat. Gemiddelde duur gebruikt alleen records met duur. De API accepteert 1–200 resultaten per page, de UI vraagt 50. Begin is inclusief en einde exclusief. `Today` gebruikt lokale kalendergrenzen. Een paginawissel gebruikt dezelfde querytijdgrenzen. Er is geen gegarandeerde transactiesnapshot over alle pagina's bij gelijktijdige databasewijzigingen.

`ProjectSettingsPanel.tsx` gebruikt een debounced PATCH voor bewerkbare voorkeuren, aparte resetbevestiging en previews voor effectieve context. Bronwaarden uit `config/project-spec.yaml` beschrijven host, bridge, scripting, security en project. Bewerking van taal en intentievlaggen werkt via `project_settings`. Status van live Paper komt uit Host Activity. `project.executionEnforcement: mocked` is als legacy contextmetadata gemarkeerd. Het live publieke configendpoint meldde `docker`; voor de werkelijke provider is dat het relevante runtimegegeven. `arbitraryConsoleCommands` en `directMinecraftPluginGeneration` zijn contextintentie. Een optionele voorkeur verandert de vaste Paper-enum of Deno-grants niet.

## Andere opvallende verificatiepunten

- De werkende runtime gebruikt oude en nieuwe records naast elkaar. `legacy_unknown` is legitieme expliciete onzekerheid.
- Directe hostcommando's zijn via `POST /api/host/commands` bewust uitgeschakeld. De Bridge mag alleen de beschreven servicepaden gebruiken.
- De registry- en materialisatiegrenzen zijn op meerdere plaatsen afgedwongen. `packages/contracts/tests/platform_test.ts` bewaakt ook gelijkheid van het gegenereerde Java-resourcebestand.
- Exacte serviceversies zijn waar mogelijk uit Compose, buildbestanden of publieke status gehaald. Een latere runtimecheck kon live tabelnamen of jobproceswaarden niet verzamelen nadat de stack gestopt was.
- Bevroren integriteit vergeleken met de eerder opgeslagen baseline. Alle 1.800 SHA-256-waarden matchen. Git-status buiten de dossiermap hield dezelfde aantallen als bij aanvang.

