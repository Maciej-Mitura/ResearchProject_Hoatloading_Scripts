# Phase 4A result

**COMPLETE WITH LIMITATIONS**

# Executive summary

- A genuine native Linux Docker environment now runs inside the existing Ubuntu WSL2 distribution, independently of Docker Desktop.
- All six required execution probes passed: generic runc/runsc, same-project-image runc/runsc, and real trusted-runner runc/runsc.
- Runtime evidence combines native daemon identity, explicit selection, before-cleanup Docker inspection, and host runsc processes tied to container IDs. Container-side startup output is supporting evidence only.
- The current official repositories installed Docker 29.9.3 and complete gVisor package 20261102.0, explicitly configured for systrap. Default runtime remains runc.
- Both real runner jobs completed with normal evidence, audit completeness and confirmed cleanup; production execution code was unchanged.
- A separate internal-bridge DNS preflight failed under runsc and succeeded under the corrected runc control. This documented compatibility limitation is retained and not weakened away.
- Docker Desktop and historical research remain intact. No matched workloads, warm-ups, latency comparisons, Paper broadcasts, Phase 5, commit or push occurred.

# 1. Linux environment

Ubuntu 24.04.2 LTS (noble), amd64, WSL 2.5.7.0, kernel `6.6.87.1-microsoft-standard-WSL2`. Existing systemd was already enabled; no WSL configuration change or restart was required. WSL sees 16 CPUs and approximately 15,946 MiB memory; initial Ubuntu filesystem availability was approximately 954 GiB.

Before installation, Ubuntu had no native Docker packages/daemon/socket/data directory or daemon.json. Its Docker command was a nonworking Desktop integration stub. Normal sudo required a password; the authorized installation used standard `wsl -d Ubuntu -u root`, without changing sudoers, passwords or user groups. Native and Desktop daemon network namespaces were checked as distinct before installation.

# 2. Native Docker

Installed official Docker CE/CLI `5:29.9.3-1~ubuntu.24.04~noble`, containerd.io `2.4.2-3~ubuntu.24.04~noble`, Buildx `0.38.1-1~ubuntu.24.04~noble`, Compose plugin `5.7.0-1~ubuntu.24.04~noble`. Native runc is 1.5.2. Docker/containerd are enabled through systemd.

Every experimental Docker command explicitly targets `/usr/bin/docker --host unix:///var/run/docker.sock` in Ubuntu. The daemon reports Ubuntu, its own persistent engine ID `a82ddab9-8f47-4bd6-bc17-3bb5d18d08b1`, Docker root `/var/lib/docker`, systemd service PID and `/usr/bin/dockerd`. Socket ownership is root:docker, mode 660. Engine identity, service executable/PID, native filesystem, namespace and initially separate image store distinguish it from Desktop; the identical `/var/lib/docker` spelling inside another daemon does not imply shared data.

Desktop remains Engine 28.1.1 on Windows context `desktop-linux`. Its engine identity/version, existing container IDs/running states, image IDs/tags and volume names were verified unchanged; the original API/database remains healthy. Human-readable image ages naturally advanced and were excluded from stable identity comparison. No Desktop image or volume was deleted and no Windows Docker configuration was changed.

# 3. gVisor installation

Used the current official signed gVisor apt repository: `https://storage.googleapis.com/gvisor/releases`, channel `release`, architecture amd64. Exact package is `runsc 20261102.0`; `runsc --version` reports `release-20261102.0`, OCI spec 1.2.1. This is the complete current package, including required sidecar layout, not an old standalone binary recipe.

APT used repository Signed-By keyrings and normal signature/package-hash validation, without unauthenticated bypasses. `dpkg -V runsc` passed. Installed binary SHA-256 and package/source details are retained in `installation-provenance.json`.

Supported `runsc install --runtime=runsc -- --platform=systrap` registration produced:

```json
{"runtimes":{"runsc":{"path":"/usr/bin/runsc","runtimeArgs":["--platform=systrap"]}}}
```

Only the native Ubuntu daemon was restarted. Default runtime remains **runc**. The package's flags report systrap as the default; registration explicitly fixes it, and host process evidence corroborates runsc invocation. No KVM, host networking, unconfined override or Windows security change was used.

Sources: [official Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/), [gVisor installation](https://gvisor.dev/docs/user_guide/install/), [runtime registration](https://gvisor.dev/docs/user_guide/quick_start/docker/).

# 4. Generic runtime probes

Both generic probes used the same locally resolved BusyBox 1.37.0 image ID. They printed a fixed hello marker and exited successfully. The short hold allowed trusted host inspection; no benchmark statistics were calculated.

| Runtime | Requested | Docker-observed | Exit/result | Evidence |
|---|---|---|---|---|
| runc | runc | runc | 0 / PASS | Native daemon identity, container/image inspection, output, final state and cleanup |
| runsc | runsc | runsc | 0 / PASS | Same evidence, plus two host runtime processes tied to its container ID, runsc version/registration and supporting gVisor dmesg |

The native runc probe passed before gVisor installation. The daemon engine ID remained the same across registration/restart and subsequent probes.

# 5. Project image probes

The Desktop image `sha256:4a238c157340e7da78e0701066947098d83f8b47e7922a6d4f7530f6a6789b5c` was absent from the separate native image store. The sandbox was rebuilt from the unchanged project Dockerfile. Native identity is:

`sha256:90ab4f290356c3b4d307775656227f1b4a2fff68bf64ae0082705d7d98f82efc`

The rebuilt image is not asserted byte-identical to Desktop's image. The exact **same native image ID** passed explicit runc and runsc Deno version probes; both observed Deno 2.9.7. Network none, non-root deno, read-only root, dropped capabilities, no-new-privileges and standard resource/tmpfs settings were retained.

# 6. Real runner probes

Built the trusted runner from its unchanged Dockerfile and called its actual HTTP `/execute` route once per job runtime. Both supervisor containers used runc, their native Docker socket and no published port; job runtime alone changed through trusted configuration. The same source and `none` profile were used for both. It prints two fixed hello markers separated by an asynchronous two-second delay solely to allow host observation.

| Job runtime | HTTP/result | Deno | auditCollection | Cleanup | Host evidence |
|---|---|---|---|---|---|
| runc | 200, completed, exit 0 | 2.9.7 | complete | confirmed | Exactly one sandbox start event and inspected runc/image/control fields |
| runsc | 200, completed, exit 0 | 2.9.7 | complete | confirmed | Same inspection plus host runtime processes tied to container ID |

Both had the expected fixed stdout, zero permission observations and no cleanup errors. Empty permission observations are appropriate for this harmless source; they are not a permissions-denial test. The normal result's duration was retained but not analyzed as latency or compared. Execution/trace IDs, source hash, container IDs and engine identity are stored in the per-job records.

# 7. Docker 28 / networking configuration

Native Engine is **29.9.3**, not Desktop's 28.x. The sole runsc argument is `--platform=systrap`. The official Docker-in-gVisor tutorial's `--net-raw` and `--allow-packet-socket-write` requirements concern dockerd **inside** a gVisor sandbox; this project uses native host dockerd outside runsc. Those flags were not applied. [Official nested-Docker documentation](https://gvisor.dev/docs/tutorials/docker-in-gvisor/)

A separate internal-bridge DNS preflight found:

- Initial runsc query to Docker DNS `127.0.0.11`: connection refused/timeout, exit 1.
- Initial runc diagnostic: exit 1 after inherited search-domain expansion; retained as a confounded control.
- Corrected absolute-name runc control: exit 0 and peer address resolved.
- Identical absolute-name runsc control: exit 1, connection refused/timeout.

The official [gVisor FAQ](https://gvisor.dev/docs/user_guide/faq/) documents this user-defined-bridge embedded-DNS limitation. It is not established to be WSL-specific. The existing `host-gateway:3200` name therefore has a known unresolved compatibility risk. No host networking, external DNS, packet-socket privileges or production network workaround was enabled. Failures and diagnostics remain in the dataset. No host-chat or Paper success is claimed.

# 8. Repository/Compose portability

Used the existing mounted Windows source path directly. Both unchanged project Dockerfiles built successfully; no disposable checkout, source rewrite or line-ending change was necessary.

Native Compose configuration validation passed for API, runner, host-gateway, PostgreSQL, Paper, bridge-builder, collector, sandbox and web; all build contexts and paths exist, and named volumes/internal network definitions resolve. Resolved credentials were kept in memory and not saved. The full stack was not started, as allowed by this phase. Host Gateway/API/Paper runtime behavior on the native engine remains unvalidated, and published ports must be planned to avoid the still-running Desktop stack.

Necessary production portability fixes: **none for the tested paths**. The DNS incompatibility is disclosed rather than silently corrected by changing policy or network isolation.

# 9. Runtime attestation/evidence

Implemented the smallest additive host-side collector in `scripts/phase4a-runner-probes.py`; production execution records and manifest semantics remain unchanged. Each probe record distinguishes requested/configured job runtime from inspected `.HostConfig.Runtime`, retains container/image/engine IDs, registered runtimes, host identity hash and runsc version/configuration, and binds them to the HTTP execution/source hash through exactly one start event in a serialized exclusive execution window.

The host collector runs outside the untrusted job with access to the native engine. It allowlists inspection fields and captures them before normal cleanup; no raw environment or capability-token value is retained. Runsc host processes containing the exact container ID corroborate the runsc selection. Supporting container dmesg is explicitly non-authoritative and spoofable.

This is operational host/daemon evidence, **not cryptographic attestation**. The serialized observer is not claimed to solve arbitrary concurrent-job attribution. Equivalent trusted collection must remain attached to future experimental jobs before any measurements, with the same care over correlation and secret exclusion.

# 10. Integrity

All **736 recorded pre-existing repository fingerprints** remain unchanged, including Phase 1/2/3 results, the frozen risk corpus/labels/classifiers/policy and the prior blocked Phase 4 package. Phase 3's 131 frozen hashes were separately checked. Production execution code was not changed. Docker Desktop's existing engine, images, volumes, containers and original API/database health were preserved.

All six required probe outcomes are retained, along with DNS failures and the corrected diagnostic. All probe containers and temporary diagnostic networks were removed; the enabled native daemon and installed images remain available. Final JSON parsing, credential-value scans and source syntax checks passed. No Jev/provider requests, W1–W10 warm-ups, measured executions, timing comparisons, Paper broadcasts, Phase 5, commit or push occurred.

# 11. Files created/changed

Repository-relative new files:

- `scripts/phase4a-install-native-docker.sh`
- `scripts/phase4a-install-gvisor.sh`
- `scripts/phase4a-native-probes.py`
- `scripts/phase4a-runner-probes.py`
- `scripts/phase4a-network-preflight.py`
- `docs/PHASE4A-NATIVE-WSL.md`
- `research-results/phase4-gvisor/2026-11-09T14-09-00Z-phase4a-native-wsl/`

The evidence directory contains before/after Desktop identity/inventories, native environment and installation provenance, install/build logs, six required probe records, host runtime evidence/index, Compose validation, DNS diagnostics/failures, success gate, tests, integrity results and this report. No previous repository file was edited.

Host changes were limited to authorized Ubuntu package installation, official apt sources/keyrings, native Docker/containerd services/data and native runsc registration. Windows Docker Desktop was not modified.

# 12. Remaining limitations

WSL2 remains a shared virtualized host; this establishes functionality for the tested kernel/package combination, not native bare-metal performance or long-term reliability. Full-stack native behavior and Paper confirmation have not been exercised. Windows-mounted source build access worked, but filesystem performance was not measured.

The native image ID and Docker/runc versions differ from Desktop; any later comparison must run **both** runtime groups on this same native engine/image. The known embedded-DNS incompatibility may make unchanged host-chat fail. A VM migration alone is not an established fix for this documented gVisor/Docker behavior. Do not weaken isolation to conceal it.

The current attestation collector is a trusted serialized experiment mechanism, not a cryptographic or concurrent general-purpose attestation system. Required execution gates passed; networking compatibility is a separate retained limitation, not a discarded failure.

# 13. Recommendation

The ten explicit Phase 4A success conditions are met: native daemon, runc, complete runsc installation/registration, generic runsc, identical native project image under both runtimes, both real-runner probes, trusted runtime distinction and preserved history. No WSL/kernel initialization blocker requires the VM fallback.

The environment is ready for a separately authorized Phase 4B experiment **with the DNS incompatibility explicitly carried forward**. Preserve unchanged-policy incompatibilities as research results, or agree and freeze a narrowly scoped, equally applied resolution strategy before measurements. Do not claim host-chat compatibility or start the matrix from this report.

READY FOR PHASE 4B
