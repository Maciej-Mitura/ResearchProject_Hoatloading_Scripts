# Vertrouwen, defense-in-depth en autorisatie

| Laag | Soort | Beschermt en waarom | Grens |
|---|---|---|---|
| Deno-profielen | Handhaving | Beperken read, env, net, subprocess, write, FFI tot vertrouwde grants | Een geconfigureerde grant blijft mogelijk en procesfouten blijven mogelijk |
| Docker | Handhaving | Job krijgt eigen container, procesgrens, read-only root en minimale privileges | runc deelt de hostkernel. Een container is geen bewezen ondoordringbare grens |
| Runner-limieten | Handhaving | Tijd, CPU, geheugen, PIDs, output en gelijktijdige jobs zijn begrensd | Geen algemene garantie voor meergebruikerscapaciteit of alle storingen |
| gVisor/runsc | Optionele handhaving | Extra syscall- en kernelabstractie | Onderzoek meet compatibiliteit, timing en geselecteerde controls |
| Host Gateway | Handhaving | Controleert identiteit, scope, TTL, quota en argumenten, vóór enqueue | Een goedgekeurd effect kan nog verkeerd gekozen zijn en Paper kan het afwijzen |
| Manifest/review | Autorisatie-input | Legt vast wat de gebruiker voor deze versie toestaat | Een voorstel of keuze in de UI handhaaft op zichzelf niets |
| PostgreSQL | Duurzaam bewijs | Bewaart resultaten, gebeurtenissen, reviews en correlatie | Geeft geen volledige reconstructie van onwaargenomen gedrag |
| OpenTelemetry | Observability | Geeft timing en reconstructie tussen vertrouwde records | Export kan wegvallen. Geen autorisatie of duurzame bron |
| Deterministisch/Jev | Advies | Labelt beschikbaar gestructureerd bewijs | Wijzigt geen Deno-grants, Gateway-autoriteit of procesuitkomst |

Gemini, Gemini-code, usercode en voorgestelde manifests zijn onbetrouwbare invoer. Validatie kan de vorm van een voorstel bevestigen. Een gebruiker besluit over een versie en de Gateway handhaaft de opgeslagen scope. Een browser kan binnen dit lokale PoC een review indienen via de UI/API. De backend toetst die review aan de gevraagde bevoegdheden. De browser kan geen willekeurige ongevraagde capability, Docker-image, mounts, runtimeflags of directe Gateway-adminrechten meegeven. Deze lokale API heeft geen productie-identiteitsmodel. De runner is de enige Compose-service met de Docker-socket. Jobcontainers krijgen de socket niet en hebben geen rechtstreekse netwerkroute naar Paper of PostgreSQL.

Een Host SDK-call is JSON-verkeer met execution-credential naar de capability listener. De runner maakt en bindt de Gateway-session via het adminpad. De Gateway controleert sessie, peer, uitvoering, authority, constraints en tellers. De runner trekt de sessie in bij afhandeling. TTL is standaard 40 s en de Gateway-config vermeldt maximaal 120 s. De job kan de Gateway bereiken met het hostprofiel. Een niet-goedgekeurde `world.setBlock` blijft afgewezen met `CAPABILITY_NOT_APPROVED`. De Bridge-token, admin-token en Gateway-service-token zijn onafhankelijk. Providersleutels blijven API-side. Een capability-token is tijdelijk en geldt alleen binnen die sessie. Dit zijn PoC-servicecredentials, geen gebruikersaccounts.

SecureBridge draait in Paper. Het haalt opdrachten op via het Bridge-pad, houdt heartbeat bij en meldt resultaat terug. `CommandExecutor` dispatcht een vaste enum en gebruikt Bukkit/Paper-methoden. Er is geen generieke uitvoerder voor consolecommando's of Java-reflectie. Bij hosttraces betekent REQUESTED een vastgelegde aanvraag, AUTHORIZED een Gateway-besluit, QUEUED een geaccepteerde enqueue en CONFIRMED een gekoppeld Paper-resultaat. DELIVERED is afgeleid uit de opgeslagen overgang/resultaatcorrelatie. Een zelfstandig deliverytijdstip volgt daar niet uit.

Bronnen `compose.yaml`, `services/runner/src/docker.ts`, `services/host-gateway/src/{main,sessions,manifest-calls}.ts`, `apps/api/src/routes/{host,internal}.ts`, `apps/web/src/host-evidence.ts`, `minecraft/bridge/src/main/java/be/research/securebridge/CommandExecutor.java`.
