# Research limitations

1. **Corpus and language:** 25 researcher-designed classifier cases, 15 known
   development and 10 related holdout variants, not independently sampled attacks.
   All frozen classifier records are language=javascript. W2 demonstrates a small
   typed TypeScript task; it does not validate arbitrary TypeScript workloads or
   language-specific classification quality. Evidence is structured post-execution
   behavior, not source-code maliciousness analysis.
2. **Deno telemetry:** incomplete native observation, access/check rather than
   outcome bits, truncation/missing frames and HOL-008 blind spot. legacy_unknown
   remains for historical collection. Complete collection is not exhaustive coverage.
3. **Docker:** selected behavior probes and configuration inspection, no general
   exploitation assessment. runc shares the kernel. Preserve Phase 5 control classes;
   separate the narrower Phase 2 OS/OOM observations.
4. **gVisor:** one WSL2 host, one runsc release/platform (systrap), ten workloads,
   five repetitions per group, startup/lifecycle/audit cost in duration. Common host
   activity/cache and instrumentation influence timings. W8 DNS incompatible; no
   escape/exploit testing or quantified security gain.
5. **Jev:** one pinned model/provider/policy/transformation, small short-window
   corpus, five repeats, selected sensitivity cases. Confidence uncalibrated; Choice
   returns no free-text rationale. Local reason strings cannot establish model
   reasoning. Missing observations and reference-label subjectivity remain shared.
6. **OTel:** custom reconstructed tracing, non-durable debug exporter, no complete
   independent Paper span chain, no guaranteed telemetry delivery/replay or IDS.
7. **Host Gateway:** one meaningful sandbox capability, chat.broadcast. The pattern
   is demonstrated, not a general capability ecosystem or persistent event API.
8. **Reliability/trust:** one runner, in-memory sessions, privileged Docker access,
   trusted services/DB/plugin. PostgreSQL/API crash may prevent durable finalization;
   no high availability/distributed admission/independent tamper-proof forensics.
9. **Reproducibility:** fresh-data current-working-tree validation with caches and
   downloads, not published-HEAD/offline/no-cache reproduction. Source identity and
   public artifact availability remain Phase 8 work. No official current subquestions
   were found. Manual visual acceptance unavailable. Phase 6 log overwrite issue is
   disclosed; final reruns exist and frozen earlier experiments were unaffected.
10. **Causal interpretation:** no full factorial ablation of all defenses, no
    representative attack population and no measured amount of overall risk
    reduction. Collector outage and advisory injection test particular independence
    paths, not every single-layer failure. Descriptive conclusions do not supply
    inferential significance, confidence intervals or universal effectiveness.

These limits bound the answer; they are not concealed by code/doc changes or new
measurements. Future work is separate and not executed in this phase.
