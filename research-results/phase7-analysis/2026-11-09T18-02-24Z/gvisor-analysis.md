# gVisor trade-off

## RESULTS (S13–S17)

Native Ubuntu24.04.2/WSL2, Docker29.9.3, runsc release-20261102.0/systrap, same
project sandbox image. Ten workloads ×two runtimes ×five measured repetitions =100;
all operationally runtime-attested, zero infrastructure-invalid/rerun/unattempted
measured jobs. Nine workload designs meet expected semantics under both runtimes.
Measured process statuses:85 completed,10 expected timeout terminations,5 failed.
The95 expected-semantic successes do not mean95 normal process completions.

W8 runc confirmed5/5 in Paper; runsc0/5 failed hostname resolution before gateway
request/enqueue. The gateway remained healthy. A separate post-experiment BusyBox
direct-IP health probe supports DNS-specific incompatibility, not successful Host
SDK authorization/Paper execution. It is excluded from compatibility/timing figures.

| Workload | runc median ms | runsc median ms | Ratio | Interpretation |
|---|---:|---:|---:|---|
| W1 | 429 | 799 | 1.862x | Five successful expected-semantic runs per runtime; supervisor duration |
| W2 | 426 | 777 | 1.824x | Five successful expected-semantic runs per runtime; supervisor duration |
| W3 | 451 | 781 | 1.732x | Five successful expected-semantic runs per runtime; supervisor duration |
| W4 | 434 | 798 | 1.839x | Five successful expected-semantic runs per runtime; supervisor duration |
| W5 | 477 | 801 | 1.679x | Five successful expected-semantic runs per runtime; supervisor duration |
| W6 | 10289 | 10257 | 0.997x | Fixed timeout/lifecycle; exclude from useful-work range |
| W7 | 483 | 1113 | 2.304x | Five successful expected-semantic runs per runtime; supervisor duration |
| W8 | 748 | N/A | N/A | Failed DNS durations excluded; no successful-task comparison |
| W9 | 521 | 844 | 1.620x | Five successful expected-semantic runs per runtime; supervisor duration |
| W10 | 592 | 1548 | 2.615x | Five successful expected-semantic runs per runtime; supervisor duration |

Metric: supervisor end-to-end duration including container setup, source transfer,
capture, inspection, removal and session revocation; excludes later Paper result.
W9 CPU median521→844ms (1.619962x); W10 I/O592→1548ms (2.614865x). Eight comparable
non-timeout workloads span about1.62–2.61x. The near1.0x W6 ratio reflects a fixed
deadline, not faster useful work. W8's failed DNS responses cannot be divided by
successful runc task times as a meaningful overhead ratio.

Deno observation targets/counts and collection limitations matched in the tested
matrix. W10 reaches the200-event cap/partial audit; W6/W7 remain unavailable.
Runsc resource inspection/probes do not turn a combined root-write denial into
isolated read-only-root proof. No escape/exploit experiment occurred.

## INTERPRETATION

gVisor's additional boundary is an architectural property, explained by the
[official architecture reference](https://gvisor.dev/docs/architecture_guide/intro/)
(S31), not a measured security-effectiveness gain. Most selected workloads worked,
but host-enabled integration was not transparent and supervisor costs were material.
The I/O example had a larger observed ratio/difference than the CPU example; startup,
audit and lifecycle are intertwined, so this is no general syscall-cost law.

For this PoC runsc is a technically viable optional/researched boundary for most
workloads, but not a drop-in default for the unchanged host-chat topology. Normal
runc demo success and separate runsc measurements must not be combined into a false
claim that the full named stack passed every end-to-end case simultaneously.

## NON-CONCLUSION

No universal slowdown percentage, no pure script-runtime estimate, no incremental
escape prevention/exploit resistance or quantified security improvement. Five
repetitions on one WSL2 host do not establish performance across native hosts,
platforms or releases. Intentional shutdown is not a regression. DNS was not fixed.
