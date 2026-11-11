# Engineering recommendations for a comparable bounded PoC

These priorities are scoped design guidance, not a universal production reference.

## ESSENTIAL

1. Deny by default, centrally select the smallest required runtime profile and
   keep user/AI context preferences separate from actual grants (S02,S18).
2. Use fresh execution environments, hard timeout/output bounds, bounded local
   admission and cleanup uncertainty that is explicit/fail-closed. Inspect resource
   settings rather than assuming them; do not equate the PoC with global DoS protection (S03–S05,S21).
3. Separate host transport from narrowly authorized application capabilities.
   Keep administration and privileged enqueue out of the sandbox surface (S19–S20).
4. Preserve trusted origin/correlation and distinguish queued acceptance from
   confirmed host effect. Report collection uncertainty and failed/null advice
   independently from execution outcome (S06,S19,S22).

## USEFUL

5. Keep a transparent, reproducible deterministic baseline and inspect disagreements.
   Prefer measured corpus agreement over vendor/general detector claims (S08–S09).
6. Retain durable project evidence and use standardized best-effort telemetry for
   operational correlation. Keep exporter failure outside authorization decisions;
   make limits visible instead of silently fabricating clean evidence (S22–S23).
7. Freeze case/policy/source identities, raw failures and descriptive metrics before
   interpreting outcomes. Treat hashes as audit support, not independent attestation (S10,S13).

## OPTIONAL / CONTEXT-DEPENDENT

8. Use runsc only after validating the actual image/network/host-capability topology
   and lifecycle costs. An extra boundary by design does not replace empirical
   compatibility or establish security effectiveness (S13–S17,S31–S32).
9. Use Jev or another model as separately configured advice only when the use case
   justifies provider dependence/cost/variability. This experiment supplies no modal
   agreement reason to replace the deterministic comparator (S09–S12).

Production end-user authorization, high availability and broader capability design
require their own requirements/evaluation; this analysis does not supply them.
