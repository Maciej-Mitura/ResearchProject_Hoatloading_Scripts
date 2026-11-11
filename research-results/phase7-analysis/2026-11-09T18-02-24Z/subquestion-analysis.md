# Current official subquestions

**Documentation issue:** no clearly defined current official subquestions were located. `research-question-search.json` records the repository search scope and zero hits. The exact main question comes from the Phase 7 user directive. Archived implementation milestones are not treated as formal questions. No question list is silently invented.

The following are **analytical themes, not official subquestions**. Each connects a distinct contribution to detecteren/isoleren/beperken in the supplied main question.

| Analytical theme | Answer | Evidence | Limitation | Main-question relation |
|---|---|---|---|---|
| Dynamic untrusted execution risks | Runtime authority, unintended host effects, resource growth and evidence gaps are different risks; the tested architecture covers specific examples, not arbitrary malicious intent. | S03,S07,S18,S20 | Researcher-designed safe probes; no representative threat prevalence. | Distinguishes observation, isolation and effect/resource limitation rather than treating every layer as enforcement. |
| Permissions and container isolation | Scoped Deno restrictions work in tested profiles; Docker controls supply a separate configured boundary and bounded lifecycle. | S02,S04,S05,S18 | Final configuration claims are not escape proof; no full ablation. | Distinguishes observation, isolation and effect/resource limitation rather than treating every layer as enforcement. |
| Limited host API | Network reachability does not confer host authority; one scoped broadcast reaches trusted Paper confirmation while bypass/admin/forgery probes reject. | S19,S20 | One capability, trusted control plane, not a general scripting API. | Distinguishes observation, isolation and effect/resource limitation rather than treating every layer as enforcement. |
| Observability/evidence | DB preserves correlation, OTel exports reconstructed spans; collection uncertainty and HOL-008 limit detection. | S07,S22,S23 | Non-durable debug sink, incomplete Paper spans, no IDS. | Distinguishes observation, isolation and effect/resource limitation rather than treating every layer as enforcement. |
| Advisory risk analysis | Deterministic24/25 versus Jev modal16/25; no Jev-only modal match and both miss HOL-008. | S08,S09,S12 | One small JS evidence corpus; agreement is not maliciousness accuracy. | Distinguishes observation, isolation and effect/resource limitation rather than treating every layer as enforcement. |
| gVisor trade-offs | Real runsc works for9/10 workloads with extra boundary by design, workload-specific costs and W8 DNS incompatibility. | S13–S17,S31,S32 | No security-effectiveness measurement; WSL2/systrap-only timings. | Distinguishes observation, isolation and effect/resource limitation rather than treating every layer as enforcement. |

This absence does not invalidate the artifact-based analysis, but mapping to an externally approved thesis proposal cannot be asserted without that document.
