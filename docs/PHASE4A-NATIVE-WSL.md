# Native Ubuntu WSL + runsc environment

Phase 4A created a native Docker Engine inside the existing Ubuntu WSL2 distribution. All six required execution probes passed. No Phase 4B workloads, warm-ups, latency comparisons or Paper broadcasts were run.

## Select the correct engine explicitly

Windows Docker Desktop remains on context `desktop-linux`, Engine 28.1.1, with its original data and running project. Ubuntu's independently installed engine is Docker 29.9.3, root directory `/var/lib/docker` in Ubuntu's filesystem and service `/usr/lib/systemd/system/docker.service`.

From PowerShell:

```powershell
wsl -d Ubuntu -u root -- /usr/bin/docker --host unix:///var/run/docker.sock info
wsl -d Ubuntu -u root -- systemctl status docker.service --no-pager
```

From an Ubuntu root shell:

```bash
/usr/bin/docker --host unix:///var/run/docker.sock info
/usr/bin/docker --host unix:///var/run/docker.sock version
/usr/bin/runsc --version
cat /etc/docker/daemon.json
```

Do not select a Windows/Desktop context for the experiment. All orchestration commands in this phase explicitly targeted the Ubuntu Unix socket; trusted runner containers mounted only that native socket. No user was added to the docker group, no sudoers/password changes were made, and the socket remains root:docker mode 660. Standard `wsl -u root` administration was used because normal Ubuntu sudo requires a password.

The native engine is enabled through existing systemd. WSL may stop when idle or at Windows shutdown; check service health before future experiments. No `.wslconfig`, `/etc/wsl.conf`, Windows Docker configuration or Docker Desktop setting was changed. Native and Desktop daemons have separate engine IDs and data/mount/network namespaces. Docker Desktop's daemon network namespace differs from Ubuntu's native daemon namespace; no Desktop network/volume/image cleanup was performed.

## Installed configuration

- Ubuntu 24.04.2 LTS, amd64, WSL 2.5.7.0, kernel `6.6.87.1-microsoft-standard-WSL2`, existing systemd.
- Docker CE/CLI `5:29.9.3-1~ubuntu.24.04~noble`, official Docker stable apt repository.
- containerd.io `2.4.2-3~ubuntu.24.04~noble`; runc 1.5.2.
- Buildx `0.38.1-1~ubuntu.24.04~noble`; Compose plugin `5.7.0-1~ubuntu.24.04~noble`.
- Official gVisor release apt repository, complete `runsc` package `20261102.0` (`release-20261102.0`), not a legacy standalone-binary install.
- Docker default runtime remains runc. Registration uses `/usr/bin/runsc` with the sole runtime argument `--platform=systrap`.
- Native Docker uses its builtin seccomp profile. No host networking, raw-packet runtime flags, unconfined override, firewall disabling or Windows security changes were applied.

Package provenance, signed apt sources, installed runsc binary hash and successful `dpkg -V runsc` verification are retained. Installer scripts are the exact executed setup recipes; the Docker installer deliberately refuses a pre-existing native socket/data/config/package installation. They are **one-time setup**, not upgrade or cleanup scripts.

Official references: [Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/), [gVisor installation](https://gvisor.dev/docs/user_guide/install/), [Docker registration](https://gvisor.dev/docs/user_guide/quick_start/docker/), [platform selection](https://gvisor.dev/docs/user_guide/platforms/).

## Images and repository

The existing source tree was used directly at:

`/mnt/c/Users/mimac.DESKTOP-OQT5HDD/Desktop/RP_Hotload_Script/ResearchProject_Hoatloading_Scripts`

No Linux-side checkout or line-ending rewrite was needed. Sandbox and runner builds from the original Dockerfiles passed. No production source changes were necessary.

The native image store initially did not contain Desktop's sandbox image. It was rebuilt from the unchanged Dockerfile, not assumed identical to Desktop's local image:

- Sandbox: `sha256:90ab4f290356c3b4d307775656227f1b4a2fff68bf64ae0082705d7d98f82efc`.
- Deno observed inside both runtime probes: 2.9.7.
- Trusted runner: `research-poc-runner:phase4a`; exact ID retained in `runner-probe-plan.json`.

Both native runtime groups used the **same native sandbox image ID**. Future comparison must use this native image or freeze a newly built image before both groups; do not mix Desktop runc results with Ubuntu runsc results.

Compose configuration validated in Ubuntu, with all API, runner, host-gateway, PostgreSQL, Paper/bridge-builder, collector, sandbox and web entries and build contexts present. Named volumes and service paths are suitable for the native engine. Configuration validation is not full-stack behavioral validation. The full Compose stack was not started: doing so with the current `.env` ports could conflict with the existing Desktop project. For a future native stack, choose separate loopback-facing published ports in a controlled override/configuration before starting services; do not expose backend services merely to avoid a collision.

## Real runner and trusted runtime records

Each runtime received exactly one HTTP `/execute` request through the **unchanged** production supervisor, running as an isolated container with no published port. Its socket mount targeted the native engine. The supervisor itself ran under runc in both cases; only job-runtime selection changed through trusted `SANDBOX_DOCKER_RUNTIME` configuration.

The same harmless source printed two fixed hello markers with a two-second asynchronous delay to permit host-side observation, under profile `none`. Both executions returned completed/exit 0, Deno 2.9.7, empty permission observations, `auditCollection=complete`, and no cleanup errors. Neither probe was a W1–W10 workload or a latency sample.

`scripts/phase4a-runner-probes.py` implements additive per-job evidence collection: a trusted native-host Docker event observer captures the single sandbox start event and allowlisted Docker inspection before normal removal. Serialized exclusive execution binds the HTTP execution ID/source hash to exactly one job container/image/runtime. Host runsc/Sentry-Gofer process command lines containing that container ID corroborate runsc. The record includes engine identity, registered runtimes, image, requested/configured/inspected runtime, container ID, runsc version/configuration and experiment host identity.

No untrusted output is authoritative runtime evidence. Supporting `dmesg` output from the generic probe is explicitly secondary. This is operational host/daemon corroboration, not cryptographic attestation. No raw job environment or capability-token value is persisted. Production manifests remain configuration-derived; old records were not rewritten. Future serialized experiment tooling must preserve this observation/binding discipline or implement equivalent trusted before-cleanup collection before measurements. The current observer is not a general concurrent-job attribution mechanism.

## Known internal-bridge DNS incompatibility

A separate, preserved environment preflight found that runsc cannot resolve names through Docker's embedded DNS `127.0.0.11` on an internal user-defined bridge. An absolute-name control succeeded under runc and failed under runsc. An earlier runc diagnostic used an inherited search domain and failed; that confounded control is retained alongside the corrected diagnosis rather than hidden.

This is documented in the official [gVisor FAQ](https://gvisor.dev/docs/user_guide/faq/). It is not established to be a WSL-specific issue, and a new VM alone should not be assumed to fix it. No host networking, gateway bypass, external DNS resolver or production network change was applied. The existing host-chat target `host-gateway:3200` therefore has a known unresolved name-resolution compatibility risk for Phase 4B. No Paper compatibility claim is made.

The `--net-raw` / `--allow-packet-socket-write` instructions in [Docker **inside** gVisor](https://gvisor.dev/docs/tutorials/docker-in-gvisor/) apply to a dockerd running **within** a gVisor sandbox. That is not this architecture: native host dockerd runs outside runsc. Those flags were not copied into this daemon registration. The native Engine is 29.9.3, not Desktop's 28.x; record that distinction in the eventual frozen experiment.

The minimum Phase 4A environment gate passes with this limitation disclosed: genuine runc/runsc execution, same-image execution and normal runner evidence all work. A future Phase 4B plan must retain the DNS failure as an incompatibility under unchanged policy, or explicitly agree and freeze a narrowly scoped, equally applied resolution strategy before measurements. It must not silently weaken isolation or claim host-chat already works.

## Evidence and stopping point

All evidence is additive under:

`research-results/phase4-gvisor/2026-11-09T14-09-00Z-phase4a-native-wsl/`

The original blocked directory and all Phase 1/2/3 research remain intact. Required probe containers and temporary DNS networks were removed; native Docker/containerd and installed images remain available. No W1–W10 warm-ups, 100-run experiment, timing analysis, final Paper comparison, Phase 5, commit or push occurred. Do not rerun the one-off collectors into this completed evidence directory; use a new additive run package for subsequent work.
