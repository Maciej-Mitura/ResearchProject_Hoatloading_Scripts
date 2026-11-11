# Verified results — observations, not conclusions

All values recomputed/read from saved artifacts. No new execution or classifier call.

| Finding | Verified value | Source |
|---|---|---|
| Deterministic reference agreement | 15/15 development; 9/10 holdout; 24/25 combined; sole miss HOL-008 | `research-results/phase3-jev/resume-after-credit-2026-11-09/deterministic-replay.json` |
| Jev primary | 25 cases × 5; 125 technically valid classifications | `research-results/phase3-jev/resume-after-credit-2026-11-09/result-primary-*.json` (125 concrete paths in analysis-source-hashes.json) |
| Jev repeatability | 23/25 unanimous; 121/125 match own mode; unstable SCN-010 and SCN-013 | per-case counts checked against raw primary outputs |
| Jev reference agreement | Individual 84/125; modal 16/25; deterministic-only 8; Jev-only 0; neither 1 | raw outputs, labels, analysis.json |
| Sensitivity/accounting | 15 calls / 5 cases × 3 presentations; 4/5 same class across presentations; 3 smoke; 1 prior 403; 144 total attempts, 143 successful classifications, 0 automatic retries | saved result/failure files and manifest |
| Runtime matrix | 10 workloads × 2 runtimes × 5 = 100 measured, all attested; 9/10 compatible; 85 completed, 10 expected timeouts, 5 DNS failures | measured-runs/, compatibility-matrix.json |
| W8 | runc 5/5 Paper confirmed; runsc 0/5; no successful-run ratio | host-chat-results.json and raw measured records |
| CPU / I/O medians | W9: 521→844 ms (1.619962x); W10: 592→1548 ms (2.614865x) | performance-summary.json, recomputed from measured durations |
| Integration | E1–E8 PASS; real Paper confirmation; collector outage retained enforcement; capacity2/429/recovery; 3 fresh-data cases PASS | Phase 5 artifacts |
| Regression evidence | Phase5 217 passed/0 failed; Phase6 190 passed/0 failed; each preserves local guarded DB skip1, separately passed deployed | saved test summaries; not added together as independent experiments |

## Scope clarifications

- **SC-01** All 25 frozen classifier records declare language=javascript. Do not present classifier agreement as a dedicated 25-case TypeScript study; W2 typed TypeScript execution is separate direct runtime evidence.
- **SC-02** Phase 2 records behavioral non-root/read-only/OOM probes, whereas Phase 5 CLM-04/05/06 classify final control claims CONFIGURATION VERIFIED. Preserve authoritative Phase 5 classes. Describe historical controlled OS/OOM observations as bounded supplementary subclaims, not an upgrade to general control effectiveness.
- **SC-03** W6 is expected termination, W8 runsc is incompatible. Do not describe 100 measured jobs as 100 successful completed scripts; 85 completed, 10 terminated, 5 failed. Exclude W6/W8 from useful-work comparable ratio range.
- **SC-04** No current official subquestions found in repository text search. Disclose documentation issue; use explicitly analytical themes, not invented official questions.
- **SC-05** Historical classifier evidence lacks explicit auditCollection; current Jev transformation marks legacy_unknown. Do not retroactively label old quiet records complete; distinguish Phase 5 collection checks.
- **SC-06** Phase 2 cleanup artifact displays a local admission counter while unit test separately asserts shared blocked flag. Use stored passing failure-matrix test and source mapping for seam claim, not artifact counter as live service blocking proof.

No expected numerical discrepancy was found. Qualifiers above correct possible denominator/evidence interpretations without changing historical artifacts.
