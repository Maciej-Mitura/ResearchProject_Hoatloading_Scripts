# Phase 4 result

**BLOCKED**

# Executive summary

- The hard environment gate failed on the active Docker engine: a real `--runtime=runsc` container probe returned exit **125**, `unknown or invalid runtime name: runsc`.
- An explicit `runc` version probe using the same local sandbox image succeeded. Docker inspection retained runtime, container/image identity, controls, final state and cleanup evidence.
- No runsc execution was observed. No workload warm-ups, matched runs, performance measurements or Paper broadcasts were performed.
- Windows Docker Desktop's managed Linux engine has no registered runsc runtime; no runsc binary was found on its host PATH. The existing Ubuntu WSL distribution has neither native dockerd nor runsc installed.
- Exact Linux preparation and an official-package setup script were created. The installer was syntax checked and was **not executed**. Docker was not reconfigured or restarted.
- The experiment manifest is explicitly marked **blocked before comparison freeze**. Missing host/runsc values and performance statistics are null, not invented.
- All previous research and implementation fingerprints remain unchanged. No Jev calls, classifier changes, commit, push or Phase 5 work occurred.

# 1. Environment

| Item | Observed value |
|---|---|
| Client OS | Microsoft Windows 11 Pro, 10.0.26200, AMD64 |
| Docker context | `desktop-linux` |
| Docker product | Docker Desktop 4.41.2 (191736) |
| Docker Engine | 28.1.1, linux/amd64, API 1.49 |
| Docker host kernel | `6.6.87.1-microsoft-standard-WSL2` |
| Default runtime | `runc` |
| Registered runtimes | `runc`, `io.containerd.runc.v2`, `nvidia` |
| runc version | 1.2.5, commit `v1.2.5-0-g59923ef` reported by Docker |
| runsc version | Unavailable; not registered, no binary on checked host PATH |
| Sandbox image | `research-poc-sandbox:local` |
| Sandbox image ID/digest | `sha256:4a238c157340e7da78e0701066947098d83f8b47e7922a6d4f7530f6a6789b5c` |
| Observed Deno | 2.9.7, from the successful explicit-runc local-image version probe |
| Docker host allocation | 16 CPUs, 16,720,809,984 bytes memory; cgroup v2/cgroupfs |
| Additional WSL distribution | Ubuntu 24.04.2 LTS; no native dockerd or runsc found; Docker Desktop integration stub could not connect |

The daemon also reports `seccomp,profile=unconfined` and warnings about non-default seccomp and `DOCKER_INSECURE_NO_IPTABLES_RAW`. These existing settings were recorded, not altered or treated as normal default enforcement. This environment's limitations do not prove that every WSL or Docker Desktop configuration is intrinsically unable to use gVisor.

Current policy was inspected through allowlisted service settings: runner timeout 10,000 ms, output cap 1,048,576 bytes, admission capacity 2; internal `research-poc-sandbox-host` bridge; Host Gateway budget 5, message length 256 and session TTL 40,000 ms. Runner defaults/launch code specify 0.5 CPU, 256 MiB memory and swap ceiling, 64 PIDs, non-root `deno`, read-only root, cap-drop ALL, no-new-privileges, 64 MiB workspace and 16 MiB /tmp tmpfs. No credentials or raw service environment were saved.

# 2. Runtime verification

The additive probe selected the **image ID**, used `--pull=never`, network none, non-root, read-only root and the normal CPU/memory/PID/capability/tmpfs settings. It deliberately invoked `deno --version`, not the normal job entrypoint, because this was a harmless OCI-runtime capability gate rather than a workload result.

**runc:** explicitly requested `--runtime=runc`; Docker returned exit 0 and Deno 2.9.7. Inspection of container `6ee5d6cf9ccee4a2d41ec83b99dfa0897a62d3a6b09b7428ca6bee45eb703ba5` recorded `.HostConfig.Runtime=runc`, the exact image ID, exited/exit-code-0 state and resource settings. Removal and subsequent absence were confirmed. This is Docker-daemon corroboration of a successful fixed probe, not independent host-process or cryptographic attestation.

**runsc:** explicitly requested `--runtime=runsc` with the same image and surrounding probe controls. Docker returned exit 125 before any successful container execution. The named container was absent. Requested runtime is `runsc`; observed runtime is **null**. No label was substituted for successful runtime evidence.

Repository findings:

- `SANDBOX_DOCKER_RUNTIME` is trusted supervisor configuration, passed correctly into Docker arguments. The current lifecycle converts those arguments into `docker create`, then attached `docker start`, with bounded cleanup.
- Runtime selection is not accepted from scripts or API request fields. The Compose override sets the runner's job-runtime selection and does not put the supervisor itself under runsc.
- The existing production manifest's `dockerRuntime` comes from configuration, falling back to the literal `runc`; it is **requested/assumed configuration**, not inspected OCI-runtime proof. Deno version may be observed from trusted framing, which does not attest OCI runtime.
- Production inspection currently reads running/OOM state, not the actual runtime field. No existing mechanism independently attests a job passed through gVisor. The existing preflight checks registration and, if registered, a hello-world probe; it does not attest research jobs.
- The new Phase 4 probe records requested and Docker-observed runtime separately. Per-job attestation changes remain deferred behind the failed environment gate, as required; old manifests are untouched.

# 3. Experiment design

The proposed resume matrix covers W1–W10: JavaScript, TypeScript, scoped filesystem, environment profile, caught restricted operation, timeout, output truncation, bridge-confirmed host chat, controlled CPU and repeated permitted fixture reads.

The current user design calls for **one warm-up plus five measured repetitions per workload/runtime**: 20 separate warm-ups and 100 measurements. The historical prose's A–K outline and 10–20-repeat range are not an exact frozen Phase 4 manifest. No final comparison was frozen here because an actual Linux target/runsc version and per-job provenance are unavailable. Candidate historical script references/hashes are retained in `workload-plan.json`; exact paired workload bytes, including CPU/I/O loops, must be finalized before any measurements on the suitable host.

Proposed ordering alternates runtime order across rounds: runc/runsc on odd rounds and runsc/runc on even rounds. Record actual order; no unrecorded randomization. The independent variable must be runtime, with the same Linux host, image digest, Deno, script bytes, profiles, resource limits, gateway policy, network and capture semantics for both groups.

Metric definitions are recorded before measurements: existing runner `durationMs` is supervisor end-to-end duration including gateway creation/revocation and Docker lifecycle, capture and cleanup. Attached-start/source transfer shares the 10-second wall limit. Startup-only and script-only timings are currently unavailable separately and must not be invented. Docker lifetime is not pure JavaScript time. W8 confirmation timing must use trusted correlated gateway/API/Paper events. Report n/min/median/mean/max and per-workload median ratios only if both runtime groups have usable results; exclude warm-ups.

# 4. Compatibility matrix

| Workload | runc result | runsc result | Verdict | Observed difference |
|---|---|---|---|---|
| W1 JavaScript | NOT RUN | UNAVAILABLE | INCONCLUSIVE | None measured |
| W2 TypeScript | NOT RUN | UNAVAILABLE | INCONCLUSIVE | None measured |
| W3 Scoped filesystem | NOT RUN | UNAVAILABLE | INCONCLUSIVE | None measured |
| W4 Environment profile | NOT RUN | UNAVAILABLE | INCONCLUSIVE | None measured |
| W5 Caught restricted operation | NOT RUN | UNAVAILABLE | INCONCLUSIVE | None measured |
| W6 Timeout | NOT RUN | UNAVAILABLE | INCONCLUSIVE | None measured |
| W7 Output truncation | NOT RUN | UNAVAILABLE | INCONCLUSIVE | None measured |
| W8 Host chat | NOT RUN | UNAVAILABLE | INCONCLUSIVE | None measured |
| W9 CPU | NOT RUN | UNAVAILABLE | INCONCLUSIVE | None measured |
| W10 I/O/syscall-heavier | NOT RUN | UNAVAILABLE | INCONCLUSIVE | None measured |

The successful runc **version probe** is not a substitute for any W1–W10 execution.

# 5. Performance results

For every W1–W10/runtime combination, measured **n=0**. Minimum, median, mean, maximum, median differences and ratios are **unavailable/null** in `performance-summary.json`. No warm-ups occurred. No performance inference, CPU/I/O overhead comparison or acceptability decision is supported. The gate's timestamps are operational probe evidence, not a benchmark dataset.

# 6. Host Gateway / Paper result

W8 was not run for either runtime. REQUESTED, AUTHORIZED, QUEUED, DELIVERED and CONFIRMED are all **not evaluated** in Phase 4. No broadcasts were sent. Previous Phase 1/2 bridge confirmations remain historical evidence and cannot establish runsc compatibility. Future W8 must retain execution, trace, call and command IDs with actual Paper/SecureBridge confirmation; enqueue alone is insufficient.

# 7. Permission/evidence behavior

Deno permission observations, auditCollection, caught-denial retention, timeout and output-truncation equivalence under runsc are **unavailable**. No semantic differences can be inferred. Existing permission-audit events record access/check activity, not per-event allow/deny results; caught events and completeness must be evaluated explicitly in the future matched run. The denied-read workload would primarily test Deno compatibility, not independently establish gVisor isolation effectiveness.

# 8. Resource/runtime controls

| Control | runsc status |
|---|---|
| Non-root | NOT VALIDATED UNDER RUNSC |
| Read-only root and filesystem behavior | NOT VALIDATED UNDER RUNSC |
| Memory/swap and CPU limits | NOT VALIDATED UNDER RUNSC |
| PID limit | NOT VALIDATED UNDER RUNSC |
| Dropped capabilities / no-new-privileges | NOT VALIDATED UNDER RUNSC |
| Network none / internal host network | NOT VALIDATED UNDER RUNSC |
| tmpfs | NOT VALIDATED UNDER RUNSC |
| Timeout / cleanup | NOT VALIDATED UNDER RUNSC |

Selected Docker control configuration was inspected on the successful **runc version probe only**. No control qualifies as configuration-verified or behaviorally validated under runsc, because no runsc container executed. Configuration is not proof of selected resource enforcement or escape resistance.

# 9. Failures and incompatibilities

One direct runsc runtime probe failed, with no retries:

```text
docker: Error response from daemon: unknown or invalid runtime name: runsc

Run 'docker run --help' for more information
```

Docker CLI exit: **125**. Category: **environment/runtime not registered**. This is not a workload incompatibility, script failure or Deno permission failure. The old repository preflight independently returns its blocked exit code without attempting the matrix. Ubuntu's Docker integration stub is not a native Linux Docker engine. There were no measured workload failures to discard or replace.

# 10. Research integrity

The saved before-fingerprints cover **716 pre-existing repository files**, including all Phase 1/2/3 results, frozen risk corpus, labels, classifiers, policy and existing implementation/docs. All remained byte-for-byte unchanged. Phase 3's own frozen artifact hashes were also rechecked. The two direct probes used the same image ID and probe controls, but no matched-workload equality is claimed because no paired workloads ran.

All Phase 4 JSON files parse; configured credential values are scanned without printing or saving them. Only allowlisted service settings were retained. No full service/job inspection containing environment secrets was persisted. The runc probe was removed; no runsc probe container remained. No Docker daemon/default/runtime configuration, application execution code, classifier, UI, source workload or historical experiment artifact was changed. No image was pulled or built for the probes.

# 11. Files created

Repository-relative paths:

- `scripts/phase4-runtime-preflight.py`: bounded local-image runtime probes and selective environment/runtime evidence, with historical fingerprints.
- `scripts/phase4-linux-setup.sh`: prepared official signed apt installation of an exact package version on a dedicated Linux host; not executed here.
- `docs/PHASE4-LINUX-SETUP.md`: exact repository-specific preservation, image transfer, Linux setup, real runtime gate and future attestation/measurement requirements.
- `research-results/phase4-gvisor/2026-11-09T13-49-46Z-environment-gate/`: `environment.json`, `current-policy.json`, `ubuntu-wsl-check.json`, `probe-runc.json`, `probe-runsc.json`, `runtime-evidence.json`, `historical-fingerprints-before.json`, `experiment-manifest.json`, `workload-plan.json`, `compatibility-matrix.json`, `performance-summary.json`, `host-confirmation.json`, `failures.json`, `summary.json`, `integrity.json`, `tests.json`, `final-integrity.json` and this report.

# 12. Tests

- **PASS:** explicit runc local-image version execution, inspected runtime/image/controls, exit 0 and confirmed removal.
- **UNAVAILABLE:** actual runsc execution; the direct attempt failed with exit 125. The test of correct blocked-gate handling passes; that does not turn runtime unavailability into success.
- **PASS:** additive Python tool syntax, Linux installer `bash -n`, existing preflight's expected blocked result, recorded artifact assertions, prior fingerprints, JSON parsing and credential-value scan. Exact per-check outcomes/exit codes are retained in `tests.json` and final integrity results.
- **SKIPPED:** all 20 planned warm-ups and 100 measurements, because the hard gate failed.
- **SKIPPED:** production runner/profile/resource/host-chat/audit/admission regression suites; production execution code was unchanged. No unrelated large suite or Phase 2 matrix was rerun.

# 13. gVisor research conclusion

**Did it work?** runsc could not initialize on the active engine because it was not registered. The project already passes runtime selection correctly; configuration support is not empirical integration success.

**Compatibility and speed?** Unknown. No normal workload, host-chat effect, permission behavior, timing overhead or CPU/I/O difference was evaluated under gVisor. No practical-overhead acceptability claim is possible.

**Practical cost observed?** An additional suitable Linux Docker host/runtime installation and job-level evidence collection are prerequisites. The current managed Desktop daemon was not broadly modified, and an independent engine was not provisioned inside Ubuntu WSL during this gated phase.

**Architectural boundary?** gVisor interposes its application/userspace kernel to reduce direct application exposure to the host kernel. That is a design property, not a security effectiveness finding from these probes. See the official [gVisor architecture guide](https://gvisor.dev/docs/architecture_guide/intro/).

**What was empirically established?** The current engine runs the fixed local version probe through explicit runc and rejects the requested runsc runtime. No additional gVisor containment value was empirically demonstrated. This says nothing about escape prevention, zero-day resistance, arbitrary-code safety, security percentages or general runsc performance.

# 14. Remaining limitations

The active engine lacks runsc, so the central matched empirical question remains unanswered. The existing production manifest is configuration-derived and needs additive per-job inspection/corroboration before future measurements. Current daemon seccomp/iptables warnings are disclosed. A different Linux host will require its own complete environment/policy freeze and **both** runtime baselines; cross-host comparisons would confound runtime with environment.

The prepared installation script is syntax checked only; installation and runtime behavior on a future host are unvalidated. The candidate workload plan is not a completed freeze. The complete measurement/attestation harness was not implemented past the hard gate. Existing normal-stack successes and Phase 3 results cannot fill these gaps.

# 15. Recommendation

Use the prepared Linux setup path, pass a real runsc image probe, implement trusted per-job runtime evidence, then freeze and execute the matched Phase 4 experiment. Preserve this blocked attempt and every future failure. Phase 4 is not complete; no Phase 5 work has started.

DO NOT PROCEED TO PHASE 5
