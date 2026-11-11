# UI-inventaris

Workbench, Execution Insights, Host Activity en Settings zijn de hoofdnavigatie. De applicatieshell toont API/Paper-status, thema en Help. De browser weergave is Runlattice. Themavoorkeur is lokale browserstate. Console- en editorachtergronden hebben beide themawaarden.

| Scherm | Control en type | Gedrag | Backend / grens |
|---|---|---|---|
| Shell | navigatie, statusbadges | wisselt hoofdpagina, toont gezondheid | health en hoststatus lezen |
| Shell | thema, knop | licht/donker inclusief console | geen bevoegdheidswijziging |
| Shell | How to use, dialoog | bewijsbegrippen, workflows, ondersteunde profielen en grenzen | leesinformatie, Escape sluit |
| Workbench | Script Library, zoekveld en lijst | filtert en opent script | scriptgegevens lezen |
| Workbench | Assistant conversations, lijst | gesprek openen of starten | gesprekken lezen/maken |
| Workbench | Selected script runs, lijst | recente run selecteren | record lezen, volledige periodehistorie in Insights |
| Workbench | New script / naam / Language | start concept, kiest TS of JS | Save maakt/opdateert script |
| Workbench | Execution profile, select + info | kiest ID en legt per profiel grants uit | een keuze op zichzelf keurt niets goed |
| Workbench | Save changes | bewaart nieuwe snapshot van gewijzigde bestanden | versieroute, vorige versie blijft bestaan |
| Workbench | Run | start opgeslagen versie | POST executions, geen stilzwijgende review |
| Workbench | Execution status | verstuurd/actief/uitkomst, elapsed time | polling, geen percentage |
| Workbench | View in Execution Insights | opent specifieke run | kan buiten huidige periode staan |
| Workbench | What are the limits? | dialoog met registry, SDK-voorbeelden, quota, grenzen | registry lezen, geen runtimewijziging |
| Editor | file tabs, Project files | selecteert actief bestand, plus add/rename/delete en entrypoint | conceptbewerking tot Save |
| Editor | Script versions & availability | opgeslagen versies en bijbehorende status/metadata | versie lezen |
| Permissions | Review permissions | kiest expliciet ja/nee, opent review met versiecontext | schrijft review pas na bevestiging |
| Permissions | Export manifest JSON | lokaal downloaden | opgeslagen manifest, geen volledige uitvoer |
| Assistant | Open/Hide assistant | paneel naast editor of gestapeld op smalle schermen | weergave |
| Assistant | bericht, Send | stuurt tekst met opgeslagen context via API | Gemini/OpenAI/mock volgens configuratie |
| Assistant | proposal, bestandsdisclosures | bekijkt code, entrypoint en meerdere bestanden | voorstel blijft invoer |
| Assistant | Yes/No en bevestiging | expliciete keuzes inline, opslaan als draft | versie + review, geen Run |
| Evidence | uitkomst, duur, profiel, collectie, assessment | onderscheiden metadata en info-iconen | stored evidence |
| Evidence | execution path, Why this result? | vijf stappen, provenance, diagnose, uitklapbare details | afgeleid uit records |
| Evidence | Output, tab | stdout/stderr, copy, fout en links naar bronregels | scriptoutput blijft onbetrouwbare tekst |
| Evidence | Evidence, tab | permission observations, hostpad, security events | nul observaties verschilt van onbeschikbare collectie |
| Evidence | Runtime, tab | manifest en runtimevelden met bekende provenance | geen onafhankelijke attestation |
| Evidence | Timeline, tab | chronologie van beschikbare records | geen ontbrekende tijden invullen |
| Evidence | Export capability evidence JSON | download als authority bestaat | executionId, manifest, actualCalls |
| Insights | Period, select | Today, Last 24 hours, Last 7 days, Last 30 days, Custom range | serverquery, lokaal tijdzone-input |
| Insights | From/To, velden | custom begin inclusief en eind exclusief | maximaal 366 dagen |
| Insights | Provider, select | all, Docker of mock | queryfilter |
| Insights | Sort history, select | nieuwste, oudste, langste of kortste | server-side sortering |
| Insights | Refresh, prev/next | herlaadt en pageert in pagina's van 50 | offset maximaal 100.000 |
| Insights | periode-statistiek, disclosure | totaaltelling, uitkomsten, audit, advisory en duur | aggregaten over complete matchende query |
| Insights | Execution history, rijselectie | opent bewijs van die uitvoering | geen oud script/run-selectpaar, geen globale latest-100 afhankelijkheid voor periodequery |
| Host Activity | Server status, Refresh | Paper-connectie, spelersaantal, versies, heartbeat | read-only hoststatus |
| Host Activity | All/Players/Chat/Commands/System en Recent events | filtert events en kiest aantal | host-events lezen |
| Host Activity | activiteitsrij | details, ID's en provenance openen | Paper-bevestiging vereist opgeslagen correlatie |
| Settings | taal en contextnotices | wijzigt voorkeur, toont oorsprong en contextmetadata | projectcontext, niet Deno |
| Settings | netwerk, filesystem, subprocess, FFI | intentievlaggen voor assistent | geen permission flags |
| Settings | omgeving, console/plugin-intentie en overige voorkeuren | stuurt context en toont geconfigureerde metadata | geen command executor of runtime-override |
| Settings | save/reset en preview | bewaart/verwijdert overrides, laat effectieve context lezen | /api/project/settings en context-preview |

## CodeMirror en bestanden

`CodeEditor.tsx` gebruikt CodeMirror 6 met `state` 6.7.6, `view` 6.43.15, `lang-javascript` 6.2.5, `lang-json` 6.0.2 en packages voor search, commands, language en autocomplete. Ondersteunt JS, TS en JSON met highlighting, regelnummers, zoeken, undo/redo, inspringen en keyboardtabs. Dirty state bewaart bewerkte bestanden als concept. Een nieuwe versie is een bewuste Save. Bestandsnamen en entrypoint worden gevalideerd. Actieve tab en selectie zijn editorstate. Een foutlocatie kan in het betrokken bestand worden geopend. Zie `apps/web/package.json`, `CodeEditor.tsx` en `ScriptEditor.tsx`.

`ScriptProject` heeft `entrypoint` en `files: {path, content}[]`. Maximaal 20 bestanden, 256 KiB UTF-8 per bestand en 512 KiB totaal. Alleen relatieve .ts/.js/.json-paden, maximaal 160 tekens, geen traversal, verborgen of gereserveerde segmenten, case-insensitive duplicaten geweigerd. Entrypoint is een bestaand .ts- of .js-bestand. Normalisatie sorteert op pad. `bindingSource` serialiseert de genormaliseerde projectbundel als JSON voor SHA-256. Een aangepast hulpbestand bindt dus een andere snapshot. Legacy enkelvoudige bron blijft ondersteund.

Gemini kan een project met lokale helperbestanden en capability-aanvragen voorstellen. Bijvoorbeeld een eenmalige keuze van weer, twee spawn-aanroepen en een bericht vraagt drie afzonderlijke capability-ID's, waarvan spawn een toereikend quota vereist. API controleert vorm en scope. UI toont tabs en review voordat de gebruiker die versie draait. Lokale relatieve imports werken binnen de projectbundel. Het projectpad geeft Deno expliciet `--no-remote --no-npm` en biedt geen HTTP(S)-, npm- of jsr-dependencies of package-installatie. Het legacy-bronpad gebruikt die twee flags niet expliciet en blijft afhankelijk van de vaste netwerkscope en image. Een willekeurige bare import is geen ondersteunde projectdependency. Persistente listeners, klik/join-subscripties, daemons, Java-reflectie en onbeperkte I/O blijven buiten het one-shot model.

## Assistant en export

`providers/chat.ts`, `chat-instructions.ts` en `routes/conversations.ts` combineren bericht, projectcontext, registry en beperkingen. Server-side providerconfig gebruikt een sleutel als een echte provider geselecteerd is. Mock is gesimuleerd. Ontbrekende providerconfig wordt zichtbaar gemaakt. De inspectie las een opgeslagen Gemini-antwoord en startte geen nieuw extern gesprek. Conversaties en berichten worden opgeslagen. Een onbekende capability kan als unsupported verschijnen, maar is niet te autoriseren.

De JSON-export voor capability evidence bevat `extension`, `executionId`, `manifest` en `actualCalls`. Manifestexport is een tweede JSON-actie. Er is geen algemene PDF- of tekstexport met alle bestanden, stdout, runtime, classificaties en evidence. API/runner sanitizen credentialhoudende gegevens op de daarvoor bedoelde paden. Gebruikersinhoud verdient controle vóór delen. Zie `ExecutionCapabilities.tsx`, `CapabilityPermissions.tsx` en `execution-errors.ts`.
