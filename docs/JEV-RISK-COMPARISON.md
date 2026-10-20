# Jev advisory risk comparison

**Status:** Provider integrated. Live corpus evaluation requires
`JEV_API_KEY` or `TYPESAFE_API_KEY` on the API process.

## Product / API used

| Item | Value |
|------|--------|
| Product | TypeSafe **System One** |
| Model family | **Jev** (flagship System One model) |
| HTTP endpoint | `POST https://api.typesafe.ai/v1/systemone` |
| Auth | `Authorization: Bearer <API_KEY>` |
| Official docs | https://docs.typesafe.ai/api |
| Default model alias | `jev-latest` (override with `JEV_MODEL`) |
| Question type | typed **Choice** |
| Options | `low` \| `review` \| `high` |
| Client | Raw HTTP adapter in Deno (`apps/api/src/risk/jev.ts`) |

Official JavaScript SDK package name (documented, not required here):
`@typesafe-ai/sdk` with env `TYPESAFE_API_KEY`.

This PoC intentionally uses the documented HTTP interface so Deno does not
depend on the Node SDK. If the live API response `model` field differs from
older research notes (e.g. `jev-1.14.0` vs `jev-1.13.0`), trust the response
and record it in `providerMetadata.responseModel`.

## Architecture

```
ExecutionEvidenceRecord v1
        │
        ├── DeterministicRiskAnalyzer (ruleVersion 1)
        └── JevRiskAnalyzer (adapterVersion 1)
                 │
                 └── compact JevRiskState → System One Choice
```

Neither analyzer:

- grants Deno permissions
- overrides Docker restrictions
- grants Host Gateway capabilities
- blocks / unblocks / terminates execution
- changes sandbox configuration

**Jev does not provide authorization.**
**Jev cannot override deterministic sandbox controls.**

## Configuration

```
RISK_ANALYZER=deterministic   # default / safe local
RISK_ANALYZER=mock
RISK_ANALYZER=jev              # hot-path advisory via Jev (needs API key)
RISK_ANALYZER=comparison      # hot path stays deterministic; dual analysis via research tooling
```

Credentials (API container only — never web, sandbox, Host Gateway, or Paper):

```
JEV_API_KEY=...               # preferred alias for this project
TYPESAFE_API_KEY=...          # official TypeSafe env name (also accepted)
JEV_MODEL=jev-latest
JEV_API_URL=https://api.typesafe.ai/v1/systemone
JEV_TIMEOUT_MS=30000
```

## Input transformation

Source of truth: `ExecutionEvidenceRecord` v1 (`apps/api/src/risk/evidence.ts`).

Compact state builder: `apps/api/src/risk/jev-input.ts` → `JevRiskState`.

Includes (examples): termination, duration/timeout/truncation flags, permission
profile, observed permission accesses, Deno permission failure category, host
API requested/allowed/denied/queued counts and denied reasons, runtime/
container metadata, trusted provenance (excluding `script_output`).

**Never sent to Jev:**

- `expectedResearchLabel` / `referenceLabel` / scenarioId / holdout flags
- deterministic classification, rule IDs, scores, reasons
- full script source
- full stdout/stderr (untrusted context is stripped)
- API keys, capability tokens, bridge tokens

Classification policy text: `config/jev-risk-policy.md` (versioned).

## Typed output

System One Choice answer:

```json
{
  "type": "choice",
  "choice": "review",
  "probabilities": { "low": 0.1, "review": 0.7, "high": 0.2 },
  "confidence": 0.55
}
```

Normalized app result:

```json
{
  "analyzer": "jev",
  "analyzerVersion": "1",
  "classification": "LOW|REVIEW|HIGH mapped to low|review|high",
  "confidence": 0.55,
  "reasons": ["local evidence facts…"],
  "latencyMs": 123,
  "status": "ok|failed|unavailable",
  "providerMetadata": { "…": "…" }
}
```

Unknown choice strings are **rejected** (`unknown_classification`).
No silent coercion of free text into a class.

TypeSafe Choice does **not** return free-text rationales. UI “reasons” are
**local evidence facts** derived from the same record (not model prose).

## Confidence semantics

Per https://docs.typesafe.ai/confidence :

> Choice `confidence` collapses the probability distribution across options
> into a number in \[0, 1\]. It is 1 when all probability is on one option and
> 0 when probability is spread evenly.

UI wording: **Jev confidence**.

**Do not** interpret as:

- “probability that this script is malicious”
- “92% malicious”
- calibrated probability of researcher-label correctness

Exploratory confidence-vs-correctness means may be computed on controlled
labels; **Brier score is omitted** because confidence is not defined as
P(label correct) for our three-way research categories.

## Failure behavior

On timeout, HTTP/auth/rate-limit errors, invalid output, or missing credentials:

- execution results and security controls are unaffected
- assessment stored with `assessment_status=failed|unavailable` and
  `classification=null`
- OTel event `risk.classification_failed`
- UI: “Jev unavailable” — never silently labeled as a deterministic result

## Comparison / freeze / repeatability

Research endpoints (advisory only):

- `GET /api/research/evidence/:executionId` — rebuild frozen evidence
- `POST /api/research/risk-classify` — classify frozen evidence (1..10 reps)

Runner:

```
npm run risk-comparison
npm run risk-comparison -- --freeze-only
npm run risk-comparison -- --evidence-dir <path> --reps 5
```

Exports: `research-results/risk-comparison/<timestamp>/`

- `summary.json`
- `runs.json`
- `results.csv`
- `evidence/*.json` (frozen records)

Default repetitions: **5** (override with `--reps` or `JEV_REPS`).

## Corpora

| Corpus | Location | Note |
|--------|----------|------|
| Closed development (15) | `fixtures/scenarios/manifest.json` | Deterministic rules were developed with these known — **not** independent generalization |
| Holdout variants (~10) | `fixtures/scenarios/holdout-manifest.json` | Variants/combinations; researcher labels only for evaluation |
| Sensitivity | `fixtures/scenarios/sensitivity.json` | Same evidence, presentation variants only |

Analyzers never receive corpusType / holdout / reference labels as features.

**Do not change deterministic ruleVersion 1 after seeing holdout/Jev results.**
Any later change must be `ruleVersion 2`.

## Class definitions (shared)

Same semantics as the deterministic baseline:

- **LOW** — No predefined evidence in this controlled model that clearly requires review. **≠ safe**
- **REVIEW** — Observed behavior warrants human/research review
- **HIGH** — Strong evidence of resource abuse, repeated authorization denial, or other high-priority behavior in the controlled model. **≠ malicious**

Classify **observed behavior**, not developer intent.

## Metrics

Reported in `summary.json`:

- exact agreement with researcher labels (per corpus)
- agreement between deterministic and Jev
- per-class precision/recall where cells are populated
- disagreements, Jev failures by kind
- latency min/max/mean/median/p95 (Jev vs deterministic)
- repeatability across frozen-evidence repetitions
- small sensitivity matrix
- exploratory confidence means (with calibration caveats)

## Claim limits

Justified (when live eval is run and exported):

- “Jev classified execution evidence in the controlled scenario set.”
- Agreement rates on closed vs holdout corpora under stated methodology.

**Not** justified by this integration alone:

- “Jev detects malicious code.”
- “Jev improves security.”
- Transfer of vendor benchmark accuracy into this script domain.
- Treating closed-corpus 15/15 deterministic as generalization.

## Tests

`apps/api/tests/jev_risk_test.ts` — mocked fetch only; no live credits.

## Freeze & verify (before live Jev)

```bash
# Inventory, fingerprints, freeze 25 evidence records, dry-run, cost preview
npm run risk-freeze
# or: node scripts/freeze-risk-experiment.mjs --dry-run --scenario SCN-005

# Inspect:
#   research-results/risk-comparison/experiment-manifest.json
#   research-results/risk-comparison/frozen-evidence-v1/
#   research-results/risk-comparison/jev-dry-run-SCN-005.json
```

Planned live calls (5 reps + sensitivity): **140** System One requests.
No paid call is made during freeze/dry-run.

## Live evaluation checklist

If credentials are configured on the API:

1. Ensure freeze is done (`frozen-evidence-v1` has 25 records).
2. Set `JEV_API_KEY` or `TYPESAFE_API_KEY` on the API and restart.
3. Live classify (fails hard without Jev — never fakes results):

```bash
node scripts/risk-comparison.mjs --require-jev --evidence-dir research-results/risk-comparison/frozen-evidence-v1 --reps 5
```

4. Resume if interrupted:

```bash
node scripts/risk-comparison.mjs --require-jev --evidence-dir research-results/risk-comparison/frozen-evidence-v1 --resume research-results/risk-comparison/<run-dir> --reps 5
```

If credentials are absent: **Jev evaluation not performed** (exit code 2 with `--require-jev`).
