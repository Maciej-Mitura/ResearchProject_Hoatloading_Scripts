# Bronindex en verificatiestatus

| Onderwerp | Primaire bron |
|---|---|
| UI en routes | apps/web/src/App.tsx, components/ScriptEditor.tsx, ChatPanel.tsx, ExecutionDetail.tsx, ExecutionInsights.tsx, ServerInfoPanel.tsx, ProjectSettingsPanel.tsx, Help/Limits in componenten |
| Versie en bundel | packages/contracts/src/script-project.ts, apps/api/src/routes/scripts.ts, repositories/scripts.ts, 013_script_projects.sql |
| Capability-grens | packages/contracts/src/capabilities.ts, services/host-gateway/src/main.ts, manifest-calls.ts, sessions.ts |
| Versieauthority en persistentie | apps/api/src/routes/internal.ts, 011_capability_manifests.sql, 012_capability_review_order.sql |
| Uitvoering | apps/api/src/services/mock-execution.ts, providers/execution.ts, services/runner/src/docker.ts, admission.ts, permissions.ts |
| Audit en presentatie | services/runner/src/audit-collection.ts, packages/contracts/src/audit-collection.ts, apps/web/src/execution-ux.ts, execution-errors.ts |
| Advies en Jev | apps/api/src/risk/rules.ts, deterministic.ts, jev.ts, jev-input.ts, jev-route.ts, config/jev-risk-policy-v2.md |
| Paper | minecraft/bridge/src/main/java/be/research/securebridge/CommandExecutor.java, SecureBridgePlugin.java, HttpPollingBridgeTransport.java |
| Telemetry | apps/api/src/telemetry/otel.ts, infrastructure/otel/otel-collector-config.yaml |
| Runtime en config | compose.yaml, compose.gvisor.yaml, .env.example, inspection/public-config.json |
| Onderzoek | Phase 3 hervat rapport, Phase 4B/C, Phase 5 en Phase 7 in research-results |

## Testinventaris en bekende resultaten

- Frontend `apps/web/src/*.test.tsx`. Laatste polish 155/155 in twaalf testbestanden, inclusief editor, toestemming, evidence en datumflow. Typecheck en build apart geslaagd.
- API `apps/api/tests/*_test.ts`. Provider, regels, context, versieauthority, bridge-auth, execution history en evidence. DB-suites vereisen opt-in/testdatabase en horen niet automatisch bij unit-tellingen.
- Runner `services/runner/tests/*_test.ts`. Validatie, limieten, capture, audit, cleanup en credentialafscherming. Docker-integration vereist geschikte Engine.
- Gateway `services/host-gateway/tests/*_test.ts`. Sessions, TTL/boundaries, schemas en autorisatie.
- Shared contracts `packages/contracts/tests/platform_test.ts`. Project- en registryvorm, Java-resource-consistentie.
- SecureBridge `minecraft/bridge/src/test`. JUnit/Gradle, argumenten en protocol. Paper-runtime-effecten afzonderlijk.
- Phase 5 rapporteert 217 passes en één lokale guarded DB-skip die gedeployed slaagde. Phase 6 rapporteert 190 passes en één guarded DB-skip die afzonderlijk slaagde. Tijdens het dossier zijn geen runtimesuites herhaald.

| Suite | Laatste beschikbare post-research telling | Reikwijdte |
|---|---:|---|
| Frontend | 155 | final visual polish |
| API | 153 geslaagd, 4 guarded skips | advanced-script-platform |
| Runner | 54 | advanced-script-platform |
| Gateway | 33 | advanced-script-platform |
| PostgreSQL | 4 | afzonderlijke uitvoering van de guarded API-tests |
| Docker | 27 | advanced-script-platform |
| Shared contracts | 3 | advanced-script-platform |
| Java | 19 | advanced-script-platform |

Bronnen `research-results/manual-polish/advanced-script-platform/2026-11-10T18-09-51Z/report.md` en `research-results/manual-polish/final-visual-polish/2026-11-11T14-56-34Z/tests.md`.
