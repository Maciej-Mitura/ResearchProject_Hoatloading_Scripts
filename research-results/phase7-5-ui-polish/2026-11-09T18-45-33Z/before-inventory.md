# Pre-implementation UX inventory

Audited current App/state/API/types, Inspector, Sidebar, Chat/Markdown, Settings, Server Info, Help, timeline and tests; existing 1,275-line CSS has green tokens and conflicting late overrides. No client router or charting library. Source is currently read-only under a disclosure; script API already supports version creation and metadata updates, but no delete route exists. Preserve supported operations without adding mutation authority.

| Surface | Decision | Reason |
|---|---|---|
| Header/status badges | REWORK | Compact indigo navigation + small connection indicators; separate global service state from execution outcome. |
| Three-column shell | REWORK | Single main canvas with a contextual library and optional assistant; no competing permanent inspector. |
| Conversation list/chat | MOVE | Secondary assistant drawer; retain send/proposal save/history behavior. |
| Script list | KEEP | Searchable contextual library; select/create/edit/version script as primary workflow. |
| Global execution list | MERGE | Per-script Insights table; compact current-script history in Workbench. |
| Inspector source disclosure | REWORK | Visible source editor with explicit save version and current/saved source distinction. |
| Inspector Run/profile | MOVE | Editor toolbar; prevent running unsaved source and separate selected next profile from recorded result profile. |
| Inspector Security tab | MERGE | Execution detail evidence/advisory/host views; no duplicated risk and permission panels. |
| Timeline | KEEP | Progressive disclosure; do not infer observed stages from process success alone. |
| Server Info/host summary duplicates | MERGE | One Host Activity view, retain real confirmed host activity/filtering. |
| Settings tabs/categories | REWORK | Assistant generation context, runtime explanation, project/host context; legacy metadata secondary. |
| Technical IDs | MOVE | Copyable technical details, not history/card primary text. |
| Widen-panel control | REMOVE | Full-width detail canvas replaces arbitrary inspector-width mode. |
| Green identity/late CSS overrides | REWORK | Neutral slate/indigo tokens, semantic color only; one responsive system. |
| Help dialog | KEEP | Update navigation terminology; keyboard dismissal/focus behavior. |
| Risk score emphasis | REWORK | Class and assessment status primary; numeric provider metadata secondary, no composite score. |
| Empty permission/host panels | REWORK | Collection-aware empty messages; omit irrelevant host chain. |
| Insights | REWORK | New per-script real-data page: three primary charts and selected-run evidence visual; no frozen experiment inputs. |
