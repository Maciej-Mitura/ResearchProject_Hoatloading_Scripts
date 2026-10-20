# Controlled scenario corpus

Researcher-defined execution scenarios for evaluating advisory risk classifiers.

- Closed development (15): `manifest.json`
- Holdout variants (~10): `holdout-manifest.json`
- Sensitivity presentations: `sensitivity.json`
- Scripts: reuse `fixtures/execution/*` plus `scripts/`
- Labels: `expectedResearchLabel` — **not** ground-truth malice
- Runners:
  - `npm run scenarios` — deterministic baseline on closed corpus
  - `npm run risk-comparison` — freeze evidence + Jev vs deterministic

The classifier never sees scenario IDs, corpus type, or reference labels.
Closed corpus 15/15 for deterministic v1 is **not** independent generalization.
