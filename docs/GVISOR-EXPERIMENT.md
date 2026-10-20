# gVisor / runsc experiment (status)

## Preflight result (this development machine)

**gVisor experiments cannot run here.** Implementation of the runc vs runsc
comparison matrix and benchmarks is **stopped** until a Linux Docker host with
`runsc` registered is available. No fake runsc results.

| Check | Result |
|-------|--------|
| Host OS | Windows 10 Pro (`10.0.26200`), amd64 |
| Docker context | `desktop-linux` |
| Docker product | **Docker Desktop 4.41.2** (191736) |
| Engine | 28.1.1 (linux/amd64 via WSL2 kernel `6.6.87.1-microsoft-standard-WSL2`) |
| Client | 28.1.1 windows/amd64 |
| Default runtime | `runc` (1.2.5) |
| Registered runtimes | `runc`, `io.containerd.runc.v2`, `nvidia` — **no `runsc`** |
| `runsc` on PATH | not found |
| Probe | `docker run --rm --runtime=runsc hello-world` → **`unknown or invalid runtime name: runsc`** (exit 125) |

### Why Docker Desktop is insufficient

gVisor (`runsc`) is a **host Docker/containerd runtime**, configured on the Linux
Docker daemon (`daemon.json` / runtime registration). Installing binaries inside
an application Compose service does **not** make sandbox jobs use gVisor.

This machine’s daemon only exposes runc-family runtimes. Setting
`SANDBOX_DOCKER_RUNTIME=runsc` would make the supervisor pass `--runtime=runsc`
and Docker would reject job creation — it would **not** silently fall back to
runc while claiming gVisor (and we must not pretend otherwise).

## Already prepared in this repository

| Item | Status |
|------|--------|
| `SANDBOX_DOCKER_RUNTIME` on runner (empty = default runc) | ready |
| Supervisor `docker run --runtime …` for job containers only | ready |
| Manifest field `dockerRuntime` | ready (records requested/configured value; enhance with inspect evidence on Linux) |
| `compose.gvisor.yaml` | valid override: sets `SANDBOX_DOCKER_RUNTIME=runsc` on **runner only** |
| Docs: `docs/GVISOR.md` | install outline |
| Normal `docker compose up` | unaffected (no runsc required) |
| Scripts cannot choose runtime | enforced (supervisor-owned) |

`compose.gvisor.yaml` usage (Linux + registered runsc only):

```bash
docker compose -f compose.yaml -f compose.gvisor.yaml up -d --build
```

## Minimal Linux setup (later)

On a **native Linux** host (or a dedicated Linux VM) with Docker Engine — not
relying on Windows Docker Desktop’s limited runtime set:

1. Install gVisor `runsc` per [gVisor install docs](https://gvisor.dev/docs/user_guide/install/).
2. Register runtime, e.g. `/etc/docker/daemon.json`:

```json
{
  "runtimes": {
    "runsc": {
      "path": "/usr/local/bin/runsc"
    }
  }
}
```

3. `sudo systemctl restart docker` (or equivalent).
4. Verify **before** project experiments:

```bash
docker info | grep -i runsc
runsc --version
docker run --rm --runtime=runsc hello-world
```

5. Start research stack:

```bash
export SANDBOX_DOCKER_RUNTIME=runsc
docker compose -f compose.yaml -f compose.gvisor.yaml up -d --build
```

6. Prove job containers actually used runsc (example):

```bash
# After a host-chat or hello execution, inspect a short-lived job if captured,
# or add supervisor logging of `docker inspect -f '{{.HostConfig.Runtime}}'`.
docker info --format '{{json .Runtimes}}'
```

7. Run the same fixture matrix under default runc and under runsc; compare
   behavior and wall-clock durations (see planned matrix below). Never claim
   runsc if inspect/runtime evidence shows otherwise.

### Planned constant policy (both runtimes)

Hold constant: Deno 2.9.7, permission profiles, CPU/memory/PIDs/timeout/output,
read-only root, tmpfs, cap-drop, no-new-privileges, network modes, Host Gateway
`chat.broadcast` policy. Isolate **container runtime** as the variable.

### Planned matrix (not executed here)

A–K from the research plan: hello, TS, denied read, scoped read, outside-scope,
env-demo, network-denied, timeout, truncation, fresh isolation, host.chat.broadcast,
plus API/internet bypass under `host-chat`.

Performance: 10–20 repeats for hello, CPU loop, fixture read, broadcast — report
count / median / mean / min / max for **this** environment only.

## Architectural responsibilities (unchanged)

| Layer | Role |
|-------|------|
| Deno permissions | Application/runtime authority inside the sandbox |
| Docker (namespaces, cgroups, lifecycle) | Container boundary + resource controls |
| gVisor (`runsc`) | Extra isolation: userspace kernel between app and host kernel |
| Host Gateway | Independent host capability authorization (`chat.broadcast`) |

Do **not** claim “gVisor blocks all escapes” or that runsc alone makes untrusted
execution “secure.”

## What can continue without gVisor

- Deno permission baseline and scoped profiles  
- Host Gateway / `chat.broadcast`  
- Supervisor limits, auditing, UI, fixtures  
- Documentation and Linux experiment prep  

**Blocked until Linux+runsc:** actual runc vs runsc compatibility/performance
comparison and “proof runsc was used” evidence collection.

## Reproduce preflight on this Windows machine

```powershell
docker version
docker context show
docker info --format "OS={{.OperatingSystem}} Runtimes={{json .Runtimes}}"
docker run --rm --runtime=runsc hello-world
```

Expected today: unknown runtime `runsc`.
