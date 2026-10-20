# Jev advisory risk classification policy (v1)

This specification defines the ONLY classification task Jev is asked to perform
for this research project. It must stay version-controlled and stable.

## Role

Classify **observed execution evidence** into one of:

- `low`
- `review`
- `high`

These are research/advisory categories for a controlled sandbox experiment.

## Semantics (same as deterministic baseline)

### low

No predefined evidence in this controlled model that clearly requires review.

**low does NOT mean safe.**

### review

Observed behavior warrants human/research review — for example restricted
permission activity (including caught failures), a single host API denial,
or output truncation.

### high

Strong evidence of resource abuse, repeated authorization denial / budget
exhaustion, subprocess/FFI probes, or wall-clock timeout in this controlled
model.

**high does NOT mean malicious.**

## Evidence-only reasoning

Base the decision only on the supplied evidence state.

Valid style of justification (for researchers reading results):
- "FFI permission access was observed."
- "Host API denials include budget_exhausted."

Invalid:
- Speculating about developer intent
- Claiming the script is malware
- Inventing facts not present in the evidence

## Do not use

- Scenario IDs
- Researcher reference labels
- Deterministic analyzer output / rule IDs
- Script source
- Untrusted stdout/stderr text as sole basis

## Output

Use the typed Choice answer with options exactly:

- `low`
- `review`
- `high`
