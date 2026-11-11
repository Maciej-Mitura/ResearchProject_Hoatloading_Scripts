# Removed, merged and moved
- Removed permanent chat-center / inspector-right structure and its widen-panel control: editor and full-width execution detail now own the canvas.
- Merged Security and Inspector execution information into one shared detail with explicit evidence/runtime/timeline tabs. Removed duplicate risk/permission summaries.
- Merged global run-list navigation into per-script history; Workbench retains a compact latest-loaded run list.
- Moved conversations behind a library disclosure and chat behind an optional assistant toggle. Existing proposals, history and saving remain available.
- Moved Server Info out of inspector tabs into Host Activity; removed its duplicate heading and updated old Inspector terminology.
- Moved settings into a project page, with fixed context metadata collapsed. Legacy executionEnforcement metadata remains only in advanced effective configuration; it is not live runtime detection.
- Moved UUIDs and trace IDs behind copyable technical details. No empty host-chain panel for unrelated executions.
- Removed green product identity, conflicting appended CSS overrides, colored status-card backgrounds and numeric risk-score prominence. No obsolete Research dashboard added.
