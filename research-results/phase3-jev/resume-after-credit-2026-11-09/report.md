# Phase 3 result

**COMPLETE WITH LIMITATIONS**

# Executive summary

- The approved experiment completed: 3 smoke, 125 primary and 15 predefined sensitivity classifications, all technically valid.
- The resumed run made 143 successful provider attempts. Including the preserved earlier HTTP 403, cumulative attempts were **144/150**. There were no automatic retries, invalid responses or unattempted planned classifications.
- Jev was unanimous on 23/25 cases. SCN-010 and SCN-013 each split 3:2, with 60% modal stability.
- Agreement with researcher reference labels was 84/125 individual primary calls (67.2%) and 16/25 case modes (64%). The unchanged deterministic baseline matched 24/25 (96%).
- Deterministic analysis alone matched reference on eight cases; Jev alone matched on none. Both missed HOL-008.
- All frozen and historical checks passed. No evidence, labels, rules, policy, adapter, transformation or model was changed. No further provider work or Phase 4 work was performed.

# 1. Frozen configuration

| Item | Frozen configuration |
|---|---|
| Corpus | 25 cases: 15 closed development, 10 holdout variants |
| Corpus hash | `bd47b803f9708b487968fba63e1d6422c286dca2f4793a6d5e7816e020b6db0b` |
| Provider | Vercel AI Gateway |
| Endpoint | `https://ai-gateway.vercel.sh/typesafe/v1/systemone` |
| Requested and reported model | `typesafe-ai/jev-1.14.0` |
| Policy | Version 2, `config/jev-risk-policy-v2.md` |
| Policy SHA-256 | `4220afc83059cd6449e864ff09d43f1fcb610872ea4d344f7ced6c28f4a102f8` |
| Evidence / collection extension | Evidence schema 1; transformation adds collection extension 1, with `legacy_unknown` collection status for these historical records |
| Input / transformation / analyzer | 2 / 2 / 2 |
| Deterministic rules | V1, unchanged |
| Primary ordering | Five rounds, HOL-001 through HOL-010 then SCN-001 through SCN-015 in each round |
| Planned classifications | 3 smoke + 125 primary + 15 sensitivity = 143 |
| Bound | 150 attempts, including earlier blocked smoke and retries; maximum two automatic transient retries per classification |
| Tool runtime | Deno 2.1.4; TypeScript 5.6.2; V8 13.0.245.12-rusty |
| Source identity | HEAD `23f7e66a6f6e2ed171d9d6fe36fe32e87e12c09f`, with pre-existing uncommitted implementation identified by manifest hashes |

The authoritative current experiment is the additive Phase 3 manifest and its 131 file hashes, together with the frozen corpus, label manifests and sensitivity plan. The historical experiment manifest used policy 1/direct `jev-latest`; that artifact remains untouched and is not the current configuration. Reference and deterministic-rule hashes are recorded in the current manifest. The evidence was not regenerated.

The existing diagnostic sanitizer over-redacts `policySource` because the harmless filename contains `sk-`. `provenance-clarification.json` records the actual path and unchanged policy hash. Request body hashes were independently recomputed successfully; this logging limitation did not change transmitted policy or evidence.

# 2. Deterministic baseline

| Partition | Agreement with researcher reference labels |
|---|---:|
| Development | 15/15 (100%) |
| Holdout | 9/10 (90%) |
| Combined | 24/25 (96%) |

The sole miss remains HOL-008: reference REVIEW, deterministic LOW. No rule or case was changed to repair it.

# 3. Smoke test

The local API/database health check passed, all 25 inputs validated, all canonical request hashes matched the prepared requests, and filesystem persistence worked. Each smoke call succeeded on its first attempt through the unchanged typed adapter, with validated confidence/distribution and exact reported model provenance. Agreement with reference was not a technical gate.

| Case | HTTP | Class | Model-reported confidence | Latency, ms | Technical gate |
|---|---:|---|---:|---:|---|
| SCN-001 | 200 | LOW | 0.85 | 1456 | Pass |
| SCN-005 | 200 | LOW | 0.74 | 254 | Pass |
| SCN-011 | 200 | HIGH | 1.00 | 237 | Pass |

SCN-005 disagreed with its REVIEW reference, legitimately. No parser loosening or policy change was made. The primary experiment began only after all three gates passed.

# 4. Provider call accounting

| Stage | Attempts | Successful classifications | Failed requests | Invalid responses |
|---|---:|---:|---:|---:|
| Preserved pre-credit smoke | 1 | 0 | 1 | 0 |
| Resumed smoke | 3 | 3 | 0 | 0 |
| Primary | 125 | 125 | 0 | 0 |
| Predefined sensitivity | 15 | 15 | 0 | 0 |
| Total including preserved failure | **144** | **143** | **1** | **0** |

Automatic retries: **0**. User-authorized manual resume after credit: **1**. Unattempted planned classifications: **0**. Six attempts remained below the ceiling and were not used. The earlier failed request is not a classification or independent repetition. Historical Jev diagnostics and approval-block artifacts outside this frozen experiment remain preserved and excluded from its planned classification denominators.

# 5. Primary experiment completion

All 25 cases received exactly five successful classifications, in the frozen round-based lexical ordering. There were no missing rounds, duplicate results, selectively repeated disagreements or excluded responses. The 125 primary calls represent repeated measurements of **25 scenarios**, not 125 independent scenarios. Smoke and sensitivity results are excluded from primary agreement and repeatability metrics.

# 6. Jev repeatability

23/25 cases (92%) were unanimous. The other two were:

| Case | LOW | REVIEW | HIGH | Modal class | Modal stability |
|---|---:|---:|---:|---|---:|
| SCN-010 | 0 | 3 | 2 | REVIEW | 60% |
| SCN-013 | 2 | 3 | 0 | REVIEW | 60% |

Across all cases, 121/125 calls matched their own case mode (96.8%); mean per-case modal stability was also 96.8%. Within-case pair agreement was 238/250 pairs (95.2%). These are descriptive repeatability measures, not independent sample-based estimates of general performance.

`per-case-analysis.md` provides the full 25-case table with reference, deterministic result, LOW/REVIEW/HIGH counts, modal result, stability, unanimity, confidence minimum/mean/maximum and provider-failure count. `per-case-analysis.json` additionally retains each round's confidence/distribution and structured observations. All per-case provider-failure counts are zero.

# 7. Reference agreement

| Partition | Individual successful primary calls | Modal per-case | Deterministic V1 |
|---|---:|---:|---:|
| Development | 54/75 (72%) | 10/15 (66.7%) | 15/15 (100%) |
| Holdout | 30/50 (60%) | 6/10 (60%) | 9/10 (90%) |
| Combined | **84/125 (67.2%)** | **16/25 (64%)** | **24/25 (96%)** |

These figures measure **agreement with researcher reference labels**, not general classifier accuracy. The individual-call rate differs from the modal rate because minority outputs on SCN-010 and SCN-013 matched their references while their modes did not.

# 8. Jev vs deterministic

| Comparison against reference | Cases |
|---|---:|
| Both match | 16 |
| Deterministic only matches | 8 |
| Jev only matches | 0 |
| Neither matches | 1 |
| Jev unstable, overlapping the categories above | 2 |
| Insufficient Jev results | 0 |

Deterministic-only cases: HOL-002, HOL-003, HOL-009, SCN-005, SCN-006, SCN-010, SCN-013 and SCN-015. HOL-008 is the neither-match case. Jev showed no incremental reference-matching advantage on this corpus.

# 9. Disagreement analysis

These explanations describe available evidence and observed decisions. The provider returned a typed Choice and probabilities, not free-text rationales. Stored explanatory reasons are locally generated evidence facts; they are not Jev's reasoning.

- **HOL-002, HOL-003 and HOL-009:** all five Jev outputs were LOW instead of reference/deterministic REVIEW. The available evidence records permission accesses (HOME; fixture read plus HOME; /etc/hosts plus PATH respectively) but completed termination and a null aggregate failure category. Caught denial details in stdout were deliberately excluded. These results expose a different interpretation of recorded accesses when execution completes; the model's internal reason cannot be established.
- **SCN-005 and SCN-006:** the same pattern occurred for /etc/hosts access, alone or alongside an allowed fixture read. Jev consistently returned LOW; reference and deterministic results were REVIEW. The allowed/denied meaning of every individual access is not fully encoded by an access record and null aggregate failure alone.
- **SCN-010:** structured evidence explicitly includes FFI access, a Deno permission failure and failed termination. Jev split HIGH/HIGH versus REVIEW/REVIEW/REVIEW; both reference and deterministic output are HIGH. The model's distributions straddled REVIEW and HIGH, with low reported confidence (0.26–0.30). This is genuine repetition variability, not a parsing failure.
- **SCN-013:** one authorized broadcast, allowed/queued host evidence and completed termination produced two LOW and three REVIEW outputs. Reference and deterministic output are LOW. This case was unstable at low reported confidence (0.26–0.31); a modal REVIEW should not be interpreted as evidence that the authorized call was abusive.
- **SCN-015:** six host requests, five allowed/queued calls and a `budget_exhausted` denial yielded REVIEW on all five calls, rather than reference/deterministic HIGH. Jev did not reproduce the frozen escalation criterion on this controlled case.
- **HOL-008:** both classifiers returned LOW, Jev unanimously, while reference is REVIEW. Trusted structured evidence contains no subprocess access or aggregate failure: execution completed, and the subprocess attempt is missing from trusted observations. Jev received no source or stdout and did not detect the missing attempt. This is an observation blind spot, not a defect repaired by inference or by altering the case.

# 10. Confidence analysis

All 143 successful responses had internally consistent distributions: finite values in [0,1], sum one within the existing tolerance, and chosen class at a maximum probability. Their model-reported classification confidences were in [0,1]. Confidence is separate from the selected-class probability; the adapter did not require those two numbers to be equal.

For 125 primary calls, mean confidence was 0.8066, median 0.85, range 0.26–1.00. Calls on unanimous cases averaged 0.8524; calls on the two unstable cases averaged 0.2790. Lower confidence accompanied observed instability here, but unanimous HOL-004 also had low confidence (0.26–0.40). Confidence alone therefore did not establish stability.

Reference-disagreeing calls averaged 0.7068 and reached 0.86, demonstrating that appreciable confidence can accompany a reference disagreement. Mean within-case confidence range was 0.0472; the largest was 0.14 (HOL-004 and SCN-002). These observations do not establish calibration. Confidence is not the probability a script is malicious.

# 11. Latency analysis

Latency includes request start through body consumption and adapter output validation. p95 uses nearest rank. All figures are milliseconds.

| Successful-call set | n | Minimum | Median | Mean | p95 | Maximum |
|---|---:|---:|---:|---:|---:|---:|
| Primary | 125 | 180 | 230 | 246.232 | 397 | 535 |
| Smoke | 3 | 237 | 254 | 649.000 | 1456 | 1456 |
| Sensitivity | 15 | 191 | 238 | 232.000 | 286 | 286 |
| All successes | 143 | 180 | 233 | 253.189 | 397 | 1456 |

The one preserved failed-response latency was **690 ms**, kept separate. No causal interpretation of first-call/warm-up differences is justified by this experiment. These times are post-execution advisory classification times and are not a like-for-like comparison with sandbox execution latency.

# 12. Provider failures/retries

The only failure in this frozen experiment was the earlier SCN-001 attempt: HTTP 403, provider type `customer_verification_required`, adapter category `billing_failure`, classification/confidence null. Its sanitized provider response remains intact in the old run and in the additive `failure-log.json`:

```json
{"error":{"message":"AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.","type":"customer_verification_required"}}
```

No resumed request failed, so no automatic retry or backoff was needed. Provider operation was sufficient for this bounded run after the user reported adding credit; this does not establish long-term availability. Failures were never converted into LOW or another classification.

# 13. Sensitivity experiment

The predefined 5-case × 3-presentation experiment completed unchanged after the primary calls. The actual structured facts were verified equal across variants. Results are separate from primary statistics.

| Case | Canonical class / confidence | Reordered class / confidence | Compact notes class / confidence |
|---|---|---|---|
| SCN-001 | LOW / 0.86 | LOW / 0.82 | LOW / 0.97 |
| SCN-005 | LOW / 0.72 | LOW / 0.37 | LOW / 0.56 |
| SCN-010 | REVIEW / 0.28 | REVIEW / 0.28 | HIGH / 0.37 |
| SCN-014 | REVIEW / 1.00 | REVIEW / 1.00 | REVIEW / 1.00 |
| HOL-003 | LOW / 0.82 | LOW / 0.56 | LOW / 0.92 |

Four selected cases retained class across all three variants; SCN-010 changed. Confidence also varied materially without a class change. Because there was only one call per case/presentation and SCN-010 already varied in primary repetitions, the observed change cannot be attributed uniquely to formatting. The result does not establish broad presentation invariance or a causal formatting effect.

# 14. Research integrity

- All 25 frozen evidence records, 25 reference labels and deterministic rules remain unchanged. The deterministic replay remained 15/15 development and 9/10 holdout.
- All **131 frozen artifact hashes** and **24 previous Phase 3 file hashes** matched, preserving the original approval-block and 403 results as well as earlier research fingerprints.
- All **144 retained attempt outcomes**, including the earlier failure, map to their stored request-body and evidence hashes. All resumed attempts have write-ahead intents. Actual network request bytes were also checked against the prepared hash before transmission in the batch driver.
- Provider, endpoint, model, policy and version fields matched throughout. The adapter, schema, transformation and policy were not changed. Successful response distributions passed the existing typed validation without heuristic loosening.
- Request bodies contained only the approved policy/schema and structured execution-evidence state. They excluded source, stdout/stderr, researcher labels, deterministic classifications and configured secret values. Literal capability-token variable names are evidence names, not token values.
- Primary order, repetition attribution and predefined sensitivity facts/variants were verified. No results were dropped or selectively rerun.
- All research-result JSON files parse; exact configured credential values were scanned across research results with no matches. The final integrity artifact records scan counts and checks.
- The focused Jev adapter/request/parser/leakage tests passed **31/31**; the additive batch driver passed Deno type checking. All runtime changes were confined to additive experiment orchestration and offline reporting, with no frozen implementation changes.
- No Docker evidence regeneration, enforcement change, commit, push, UI change or Phase 4 work occurred.

# 15. Jev research conclusion

Jev added a second advisory interpretation and useful information about uncertainty: FFI severity and authorized host-call interpretation were near decision boundaries, and confidence/presentation variation made those limits observable. It supplied no demonstrated improvement in agreement over deterministic analysis: there were zero Jev-only modal matches and eight deterministic-only matches.

It was often repeatable, with 23/25 unanimous cases, but repeatability did not imply reference agreement. Its persistent LOW results for several completed executions with recorded sensitive accesses, and REVIEW for a host-budget denial, differed from the frozen research criteria. It also introduced variability in two cases that deterministic analysis handles reproducibly.

Jev supplied no generated explanation and did not recover HOL-008's missing trusted observation. Provider operation supported this experiment after the prior account gate was resolved, but long-term operation was not evaluated. The justified conclusion is **no demonstrated incremental reference-agreement benefit for the pinned Jev/policy combination on this controlled corpus**, with limited advisory value as a second interpretation and uncertainty signal. It should remain advisory; these findings do not justify enforcement authority.

# 16. Files created

All new experiment results are under repository-relative directory:

`research-results/phase3-jev/resume-after-credit-2026-11-09/`

Principal files:

- `resume-context.json`, copied `manifest.json`, `requests.json`, `local-validation.json`, `deterministic-replay.json`.
- `health-preflight.json`, `smoke-attempts.json`, three smoke attempt files and their intents, `summary.json` and `integrity-after.json` (smoke-only summary retained).
- `batch-plan.json` (immutable scheduled jobs and prepared request bodies), `batch-health-*.json`, `batch-attempts.json`, `batch-state.json`, 140 result files and their 140 write-ahead intents.
- `analysis.json`, `per-case-analysis.json`, `per-case-analysis.md`, `failure-log.json`, `provenance-clarification.json`, `focused-tests.json`, `final-integrity.json` and this `report.md`.

Additive tooling: `scripts/phase3-resume-batch.ts` and `scripts/analyze-phase3-resume.py`. The existing `scripts/phase3-jev.ts` and all pre-resume artifacts remain untouched. No commit or push was made.

# 17. Remaining limitations

Only 25 researcher-designed controlled scenarios were evaluated, with a small related-variant holdout set. Neither the cases nor their labels constitute an independent representative real-world benchmark. Five repetitions measure within-run repeatability; they do not multiply independent scenario count. One model, policy and short operating window were tested.

The historical evidence has explicit `legacy_unknown` audit completeness; caught events may be incompletely represented. In particular, HOL-008's subprocess behavior is absent from trusted observations. Access events and an aggregate failure category do not always encode a per-access authorization outcome. Frozen labels can rely on researcher design knowledge that the classifier does not receive.

Confidence is uncalibrated model-reported classification confidence. The provider supplies no free-text rationale. Successful raw HTTP bodies were consumed by the typed adapter; retained provider outputs are sanitized parsed results, distributions, model and usage metadata rather than raw wire archives. The filename over-redaction is documented without changing the frozen scrubber. One sensitivity call per variant cannot isolate presentation effects from ordinary variability. No broader safety, maliciousness, calibration or long-term reliability conclusion follows.

# 18. Recommendation

Phase 3's empirical objective is complete, including its negative comparison result. Preserve this frozen package, retain deterministic analysis as the transparent baseline, and keep Jev advisory. The evidence supports moving the research roadmap to a separately authorized Phase 4; it does not support promoting Jev or claiming that it outperformed the baseline. No Phase 4 work has started.

READY FOR PHASE 4
