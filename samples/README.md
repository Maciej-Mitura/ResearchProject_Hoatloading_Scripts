# Runnable demo scripts

Source executes once at top level; exporting an uncalled callback does not install it.
Select the profile at Run. Project Settings are assistant context, not grants.

| Script | Profile | Expected observation |
|---|---|---|
| [simple-calculation.js](scripts/simple-calculation.js) | none | Hello and 4; completed |
| [caught-restricted-read.js](scripts/caught-restricted-read.js) | none | Read denied/caught; completed; permission observation |
| [allowed-fixture.ts](scripts/allowed-fixture.ts) | read-fixture | Contents of `/fixtures/allowed.txt` |
| [demo-environment.ts](scripts/demo-environment.ts) | env-demo | `hello-from-supervisor` |
| [welcome-message.js](scripts/welcome-message.js) | host-chat | Queued command ID; confirm separately in Paper/Server Info |

The only sandbox host method is `host.chat.broadcast`. Status/player information
is backend-only in Server Info. Event subscriptions, persistent scripts and
arbitrary Paper APIs are not implemented. Old seed version 1 remains historical;
migration 010 only supersedes untouched stock demos, preserving user edits.

See the [demo runbook](../docs/DEMO-RUNBOOK.md).
