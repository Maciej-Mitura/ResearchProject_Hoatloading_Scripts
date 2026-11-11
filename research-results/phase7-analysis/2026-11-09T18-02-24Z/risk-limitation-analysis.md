# Risk limitation / containment

## RESULTS

Known Deno profiles bound runtime grants independently from assistant settings.
Host-chat permits narrow SDK transport; the gateway still validates its scoped
session, capability, input and budget before trusted enqueue (S19–S20). Public
direct commands returned403, unauthenticated internal enqueue401 and a forged
execution/trace mapping403 even from an authenticated trusted harness. Real E8
reached correlated Paper confirmation. Transport did not itself confer host authority.

The final runner regression admitted two jobs, rejected overflow429 and recovered
to active0 (S21). Timeout/truncation/cleanup behavior limited known execution/output
growth. Memory/PID/CPU/privilege controls were configured; Phase 2 additionally
observed a bounded OOM case (S05). These are local controls, not full host/control-
plane denial-of-service protection. Admission covers one runner, not multiple hosts.

Unconfirmed cleanup/create state blocks new admissions by design; saved local
failure-seam tests assert the shared blocked flag (S06). The standalone cleanup
artifact's separate local admission counter is not proof of live service state.
Startup blocked on a stale container and recovered after controlled removal (S03).
Failing closed can require operator intervention and reduce availability. Lost
session-creation acknowledgement uses finite TTL rather than a revocation guarantee.

## INTERPRETATION

Containment is the strongest supported aspect: authority/effect scope and selected
resource/lifecycle behavior were bounded. The gateway is distinct from Deno's
network decision and constrains host effect even for a host-enabled script.
Deterministic/Jev advice may inform review, but changes none of those grants or
limits. No classifier-based prevention effect was measured.

## NON-CONCLUSION

No universal DoS prevention, exactly-once delivery, complete resource isolation,
distributed admission or production availability. Trusted runner/engine/gateway/API/
DB/plugin compromise and generous policy remain residual risks.
