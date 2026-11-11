# Phase 4 Linux preparation — blocked on the current engine

The 2026-11-09 real probe returned Docker exit 125: `unknown or invalid runtime name: runsc`. The local runc version probe succeeded. No matched workloads, warm-ups or performance measurements were run. No runtime was installed or daemon configuration changed. Existing Windows Docker Desktop is left intact.

## Practical target environment

Use a dedicated Ubuntu 24.04 LTS VM or native Linux machine with its **own Linux Docker Engine**, local Unix socket access, systemd and administrative access. A practical starting allocation for this repository, including Paper, is 2 vCPUs, 4 GiB RAM and sufficient free storage for the existing images/world; this is a PoC provisioning suggestion, not a measured minimum. Freeze the actual host allocation before comparison.

Official gVisor prerequisites are Linux 5.6+ on x86_64 or ARM64; Docker integration requires Docker 17.09+. Prefer x86_64 here so the current amd64 sandbox image can be reused. The default systrap platform avoids requiring a nested KVM setup. Use the same host for both runtime groups. Sources: [installation](https://gvisor.dev/docs/user_guide/install/), [Docker integration](https://gvisor.dev/docs/user_guide/quick_start/docker/), [platform selection](https://gvisor.dev/docs/user_guide/platforms/).

The current Ubuntu WSL distribution is Ubuntu 24.04.2, but has no native `dockerd` or `runsc`; its Docker command is a nonworking Docker Desktop integration stub. Enabling Desktop integration alone would still target the engine that rejected runsc. An independently provisioned WSL engine might be a future option, but was not installed or validated here. Do not treat the current WSL kernel version as proof of runtime support.

## Preserve the exact current project

Transfer the complete current working tree, including uncommitted Phase 1–3 implementation and ignored research results. A fresh checkout of HEAD alone does not contain this implementation. Preserve bytes and existing hashes; exclude node_modules and provision target credentials separately in the target's ignored `.env`. Do not publish or embed credentials in a transfer manifest or report. Verify the saved historical fingerprints after transfer; create a new additive run directory on Linux.

Before leaving the current machine, export the existing sandbox image if it must be reused unchanged:

```powershell
docker image save --output phase4-sandbox.tar research-poc-sandbox:local
```

Transfer that archive and load it on the Linux host:

```bash
docker image load --input phase4-sandbox.tar
docker image inspect research-poc-sandbox:local --format '{{.Id}}'
```

Expected current identity: `sha256:4a238c157340e7da78e0701066947098d83f8b47e7922a6d4f7530f6a6789b5c`. The version probe observed Deno 2.9.7. If importing this image is impractical, build one image before freezing the new experiment, record the new digest and Deno version, and use that exact image for **both** runtimes. Do not mix current-host runc measurements with future-Linux runsc measurements.

## Install the official complete package on that dedicated host

Install Docker Engine through its official distribution-specific instructions before running the following preparation. From the copied repository root, check local-engine selection:

```bash
uname -srmo
docker context show
docker context inspect --format '{{.Endpoints.docker.Host}}'
docker version
docker info --format 'OS={{.OperatingSystem}} Default={{.DefaultRuntime}} Runtimes={{json .Runtimes}}'
```

Configure the official signed gVisor apt repository and inspect exact available package versions:

```bash
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg
curl -fsSL https://gvisor.dev/archive.key | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
printf 'deb [arch=%s signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main\n' "$(dpkg --print-architecture)" | sudo tee /etc/apt/sources.list.d/gvisor.list >/dev/null
sudo apt-get update
apt-cache madison runsc
```

Choose an exact version **before measurements**, then substitute its full version string:

```bash
bash scripts/phase4-linux-setup.sh --install-on-dedicated-host 'EXACT_APT_VERSION'
```

The script is prepared, syntax checked, and **not executed here**. It backs up an existing daemon.json, installs only from the official signed repository, preserves the Docker default runtime and verifies registration. It can reload/restart Docker if registration needs it; use a dedicated host without unrelated running work. Preserve the installed package version and `runsc --version` in the future environment manifest; do not upgrade between runtime groups. The complete apt package is preferable to old single-binary installation recipes because current releases include required sidecar binaries.

## Bring up this repository without changing sandbox policy

Configure the copied repository's ignored `.env` using `.env.example` and independently generated backend tokens. Do not reuse short/default token placeholders. Keep `EXECUTION_PROVIDER=docker`, `CHAT_PROVIDER=mock`, `RISK_ANALYZER=deterministic`; Phase 4 needs no Jev/provider calls. Keep the established 10-second timeout, 1 MiB output cap, 0.5 CPU, 256 MiB memory/swap ceiling, 64 PIDs, read-only root, dropped capabilities, no-new-privileges, 64 MiB workspace and 16 MiB tmpfs, admission capacity 2, and existing profile/network grants.

Build the application services without rebuilding/replacing the loaded sandbox image:

```bash
docker compose build api runner host-gateway web bridge-builder
SANDBOX_DOCKER_RUNTIME=runc docker compose up -d --no-build
docker compose ps
python3 scripts/phase4-runtime-preflight.py
```

The preflight records both explicit-runtime probes with the existing image ID and no image pulls. It also needs the running runner/gateway and the `research-poc-sandbox-host` network to capture the actual policy. Inspect its new `summary.json`, `environment.json` and `probe-*.json`; successful installation or a registration entry alone is insufficient. A real runsc probe must succeed, report the intended image/Deno and retain Docker inspection evidence before the main comparison is allowed.

## Resume requirements after a successful environment gate

The old `docs/GVISOR-EXPERIMENT.md` contains an outline with a 10–20-repeat range, not an exact frozen Phase 4 manifest. The user's current design specifies W1–W10, one warm-up and five measured repetitions per workload/runtime: 20 warm-ups and 100 measurements. Freeze exact workload bytes/hashes and the new host/image/runtime configuration before running any of them. Do not reuse Phase 3 evidence as newly executed Phase 4 workloads.

Keep both runtime groups on the same Linux host, image digest, Deno version, profiles, Host Gateway/Paper configuration and limits. Alternate runtime order by round and store actual ordering. Runtime remains supervisor-owned; clients must not gain a runtime override. The existing Compose mechanism can explicitly switch the trusted runner outside measured execution:

```bash
SANDBOX_DOCKER_RUNTIME=runc docker compose up -d --no-deps --no-build --force-recreate runner
# Wait for healthy runner and zero active jobs; execute the planned runc member.
SANDBOX_DOCKER_RUNTIME=runsc docker compose -f compose.yaml -f compose.gvisor.yaml up -d --no-deps --no-build --force-recreate runner
# Wait for healthy runner and zero active jobs; execute the planned runsc member.
```

Recreation/readiness is setup time and must remain outside supervisor accepted-execution duration; disclose this switching method and its residual cache/time effects. Do not rebuild or pull between pairs. The override applies to job selection, not the runner service's own OCI runtime.

Before data collection, add minimal per-job trusted runtime evidence **before cleanup**: requested runtime, container ID/name, image ID, Docker `.HostConfig.Runtime`, final state/control inspection, Docker runtime registration/version and runsc host version/platform. Where available, corroborate a running runsc container with host `runsc list`/process evidence tied to the same container ID. Do not save full container inspection or environment because W8 includes a capability token. Use allowlisted fields. Docker inspection and host corroboration are operational evidence, not cryptographic attestation; workload-reported `uname`/`dmesg` alone is spoofable and insufficient.

Metrics must be declared before execution: existing runner `durationMs` includes gateway session creation, Docker create, attached start/source transfer, capture, inspection, removal and revocation. It is supervisor end-to-end duration, not JavaScript execution time. Startup-only and script-only durations are currently unavailable separately; either declare them unavailable or add equal, reviewed stage instrumentation for both runtime groups before freezing. Keep W8 queue-to-confirmation timing separate and retain execution/trace/call/command IDs with Paper confirmation. Enqueue alone does not pass W8.

Only after that gate and configuration freeze should the matched workload experiment begin. No Phase 5 work is authorized by this preparation document.
