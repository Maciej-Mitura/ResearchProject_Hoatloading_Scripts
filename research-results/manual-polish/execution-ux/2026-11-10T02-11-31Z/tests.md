# Tests and validation

| Check | Pass | Fail | Skip/ignored |
|---|---:|---:|---:|
| Frontend Vitest, 5 files | 68 | 0 | 0 |
| API Deno suite | 116 | 0 | 2 opt-in PostgreSQL cases |
| Deployed execution-history PostgreSQL | 1 | 0 | 0 |
| Deployed host-activity PostgreSQL | 1 | 0 | 0 |
| Total executed passes | 186 | 0 | 2 locally ignored, separately run above |

Frontend typecheck (`tsc --noEmit`), Docker production API/web build (includes frontend TypeScript/Vite) and local redeploy: exit 0. Git diff --check: exit 0; existing CRLF notices only. No Jev or gVisor experiment rerun.

23 additional frontend checks relative to the 45-test baseline: 22 execution-UX parameterized/focused tests plus immediate pre-POST workbench regression. Covers active feedback/elapsed timer, terminal stop, real timeout limits/reasons, missing historical metadata/OOM, failed vs infrastructure, all four collection qualities, accessible tooltip association/focus/tap/hover/Escape, profile guide, no host usage inferred from profile/admin-session metadata, partial host confirmation, completed process with failed assessment, unknown reason fallback, terminal SSE monotonicity, serial polling/terminal stop/automatic transition, stale selection/refresh failure and bounded late-ack follow-up. Existing zero-evidence text assertions were updated to the new intentional wording. Early obsolete copy/multiple-match assertions were repaired; final suite is green.

Local live regression: seven actual executions across five scripts: one timeout, two normal, one thrown error, one caught restricted read, two real host broadcasts. Their API security projections match PostgreSQL counts; six completed Paper commands are present across the original four-command timeout and two new one-command runs. `validation-summary.json` records every new execution ID and actual fields. The browser personally initiated timeout, normal and host cases; failed/restricted cases used the same deployed API and their saved detail was inspected. No provider-account failure was deliberately injected. A component double covers failed advisory analysis independently from completed execution.

`validate.py` asserts stored data, terminal states, timing range, exact timeout rule, collection reasons, host confirmations, unchanged effective settings, test counts and preserved research artifacts. The first non-elevated localhost read was blocked by the workspace socket sandbox; read-only validation succeeded with the normal approved local-network escalation. This was not an application/provider failure.

Frozen integrity: all 1,294 pre-existing research files match the pre-edit SHA-256 inventory; six previous result seals verify 779 entries, and the Phase 3 manifest verifies another 131 (910 in total). No missing files. Exact integrity evidence and 19 source hashes are in integrity-and-scope.json.

Browser checks: desktop/light/dark, 820x1000 and 390x844, keyboard focus/Escape, bounded tooltip placement, script save/version/availability, preserved Gemini assistant history, profile selection, execution/detail, Insights, Host Activity, Settings preview and Help. Screenshots and snapshots are additive in this directory. New paid assistant generation and formal assistive-technology certification were not repeated.
