# Architectuur, Compose en installatie

| Component | Technologie | Vertrouwen | Verantwoordelijkheid en verbinding |
|---|---|---|---|
| Web | React, Vite, nginx, CodeMirror 6 | Interface, invoer onbetrouwbaar | Stuurt versies, reviews en run-aanvragen naar API en projecteert opgeslagen bewijs |
| API | Deno, Hono | Vertrouwde applicatielaag | Valideert, beheert versies/records, stuurt runner, biedt Bridge-protocol aan |
| PostgreSQL | postgres:16-alpine | Vertrouwde opslag | Duurzame applicatierecords voor API |
| Runner | Deno/Hono, Docker Engine | Hoog vertrouwd | Eigenaar Docker-socket, capaciteit en volledige job-lifecycle |
| Sandbox | Docker, Deno 2.9.7 | Vertrouwde image en entrypoint, onbetrouwbare usercode | Voert tijdelijke job uit, standaard zonder netwerk |
| Host Gateway | Deno/Hono | Vertrouwde autorisatie | Apart capability- en adminpad, controleert jobbevoegdheid, vraagt API om commando |
| Capability-session | In-memory Gateway-state | Vertrouwde context, token beperkt gedelegeerd | Bindt calls aan uitvoering, authority, peer en tijd |
| SecureBridge | Java 21, Gradle, Paper-plugin | Vertrouwde adapter | Vraagt opdrachten op bij API, voert toegelaten Bukkit-acties uit en rapporteert resultaten |
| Paper | Minecraft Java, Paper 1.21.1 standaard | Vertrouwde host | Houdt Minecraft-wereld en spelers bij |
| OTel Collector | OpenTelemetry 0.114.0 | Operationele observatie | Ontvangt API-spans via OTLP |
| Deterministisch | TypeScript-rules | Advies | Interpreteert gestructureerd uitvoeringsbewijs |
| Jev | TypeSafe of Vercel-provider | Externe adviesbron | Classificeert getransformeerde evidence, optioneel |
| Gemini | Google-provider, API server-side | Onbetrouwbare inhoud | Levert tekst en voorstellen, verwerft geen hostbevoegdheid |
| runsc | Optionele gVisor OCI-runtime | Extra runtimegrens | Alternatief bij correct geconfigureerde Linux Engine |

| Compose-service | Build/image | Netwerk | Hostpoort standaard → waargenomen | Startafhankelijkheid |
|---|---|---|---|---|
| web | apps/web/Dockerfile | internal | 5173 → 15173 | API gezond |
| api | apps/api/Dockerfile | internal | 3000 → 13000 | PostgreSQL gezond, collector/runner gestart, sandbox-build klaar |
| postgres | postgres:16-alpine | internal | geen | geen |
| otel-collector | otel/opentelemetry-collector:0.114.0 | internal | geen | geen |
| runner | services/runner/Dockerfile | internal | geen, intern 3100 | sandbox klaar en Gateway gestart |
| host-gateway | services/host-gateway/Dockerfile | internal + sandbox-host | geen, 3200 en 3201 intern | geen harde Compose-afhankelijkheid |
| sandbox | services/sandbox/Dockerfile | buildservice in internal | geen | one-shot die image beschikbaar maakt |
| bridge-builder | minecraft/bridge/Dockerfile | internal | geen | one-shot, schrijft pluginvolume |
| paper | itzg/minecraft-server:java21 | internal | 25565 → 25565 | bridge-builder klaar, API gezond |

`internal` is de applicatiebridge, `sandbox-host` is een afzonderlijke bridge met `internal: true`. De gewone job gebruikt `none`. De Gateway biedt op 3200 het capability-pad aan. Het adminpad bindt aan de alias `host-gateway-admin` op de applicatiebridge, poort 3201. API, PostgreSQL, Paper en runner zitten buiten het jobnetwerk. Gepubliceerde poorten binden in de waargenomen Compose-status aan `0.0.0.0`. Dat is een belangrijk PoC-deploymentkenmerk.

Gebruik Git, Docker Desktop of Linux Engine met Linux-containers en Compose v2. Node is nuttig voor lokale frontendontwikkeling, Deno voor losse API-/servicetests en JDK 21 voor lokale plugintests. Docker-builds verzorgen die runtimes voor de gewone stack. Minecraft Java-client is optioneel voor zichtbaar spelgedrag. Paper vereist aanvaarding van de EULA. Een afzonderlijke Linux-Engine met geregistreerde `runsc` is optioneel. Azure, cloudhosting en een APK zijn niet vereist. Externe modelproviders vereisen alleen bij gebruik een passend account en een sleutel. Zie `compose.yaml`, `README.md`, `docs/RESTORE-LOCAL-SETUP.md` en `docs/REPRODUCTION.md`.
