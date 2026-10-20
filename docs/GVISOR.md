# gVisor (future Linux experiments)

> **Status on the current Windows + Docker Desktop machine:** `runsc` is **not**
> registered. See [`GVISOR-EXPERIMENT.md`](GVISOR-EXPERIMENT.md) for the
> preflight report. Do not claim gVisor sandbox runs until a Linux host with
> `runsc` is verified (`npm run gvisor:preflight`).

## Why it is separate

gVisor (`runsc`) is a **host Docker runtime**, not an application container you install inside Compose services.

Normal development on Windows/macOS/Linux works **without** gVisor using `compose.yaml` alone.

## How this repo prepares for it

The trusted execution supervisor creates sandbox job containers. Runtime selection is **central**:

```env
SANDBOX_DOCKER_RUNTIME=runsc
```

or via `compose.gvisor.yaml`, which sets that environment variable on the supervisor.

**Do not** put `runtime: runsc` on the supervisor service itself — the supervisor must keep normal Docker Engine access.

Scripts and API clients cannot choose the runtime.

## Override file

```bash
SANDBOX_DOCKER_RUNTIME=runsc docker compose -f compose.yaml -f compose.gvisor.yaml up
```

## Approximate Linux host setup

1. Install `runsc` (see [gVisor docs](https://gvisor.dev/docs/user_guide/install/)).
2. Register it with Docker (`/etc/docker/daemon.json` runtimes).
3. Restart Docker.
4. Verify:

```bash
docker run --rm --runtime=runsc hello-world
```

5. Then start this project with the gVisor override.

## What is intentionally deferred

- Confirming seccomp/AppArmor interaction with runsc for this PoC
- Comparative measurements vs default runc
- Claiming gVisor is active in normal Windows/macOS development

These remain **research TODOs**. This milestone does **not** require runsc.
