# Execution fixtures (harmless)

Self-contained scripts for the restricted Docker/Deno execution + permission baseline.

| File | Profile | Expectation |
|------|---------|-------------|
| `hello.js` | `none` | completed; little/no sensitive permission activity |
| `typescript-answer.ts` | `none` | completed; stdout `42` |
| `read-hosts.js` | `none` or `read-fixture` | failed for `/etc/hosts`; audit shows `read` |
| `read-allowed-fixture.js` | `none` → fail; `read-fixture` → succeed | scoped allow demo |
| `mixed-read.js` | `read-fixture` | fixture printed; outside scope denied; both in audit |
| `caught-read.js` | `none` | may **complete** with `handled`, but audit still shows `read` |
| `fetch-example.js` | `none` | failed; net access may appear (Docker `network=none` also applies) |
| `env-home.js` | `none` | failed / no env value; audit shows `env` |
| `env-demo.js` | `env-demo` | prints `hello-from-supervisor`; HOME unavailable |
| `host-broadcast.js` | `host-chat` | queues `chat.broadcast` via Host Gateway → SecureBridge → Paper |
| `subprocess-echo.js` | `none` | failed (`deno_permission`); Deno 2.9.7 may omit `run` audit line |
| `ffi-check.js` | `none` | failed; audit shows `ffi` |
| `infinite-loop.js` | any | terminated by supervisor wall-clock timeout |
| `large-output.js` | any | output truncated at configured limit |

These are safe test fixtures, not exploit payloads.

Permission audit events are **access/check observations**, not allow/deny labels and not malice judgments.

Profiles are trusted supervisor configurations (`none`, `read-fixture`, `env-demo`). Clients cannot supply raw `--allow-*` flags.
