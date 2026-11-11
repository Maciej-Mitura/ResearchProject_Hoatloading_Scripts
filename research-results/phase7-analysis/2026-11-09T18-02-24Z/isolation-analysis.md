# Isolation: separate boundaries, separate evidence

## RESULTS

Deno scoped runtime authority behaved as expected for filesystem/environment and
selected network/host-chat paths (S02, S18). Native permission restrictions are not
an independent kernel boundary. Docker supplied fresh execution environments,
configured user/rootfs/network/cgroup/privilege controls and observed bounded
lifecycle behavior (S03–S05). Final CLM-04–09 remain CONFIGURATION VERIFIED under
the authoritative matrix, including non-root, read-only root and memory ceiling.

Phase 2 supplementary controlled probes observed UID/GID1993, root-write EROFS,
writable tmpfs and a 256 MiB configuration with allocation exit137/OOMKilled=true.
Those bounded observations are real, but are not a reason to relabel the broader
final claims or claim arbitrary memory-abuse/exploitation resistance. PID64,
capability drop and no-new-privileges do not constitute tested escalation defenses.
Under runc the host kernel remains shared. No kernel/escape exploit was tested.

Runsc genuinely ran the same frozen image with trusted daemon/container attribution
(S13–S17). Nine of ten workload designs met expected semantics. Some controls were
inspected and selected UID/tmpfs/timeout behavior probed. Deno denials remained Deno
denials under both runtimes; they cannot be credited as gVisor security blocking.

## INTERPRETATION

The additional gVisor boundary has an architectural rationale (S31), but empirical
isolation evidence here establishes actual deployment and bounded behavior, not
its incremental resistance to compromise. Runtime identity evidence is operational
trusted-host attribution, not cryptographic attestation. Compatibility and overhead
measurements quantify integration consequences rather than security effectiveness.

## NON-CONCLUSION

No escape prevention, zero-day resistance, security-improvement percentage or
proof that every Docker setting resisted an attack. The complete normal host flow
passed under runc, not under all named layers simultaneously: runsc W8 failed DNS.
