# Components
| Component | Responsibility |
|---|---|
| App | Existing chat/proposal/selection/SSE logic; four hash views, theme and service status. |
| Sidebar | Searchable script library; secondary conversations and current-script runs. |
| ScriptEditor | Source/name/language, existing create/version/metadata APIs, profile and Run; dirty-source guard and in-memory navigation draft. |
| ExecutionDetail | Shared selected-run summary/path; Output, Evidence, Runtime, Timeline; advisory disclosure and copyable IDs. |
| ExecutionInsights | Bounded current database history, loaded-window filters, four metrics, three visuals, history selection and shared detail. Lazy-loaded with chart dependency. |
| Badge / StatusBadge | Text + glyph + semantic tone, no color-only status. |
| ChatPanel / Markdown | Optional generation workflow and historical code/proposal saving. |
| ProjectSettingsPanel | Context categories, coalesced serialized autosave, unmount flush, preview/effective/reset disclosures. |
| ServerInfoPanel | Existing Paper status/event loading/filtering and confirmed broadcast reconstruction. |
| HelpPanel | Updated workflow, evidence limitations, focus trap, Escape and focus restoration. |
| insights.ts | Presentation-only labels, null-safe aggregates and trusted/correlated host chain. |

Inspector monolith removed. Existing timeline reconstruction retained. No chart data reads research result files.
