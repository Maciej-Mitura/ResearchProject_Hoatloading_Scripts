# Phase 6 cleanup candidates — not implemented

- `apps/web/src/components/Inspector.tsx:501`: Clarify PostgreSQL-derived security/timeline evidence versus actual collector receipt.
- `apps/web/src/components/Inspector.tsx:513`: Replace unconditional mocked-enforcement caveat with runtime-specific wording.
- `apps/web/src/components/ProjectSettingsPanel.tsx:210`: Explain policy intent versus actual enforced fixed Deno profiles; also line 278.
- `apps/web/src/components/Inspector.tsx:777`: Optional dead callback cleanup only. Direct broadcast already disabled at line 778; do not report an active bypass.
- `apps/api/src/providers/chat.ts:76`: Mock chat welcome drafts use unsupported onPlayerJoin/host.broadcast; execution-mocked statement at 83 and host.requestStatus at 106 are stale even when Docker execution is selected.
- `apps/api/src/project/schema.ts:250`: Refresh runtime capability/enforcement descriptions; also mocked/not-implemented warning around 578. Preserve distinction between policy intent and enforced profiles.
- `samples/scripts/welcome-message.js:3`: Label or replace obsolete event subscription / host.broadcast example with current supported SDK scope.
- `samples/scripts/host-status-query.js:3`: Label unsupported sandbox host.requestStatus example; server.status is backend-only.
- `apps/api/src/db/migrations/002_seed.sql`: Annotate or supersede obsolete seeded examples in an additive migration if needed; do not rewrite historical migration.
- `README.md:24`: Refresh pending evaluation status and evidence links at lines 58-59 and 196-204; distinguish current working-tree validation from published checkout.
- `docs/ARCHITECTURE.md:83`: Date prior future-runsc wording and outstanding empirical work at 133-134; link actual Phase 3/4/5 evidence.
- `docs/JEV-RISK-COMPARISON.md:38`: Update current adapter version diagram from 1 to 2 and link frozen empirical report; keep historical failure evidence.
- `docs/GVISOR.md:1`: Scope Desktop absence separately from successful native WSL/runsc experiment; preserve historical environment observations.
- `docs/GVISOR-EXPERIMENT.md:1`: Link matched Phase 4B/C package and intentional shutdown status; retain original dated preflight findings.
