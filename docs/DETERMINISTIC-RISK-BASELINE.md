# Deterministic Risk Baseline v1

Experimental **advisory** behavioral classifier for controlled research
scenarios. Later compared with Jev on the same `ExecutionEvidenceRecord`.

## Purpose

Answer (later): does Jev add useful classification vs transparent deterministic
rules when both see the same evidence?

## What it is not

- Not authorization
- Not malware detection proof
- Not a production IDS
- Not proof of malicious intent
- Does not grant permissions, change Deno profiles, override Host Gateway, or
  terminate executions

## Evidence input

Only `ExecutionEvidenceRecord` (schema v1). See
[`EXECUTION-EVIDENCE.md`](./EXECUTION-EVIDENCE.md).

The analyzer never receives `scenarioId` or `expectedResearchLabel` as features.

## When analysis runs

Post-execution, after sandbox observations are persisted:

`validating` → `running` → `analysing` → terminal status

Pre-execution source scanning is mock-only legacy (`RISK_ANALYZER=mock`).

## Classification semantics

| Label | Meaning |
|-------|---------|
| **LOW** | No predefined high-risk indicators in this controlled model. **Not “safe”.** |
| **REVIEW** | Unusual/restricted behaviors warrant review. |
| **HIGH** | Strong predefined indicators (timeout, FFI/run, repeated host denial, …). **Not “malicious”.** |

## Rule version

`ruleVersion: "1"` — experimental deterministic baseline v1.

Thresholds are research heuristics, not academically optimal.

| ID | Trigger | Severity |
|----|---------|----------|
| R001 | `failureCategory === deno_permission` | REVIEW |
| R002 | `permission === run` access | HIGH |
| R003 | `permission === ffi` access | HIGH |
| R004 | ≥1 `host_api.denied` | REVIEW |
| R005 | ≥2 denials or `budget_exhausted` | HIGH |
| R006 | timed out | HIGH |
| R007 | output truncated | REVIEW |
| R008 | (implicit) authorized chat.broadcast alone does not escalate | — |
| R009 | restricted filesystem read access (incl. caught) | REVIEW |
| R010 | (default) no matches → LOW | LOW |
| R011 | unexpected env access | REVIEW |
| R012 | unexpected net access | REVIEW |

Expected host-chat `env`/`net` targets and fixture reads under `/fixtures/` do
not escalate by themselves.

## Precedence

HIGH overrides REVIEW overrides LOW.

**All** matched rules are retained as reasons.

## Score

Transparent mapping — **not** a probability of malice:

- LOW ≈ 0.15
- REVIEW ≈ 0.34–0.66 (rule weights)
- HIGH ≈ 0.67–1.0 (rule weights)

## Configuration

```
RISK_ANALYZER=deterministic   # default for research
RISK_ANALYZER=mock            # legacy source heuristics
RISK_ANALYZER=jev             # TypeSafe System One / Jev (advisory; needs API key)
RISK_ANALYZER=comparison      # hot path stays deterministic; dual analysis via research tooling
```

See `docs/JEV-RISK-COMPARISON.md` for the fair Jev comparison methodology.
Do **not** retune ruleVersion 1 after Jev/holdout results — create ruleVersion 2 instead.

## Scenario corpus

`fixtures/scenarios/manifest.json` — 15 controlled scenarios.

Labels: `expectedResearchLabel` (researcher-defined expectation).

Runner: `npm run scenarios` → `research-results/scenarios/<timestamp>.{json,csv}`

Evaluation is a **controlled PoC scenario evaluation** — not production accuracy.

### Latest controlled run (2026-10-19)

`npm run scenarios` against Docker/Deno + `RISK_ANALYZER=deterministic`:

- 15/15 exact match to `expectedResearchLabel` (100% on this closed corpus)
- This number is **not** production accuracy, not statistical generalization, and
  not proof the rules are academically optimal.

## Execution status vs risk

Independent. Example: `COMPLETED` + `REVIEW` (caught restricted read) is valid.
