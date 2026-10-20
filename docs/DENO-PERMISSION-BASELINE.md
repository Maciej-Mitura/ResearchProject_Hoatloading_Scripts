# Deno permission baseline

This document describes the **measurable Deno permission baseline** and the
**trusted scoped permission profiles** for the restricted execution prototype.

It does **not** claim that Deno blocked every attack, that accesses are
malicious, or that allow/deny outcomes are fully known from the audit log alone.

## Exact sandbox Deno version

| Item | Value |
|------|--------|
| Sandbox image | `denoland/deno:2.9.7` |
| Verified stable at implementation | Deno **2.9.7** (2026-09-16) |
| API / supervisor Deno image | still `denoland/deno:2.1.4` unless separately upgraded |

Every docker execution stores `runtimeVersion` / `manifest.runtimeVersion` from
the observed `deno --version` inside the sandbox (fallback: pinned config
`SANDBOX_DENO_VERSION`).

## Permission profiles (trusted configurations)

Profiles are **experimental trusted supervisor configurations**, not
user-supplied command-line arguments. Clients may only send a known profile ID.
The supervisor (and sandbox entrypoint) map the ID to structured Deno argv.

| Profile | Deno arguments | Meaning |
|---------|----------------|---------|
| `none` (default) | *(none)* — `deno run --no-prompt <script>` | Default-deny baseline |
| `read-fixture` | `--allow-read=/fixtures` | Narrow filesystem read of baked-in `/fixtures` only |
| `env-demo` | `--allow-env=SANDBOX_DEMO_VALUE` | Narrow env access to one demo variable |

Reserved for later (not implemented): combined host-capability profiles,
`--allow-net`, arbitrary combinations.

### Important distinctions

Granting `--allow-read=/fixtures` does **not** mean granting general filesystem
access. `/etc/hosts` and other paths remain outside that authority.

Profiles are one layer of defense-in-depth. Do not describe them as "safe" or
"secure" in absolute terms — prefer factual language:

> Configured Deno permissions: read `/fixtures`

### Safe fixture

Baked into the sandbox image (not a host mount):

`/fixtures/allowed.txt`

Contents: harmless research text only. No secrets or machine-specific data.

### Demo environment variable

For `env-demo`, the supervisor injects only:

`SANDBOX_DEMO_VALUE=hello-from-supervisor`

Application secrets (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `BRIDGE_TOKEN`,
`DATABASE_URL`, etc.) are **not** passed into the sandbox.

### How auditing is enabled

Trusted supervisor environment (not script-controlled):

```text
DENO_AUDIT_PERMISSIONS=/workspace/permission-audit.jsonl
PERMISSION_PROFILE=<none|read-fixture|env-demo>
```

`DENO_TRACE_PERMISSIONS` is **not** enabled by default (stack overhead).

The sandbox writes JSONL under tmpfs `/workspace` during the run. Because tmpfs
is discarded when the container stops, the trusted entrypoint **emits the audit
(and runtime version) on stdout in framed sections** after Deno exits. The
supervisor strips those frames and parses the JSONL.

## Execution manifest

Each docker result includes (among other fields):

```json
{
  "permissionProfile": "read-fixture",
  "denoPermissions": {
    "read": ["/fixtures"],
    "env": [],
    "net": [],
    "run": [],
    "write": [],
    "ffi": []
  }
}
```

`denoPermissions` is derived from the **same** trusted profile definition used
to launch Deno — not hard-coded separately for display.

## Native audit format (observed)

Deno writes JSONL, one object per line, format version `v: 1`:

```json
{"v":1,"datetime":"2026-10-19T12:00:00Z","permission":"read","value":"/etc/hosts"}
```

### Access vs outcome

Both in-scope and outside-scope accesses appear as neutral:

`permission.accessed`

The native audit does **not** include an explicit allow/deny outcome field.
Do not rename events to `permission.allowed` / `permission.denied` based on
profile alone. Separate process failure evidence may set
`failureCategory: "deno_permission"`.

### Known Deno 2.9.7 quirk (`run` / `Deno.Command`)

`Deno.Command` often raises `NotCapable` without emitting a JSONL `run` line.
Treat that as an instrumentation limitation.

## Scoped-permission experiments

| Experiment | Profile | Script | Expected |
|------------|---------|--------|----------|
| A default deny | `none` | read `/fixtures/allowed.txt` | fails; audit shows read |
| B scoped allow | `read-fixture` | same read | completes; controlled text printed |
| C scope escape | `read-fixture` | read `/etc/hosts` | fails; no hosts content |
| D mixed | `read-fixture` | read fixture + catch hosts | completes; both accesses in audit |
| env | `env-demo` | get `SANDBOX_DEMO_VALUE` / `HOME` | demo value works; HOME outside grant |

Caught outside-scope attempts remain observable in the audit even when the
script handles the exception (stdout alone is insufficient).

## Limits / truncation

| Limit | Default |
|-------|---------|
| Max audit events | 200 (`SANDBOX_AUDIT_MAX_EVENTS`) |
| Max audit bytes | 64 KiB (`SANDBOX_AUDIT_MAX_BYTES`) |

## Docker isolation vs Deno permissions

| Layer | Role |
|-------|------|
| Deno permission profile | Capability checks inside the runtime |
| Docker `network=none` | Independent network isolation (no `--allow-net` yet) |
| Docker resources / read-only root / caps | Independent supervisor policy |

Do not claim which layer blocked a `fetch` unless evidence identifies the layer.

## Evidence sources

| Source | Meaning |
|--------|---------|
| `deno_permission_audit` | Parsed from Deno JSONL |
| `supervisor` | Supervisor-derived (truncation, failure classification) |
| `mock` | Mock pipeline — never confuse with real audit |
| `host_bridge` | SecureBridge (existing host events; not sandbox) |
| `application` | Reserved |

## OpenTelemetry

Spans may include `execution.permission_access.count` and
`permission_profile`. Authoritative stored events remain in PostgreSQL
`security_events`.

RESEARCH TODO: compare supervisor JSONL collection with
`DENO_AUDIT_PERMISSIONS=otel` experimentally.

## What not to claim

- “Deno blocked every attack”
- “Access was malicious”
- Allow vs deny from the audit format alone
- That `--allow-read=/fixtures` implies general filesystem safety beyond that scope
- Production-ready permission broker / gVisor / Jev integration
