# Dependency-audit

Op 11 november 2026 is `npm audit --json` op het actuele frontendlockfile uitgevoerd, plus `npm audit --omit=dev --json`. Beide uitkomsten zijn opgeslagen in `inspection/`. Het volledige npm-resultaat telt 2 critical, 1 high, 3 moderate. De productie-only scan meldt nul. De totalen tellen pakketten en hun hoogste afgeleide severity, geen afzonderlijke CVE's.

| Pakket | Ernst en keten | Advisory | Auditvoorstel |
|---|---|---|---|
| vitest | critical, direct dev | GHSA-5xrq-8626-4rwp | Vitest 5.1.0, major |
| tinypool | critical, transitief via Vitest | GHSA-5gmw-xhrv-c9v3 en GHSA-85c8-ppgw-ccpr | Vitest 5.1.0, major |
| vite | high, direct dev | GHSA-587h-7wmj-h5pm | Vite 8.3.8, major |
| @vitest/mocker | moderate, via Vitest | GHSA-82fw-gwwq-j7x9 en GHSA-qxg6-89mg-rqv8 | onderdeel van Vitest-update |
| vite-node | moderate, via Vitest/Vite | npm-erfenis van Vite-issues | onderdeel van Vitest-update |
| esbuild | moderate, via Vite | GHSA-67mh-4wv8-2f99 | onderdeel van Vite-update |

De huidige productiewebimage serveert statische output met nginx. Vite/Vitest-ontwikkelservers en de Vitest-workerpool zijn geen webserverprocessen in die image. De findings blijven relevant voor development en build/testomgevingen. Nul npm-production findings is geen scan van Deno, de containerbasis, Java, Paper of de gehele stack. Auditvoorstellen zijn geregistreerd, geen upgrades uitgevoerd.

Bronnen `apps/web/package-lock.json`, `apps/web/Dockerfile`, `inspection/npm-audit-current.json`, `inspection/npm-audit-production.json`.
