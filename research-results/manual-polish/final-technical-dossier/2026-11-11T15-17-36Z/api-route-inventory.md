# HTTP-inventaris

De mountpoints staan in `apps/api/src/main.ts`. Hieronder betekent lokaal dat de browserinterface van deze PoC geen algemene gebruikersauthenticatie toevoegt. Verborgen routes vereisen de vermelde servicecontext. Gebruik statuscodes op het juiste niveau, bijvoorbeeld 201 voor een gestart API-record en 429 bij volle supervisor.

| Methode en route | Aanroeper | Functie en trust |
|---|---|---|
| GET /health | Compose/web | service en DB-bereikbaarheid |
| GET /api/config/public | web | providerstatus, profielen en publiek model, zonder sleutel |
| GET /api/project/settings | web | base/effective/override settings, lokaal |
| PATCH /api/project/settings | web | gevalideerde overrides, lokaal |
| POST /api/project/settings/reset | web | reset overrides, lokaal |
| GET /api/project/settings/context-preview | web | effectieve context, lokaal |
| GET/POST /api/conversations | web | lijst en nieuw gesprek, lokaal |
| GET/POST /api/conversations/:id/messages | web | berichten lezen of providerpad starten, lokaal |
| GET/POST /api/scripts | web | lijst of draft opslaan, lokaal |
| GET/PATCH /api/scripts/:id | web | script/versiondata, metadata bijwerken |
| POST /api/scripts/:id/versions | web | nieuwe snapshot, lokaal |
| GET /api/scripts/capabilities/registry | web | actieve registry |
| GET /api/scripts/:id/versions/:versionId/manifest | web | opgeslagen authority-invoer lezen |
| POST /api/scripts/:id/versions/:versionId/manifest/reviews | web | gevalideerde append-only review |
| GET/POST /api/executions | web | legacy lijst of run beginnen |
| GET /api/executions/period | web | periodeaggregaten en gepagineerde data |
| GET /api/executions/history | web | server-side historie |
| GET /api/executions/:id | web | specifieke run |
| GET /api/executions/:id/events | client | SSE-route voor uitvoeringsstatus |
| GET /api/host/status en /api/host/events | web | Paper-status en records |
| POST /api/host/commands | lokaal | direct/debug enqueue uitgeschakeld, 403 |
| POST /api/host/bridge/heartbeat en /events | SecureBridge | Bridge-token |
| GET /api/host/bridge/commands/pending | SecureBridge | Bridge-token, claimt opdrachten |
| POST /api/host/bridge/commands/result | SecureBridge | Bridge-token, resultaatcorrelatie |
| GET /api/security/events en /risk-assessments | web | opgeslagen security-/advisorygegevens |
| GET /api/risk-assessments | web | alternatief advisory-list endpoint |
| POST /api/internal/host-commands en /host-events | Gateway | servicecredential en correlatie |
| GET /api/internal/capability-authority/:id | Gateway | versiegebonden snapshot, servicecredential |
| POST /api/internal/capability-commands | Gateway | queue, servicecredential en scopecontrole |
| GET /api/internal/capability-commands/:id | Gateway | status lezen, servicecredential |
| GET /api/research/evidence/:executionId | onderzoekstooling | gestructureerd bewijs lezen |
| GET /api/research/jev-preflight | onderzoekstooling | providerconfig/capability preflight |
| POST /api/research/jev-dry-run | onderzoekstooling | payloadpad valideren |
| POST /api/research/risk-classify | onderzoekstooling | separate classifierinterface, validatie van evidence |
| GET /health en POST /execute op runner:3100 | Compose/API | runner intern, gevalideerde job |
| GET /health en POST /v1/capabilities/:capability op gateway:3200 | Compose/SDK | uitvoeringstoken voor capabilitycall |
| POST /internal/sessions, /internal/sessions/bind en /internal/sessions/revoke op admin:3201 | runner | admincredential en netwerkgrens |

Bij samengestelde rijen gebruikt ieder verkort suffix hetzelfde prefix. Bestanden `apps/api/src/routes/*.ts`, `services/runner/src/main.ts`, `services/host-gateway/src/{main,manifest-calls}.ts`.
