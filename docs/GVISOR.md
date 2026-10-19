# gVisor (future Linux experiments)

## Why it is separate

gVisor (`runsc`) is a **host Docker runtime**, not an application container you install inside Compose services.

Normal development on Windows/macOS/Linux works **without** gVisor using `compose.yaml` alone.

Final isolation experiments for the untrusted runner must run on **Linux** with `runsc` registered.

## Override file

`compose.gvisor.yaml` sets `runtime: runsc` on the **`runner` service only**.

```bash
docker compose -f compose.yaml -f compose.gvisor.yaml up
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

- Exact seccomp/AppArmor interaction
- Network egress policy
- Mount restrictions for script artifacts
- CPU/memory/output limits and watchdogs

These are **research TODOs** — do not invent final policy values in the foundation stage.
