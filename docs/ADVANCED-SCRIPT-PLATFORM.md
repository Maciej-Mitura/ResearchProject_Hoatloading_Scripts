# One-shot script projects

Expanded host capabilities and multi-file script support are post-analysis extensions. They were not part of the frozen Phase 1–7 research experiments. No persistent scripting lifecycle is introduced.

Each Run creates a fresh sandbox, materializes the selected immutable snapshot, executes its entrypoint under the selected trusted profile and configured resource limits, returns evidence, and destroys the sandbox. Calculations, loops, functions/classes and local helper modules are supported. Project files are application data, not general filesystem access. Runtime changes are never written back.

## Project snapshots

`project: {entrypoint, files: [{path, content}]}` is optional for compatibility with existing single-source versions. A snapshot supports 1–20 `.ts`, `.js` and `.json` files, 256 KiB per file and 512 KiB total, counted as UTF-8 bytes. Paths are restricted relative POSIX paths; absolute paths, traversal, hidden segments, encoded separators, duplicate/case-colliding names and reserved device names are rejected. The entrypoint must name an existing TypeScript or JavaScript file. `source` remains the entrypoint text for legacy consumers; every supporting file is persisted in the version's JSONB project column.

The manifest hash covers the canonical entrypoint and complete sorted file inventory. Changing any file and saving creates a new immutable version with a fresh unreviewed manifest. Source-call consistency detection inspects all files and remains advisory. API and supervisor validate the bundle independently. The trusted sandbox materializer validates it again, writes only within the ephemeral project directory, and exits before the untrusted process begins. Materializer writes are excluded from the untrusted permission-audit stream.

Use relative imports including extensions, and JSON imports such as `import config from "./config.json" with {type: "json"};`. New projects use `--no-remote --no-npm`; HTTP, npm and jsr resolution remains blocked. No filesystem, write, package-management or additional network grant is introduced. Legacy source execution remains compatible.

## Editor

CodeMirror file tabs select actual stored file contents. Arrow keys, Home and End navigate the tab list; path tooltips disambiguate names. Tabs show dirty markers and scroll horizontally. Save persists all files together. File management supports adding, renaming, deleting non-entry files and choosing an entrypoint. It does not rewrite imports; missing imports produce ordinary execution errors. Cursor, scroll and undo state are retained while switching files within the mounted editor. Draft content survives in-app navigation, not browser reload.

Helper errors show their file and line. Open in editor targets only the currently selected matching version; another version receives guidance instead. Dirty source is not replaced by error navigation.

## Registered host operations

The authoritative registry, constraints and examples live in `packages/contracts/src/capabilities.ts`; the running API exposes it at `/api/scripts/capabilities/registry`. The Assistant context and Limits guide derive their available operations from this registry. The generated Paper resource is verified against it in shared-contract tests.

Existing operations are `chat.broadcast`, `server.status`, `player.sendMessage` and `world.spawnEntity`. New operations are `player.getState`, `world.getBlock`, `world.setBlock`, `world.setWeather`, `world.setTime` and `world.playSound`. The optional inventory/item capability was deliberately omitted.

Player state returns only name, position, rotation and world for an online exact player name. World-coordinate operations target the first active world, loaded chunks only, within 32 blocks horizontally and −8…+16 vertically of spawn. Block operations require integer coordinates. Placement uses a small material allowlist and does not replace containers/block entities or bedrock. Weather/time use restricted presets; sound uses an allowlist with fixed volume and pitch. No NBT, generic commands or arbitrary Paper calls exist. Quotas and optional narrower material, weather, time, sound, entity and player allowlists are enforced by the Gateway; Paper repeats argument and location checks.

Approval remains explicit, version-specific and separate from Run. Selecting Per-script permissions supplies transport; it does not approve authority. Denied capabilities remain blocked. Execution/session identity, peer-IP binding, expiry and quota enforcement are preserved. Jev and deterministic classifications remain advisory and never approve permissions.

## Execution Insights

The competing Script and Runs selectors are removed. Today, Last 24 hours, Last 7 days, Last 30 days and Custom range query history across scripts. Custom values use the user's local timezone and are converted to UTC. From is inclusive and To exclusive; maximum range is 366 days. Provider and sorting apply on the server before pagination. Queries return 50 rows per UI page, up to 200 per API request. The latest-100 client-only restriction is removed. A disclosed maximum offset of 100,000 remains; narrow the range if reached.

Period statistics cover the complete matching query, including all pages. Row selection opens that execution's evidence without changing the time filter. Direct Workbench links can show a run outside the current page/range, explicitly labelled. Empty periods have a single readable empty state. Pagination holds its date-range endpoint fixed until the user changes or refreshes the query; concurrent database changes are not a transaction-wide browsing snapshot.

## Intentional limits

No event listeners, player click/join subscriptions, background jobs, daemons, persistent sandboxes, arbitrary commands, generic Bukkit/Paper APIs, Java reflection, dependency installation, unrestricted internet/filesystem access or installed plugins. For mixed requests, the Assistant explains the unsupported event model and offers the supported action as a one-shot alternative. The Workbench **What are the limits?** guide lists the running capabilities, exact SDK examples, quotas, project limits and permission model in both themes and on narrow screens.
