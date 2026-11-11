# Phase 7 result

COMPLETE WITH LIMITATIONS

# Executive summary

- Exact counts/medians were verified from saved artifacts; no experiment, model, classifier or runtime was rerun.
- Scoped Deno authority, selected lifecycle bounds and narrow Host Gateway authorization have the strongest controlled empirical support.
- Observation remains incomplete: caught activity can persist, but HOL-008 has no trusted subprocess observation and both classifiers miss its REVIEW reference.
- Deterministic agreement15/15 development,9/10 holdout,24/25 combined; Jev modal16/25, individual84/125,23/25 unanimous,121/125 matching own mode, zero Jev-only modal recovery.
- Runsc genuinely ran100 measured jobs;9/10 workload designs compatible, W8 DNS fails0/5 success versus runc5/5 Paper confirmation; comparable non-timeout median ratios about1.62–2.61x.
- OTel added reconstructed trace/span/event export and correlation, not enforcement, durable trace storage, exhaustive detection or a full independent Paper trace.
- All25 frozen classifier records are JavaScript; a separate typed TypeScript workload is narrower direct evidence for the question's language framing.
- No current official subquestions were found; analytical themes are explicitly distinguished from formal questions.
- Verdict: SUPPORTED WITH IMPORTANT LIMITATIONS for the bounded PoC, not generalized arbitrary TypeScript security or measured incremental Jev/gVisor security benefit.
- All 1442 pre-existing snapshot files and759 original manifest comparisons match; no prior source/docs/results changed, no commit/push or Phase 8 work.

# 1. Verified evidence base

Exact packages: `research-results/phase1/`; `research-results/phase1b/`; `research-results/phase2/`; `research-results/phase3-jev/resume-after-credit-2026-11-09/`; `research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched/`; `research-results/phase5-final-validation/2026-11-09T15-24-05Z/`; `research-results/phase6-cleanup/2026-11-09T16-10-39Z/`; frozen `research-results/risk-comparison/frozen-evidence-v1/` and scenario/holdout/sensitivity manifests under `fixtures/scenarios/`. Current `docs/RESEARCH-STATUS.md`, architecture/boundaries docs and the supplied Dutch question were checked. Phase 5's33-claim matrix is authoritative for classifications. `source-register.json`/`.md` maps32 claim/source groups; `analysis-source-hashes.json` records318 concrete artifact hashes. Official gVisor architectural reference is separate from project empirical evidence.

# 2. Key empirical findings

| Area | Verified result / denominator |
|---|---|
| Deterministic |25 cases; development15/15, holdout9/10, combined24/25; sole mismatch HOL-008 |
| Jev primary |25×5=125 technically valid classifications;23/25 unanimous;121/125 match own case mode |
| Jev reference agreement |84/125 individual;16/25 modal; both match16; deterministic only8; Jev only0; neither1 |
| Jev variability / sensitivity |SCN-010 and SCN-013 split3:2;15 sensitivity calls on5 selected cases×3 presentations;4/5 retain class across presentations |
| Provider accounting |3 successful smoke+125 primary+15 sensitivity=143 successes; one earlier403;144 total attempts;0 automatic retries |
| Runtime comparison |10 workloads×2 runtimes×5=100 measured, all trusted-runtime-attributed;9/10 compatible;85 completed,10 expected timeouts,5 failed DNS tasks |
| W8 |runc5/5 Paper-confirmed; runsc0/5; no successful comparable runsc overhead ratio |
| CPU / I/O |W9 median521→844ms,1.619962x; W10 median592→1548ms,2.614865x; supervisor/end-to-end, not pure script time |
| Integrated validation |E1–E8 PASS under normal runc; Paper effect, capacity2/overflow429/recovery, collector outage independence and3 fresh-data cases passed |

Phase 5:217 passed/0 failed; Phase 6 relevant suites:190 passed/0 failed. Each preserves one locally guarded DB skip separately passed deployed. These overlapping regression totals are not independent research samples; no tests rerun in Phase 7.

No expected numerical discrepancy was found. Important scope clarifications: historical Phase2 behavioral OS/OOM probes are narrower supplementary observations; final Phase 5 Docker classes remain CONFIGURATION VERIFIED. Classifier corpus language is25 JavaScript records, not25 dedicated TypeScript cases. See `verified-key-results.json`/`.md`.

# 3. Detection analysis

Native permission observations and supervisor outcomes reveal selected security-relevant operations; successful execution can contain caught restricted activity. Complete/partial/unavailable/legacy_unknown constrain interpretation. W6/W7 audit loss and W10's capped200 observations illustrate collection limits. HOL-008 shows that enforcement may occur without a corresponding trusted audit observation. PostgreSQL stores supplied evidence rather than detecting behavior; OTel exports reconstructed relationships rather than closing sensor gaps. Risk agreement measures interpretation of a small controlled corpus, not detection of arbitrary malicious scripts. See `detection-analysis.md` (S07–S09,S15,S18,S22).

# 4. Isolation analysis

Deno constrains runtime authority; Docker supplies a separate configured process/filesystem/network/resource context. Fresh-job behavior and selected timeout/output controls were demonstrated, while final non-root/read-only/memory/PID/privilege claims retain their Phase 5 configuration classes. Historical controlled probes are reported separately. runc shares the host kernel. Runsc's application-kernel mediation is an architectural boundary described in the [official gVisor guide](https://gvisor.dev/docs/architecture_guide/intro/), not measured escape resistance here. Runtime attribution and compatibility do not prove exploit prevention. See `isolation-analysis.md`.

# 5. Risk-limitation analysis

Known profiles and execution-scoped host capabilities limit granted effects. Runner-local admission, wall deadline, bounded output and cleanup constrain tested abuse. CPU/PID/privilege presence is not an exhaustive pressure/escalation assessment. Cleanup uncertainty can fail closed and require intervention; the stored unit seam asserts the shared blocked flag, not the separate local artifact counter. No global/distributed DoS protection or durable crash recovery is inferred. Neither classifier changes authority. See `risk-limitation-analysis.md` (S03–S06,S19–S21).

# 6. Defense-in-depth contribution

The combined contribution is functional separation: Deno's transport permission is checked again by capability authorization; Docker and runner bounds do not depend on classifier output; collection uncertainty can coexist with enforced denial; telemetry export can fail without weakening tested restrictions. Restricted-read, confirmed-broadcast, collector-outage and injected-analysis examples support specific interactions. There is no full factorial layer-removal experiment or measured overall risk-reduction percentage. Shared trusted runner/engine/API/gateway/DB/plugin dependencies remain. `defense-in-depth-analysis.md` includes the nine-layer single-failure/counterfactual matrix and labels inferences separately from measured failures.

# 7. Deterministic vs Jev conclusion

Jev was technically usable after the account gate and mostly repeatable, but did not improve modal reference agreement:16/25 versus24/25, zero Jev-only modal matches. Both missed HOL-008. The second interpretation/confidence distribution may be information for review, but reviewer utility, calibration and ensemble benefit were not measured. Two3:2 splits and one selected sensitivity class difference show variability, not its proven causal mechanism. Local reason strings are not model rationale. The finding concerns one model/policy/representation/provider and corpus; it does not establish general AI inferiority. See `jev-analysis.md` (S08–S12).

# 8. gVisor conclusion

Runsc is viable for most selected workloads and adds a meaningful boundary by design, with measured operational costs. It is not a transparent default for this unchanged host-chat topology: W8 DNS fails before gateway authorization, whereas runc confirms Paper5/5. The separate different-image direct-IP health diagnostic supports a DNS mechanism but is not recovered Host SDK/Paper success. About1.62–2.61x ratios apply only to comparable non-timeout workload supervisor durations in this WSL2 setup. W6 measures the same wall timeout; W8 has no successful-task ratio. No escape prevention or percentage security improvement is demonstrated. See `gvisor-analysis.md` (S13–S17,S31–S32).

# 9. OpenTelemetry conclusion

Actual collector receipt establishes an export/correlation view beyond database rows: execution/sandbox.run, host/advisory events and counters in a standard telemetry representation. Operational investigation benefit is plausible but not measured as time saved or better detection. DB remains durable project evidence; custom reconstruction, debug sink and late Paper acknowledgement limit completeness. One outage shows collector availability separated from tested enforcement, not whole-system resilience, guaranteed replay or zero delay. See `otel-analysis.md` (S22–S23).

# 10. Host Gateway conclusion

Network reachability is not application authority. The gateway checks execution session/capability/input/budget before authenticated internal enqueue and trusted DB mapping. Real host success and rejected admin/direct/forged-mapping paths demonstrate that separation. Paper confirmation is separate from queue acceptance; delivery is inferred through the guarded trusted transition. One implemented broadcast capability demonstrates a boundary pattern, not a general host scripting/event ecosystem, exactly-once delivery or global anti-spam system. See `host-gateway-analysis.md` (S19–S20).

# 11. Subquestion answers

No current official subquestions were located in the repository search. This is a documentation/analytical-mapping limitation, not permission to invent formal questions or answer obsolete milestone plans. `research-question-search.json` records scope/zero hits; `subquestion-analysis.md` gives answers/evidence/limits/main-question relation for six explicitly analytical themes: dynamic-execution risks; permission/container isolation; limited host API; observability/evidence; advisory analysis; gVisor trade-offs. Mapping to an external thesis proposal cannot be asserted without that document.

# 12. Risk coverage

The14-row `risk-coverage-matrix.json`/`.md` separates MITIGATED IN TESTED SCENARIO, PARTIALLY MITIGATED, CONFIGURATION-LEVEL MITIGATION, OBSERVED ONLY and NOT DEMONSTRATED. Scoped reads/env/network, forged correlation, bounded output and local overflow have concrete tested outcomes. Host nuisance/resource/system abuse remain partially bounded; memory's final claim stays configuration-level with historical OOM subevidence separate. Telemetry uncertainty is observed, not solved. Escape resistance, broad TypeScript classifier effectiveness and DB/API outage assurance are not established.

# 13. Limitations

Small researcher-designed JavaScript evidence corpus and related holdouts; limited typed-runtime task; native audit blind spots; partly configuration-only Docker claims; one WSL2/runsc release/systrap/host/workload set; one Jev provider/model/policy/window, no free-text rationale or calibrated confidence; non-durable custom OTel/no full Paper spans; one host capability; trusted privileged components/single runner/no HA; working-tree/cached-download reproduction; manual visual acceptance unavailable; no formal current subquestions; no full defense ablation or population risk estimate. Phase 6 logging provenance limitation remains disclosed. See `limitation-analysis.md`.

# 14. Validity threats

Internal: timing/instrumentation/background/cache/WSL effects and non-isolated lifecycle costs. Construct: researcher labels versus ground truth, agreement versus accuracy, repeatability versus correctness, process completion versus expected semantics, configured controls versus exploit resistance. External: small related cases, one host/capability/version/runtime/provider and JavaScript-language classifier inputs. Reliability: frozen identities/hashes, visible failures and repeats strengthen auditability but are not signed independent attestation or published-HEAD reproducibility. `validity-threats.md` separates these categories. No inferential p-values/confidence intervals were introduced.

# 15. Main research question answer


## Detecteren

De architectuur maakt vooraf bepaalde securityrelevante handelingen zichtbaar
wanneer de runtime daarvoor betrouwbare observaties levert. In de gecontroleerde
tests bleven onder meer beperkte bestands- en omgevingsaanvragen zichtbaar, ook
wanneer een script een fout opving en daarna succesvol eindigde. PostgreSQL bewaart
de projectgegevens en correlatie; OpenTelemetry voegt een trace-/spanweergave en
collector-export toe. Geen van beide is op zichzelf een detectie-engine.

Die zichtbaarheid is onvolledig. Time-outs, uitvoertruncatie en auditlimieten
verminderen de beschikbare gegevens. HOL-008 toont bovendien een opgevangen
subprocespoging zonder overeenkomstige vertrouwde permission-observatie. Beide
classifiers geven daarvoor LOW tegenover het onderzoekerslabel REVIEW. Een complete
collectie betekent daarom niet dat alle handelingen zijn waargenomen.

De deterministische baseline stemt op 24 van 25 gecontroleerde gevallen overeen
met de onderzoekerslabels; Jev's modale klasse op 16 van 25. Jev was op 23 gevallen
unaniem over vijf herhalingen, maar bood geen modaal geval waarin alleen Jev het
referentielabel herstelde. Binnen deze gegevensrepresentatie is dus geen aanvullende
modale overeenstemmingswinst aangetoond. Dit zijn geen percentages voor detectie
van willekeurige kwaadaardige scripts. Alle 25 classifierrecords zijn als JavaScript
geregistreerd; een afzonderlijke beperkte TypeScript-workload bevestigt uitvoering,
niet een zelfstandige brede TypeScript-classificatiestudie. [S07–S09,S15,S18,S22]

## Isoleren

Deno beperkte de runtimebevoegdheden binnen de geteste profielen. Docker voegde
een afzonderlijke container-, proces- en bestandssysteemcontext en ingestelde
resourcegrenzen toe. De aanwezigheid van onder meer non-root, read-only root,
geheugen-/PID-limieten en privilege-instellingen is volgens de leidende Phase 5-
matrix configuratiegeverifieerd; specifieke historische gedragsproeven worden
afzonderlijk vermeld. Dit is geen algemene toets van exploitbestendigheid.

gVisor voegt door zijn ontwerp een extra application-kernelgrens toe. De proef
toont echte runsc-uitvoering en compatibiliteit voor 9 van 10 workloads, met
meetbare operationele kosten. Zij toont geen escape-preventie of verhoogde
weerstand tegen kernel-exploits. De host-chatworkload faalde onder runsc door
naamresolutie; de volledige normale hostketen is onder runc bevestigd. Alle in
de onderzoeksvraag genoemde lagen zijn dus niet als één transparant geheel voor
ieder scenario gevalideerd. [S04,S13–S18,S31,S32]

## Beperken

Het sterkste empirische resultaat ligt in het begrenzen van concrete bevoegdheden,
hosteffecten en geselecteerd resourcegedrag. De Host Gateway scheidt netwerktoegang
van applicatieautorisatie: alleen een geldige uitvoeringsgebonden sessie kan de
smalle chat.broadcast-capability aanvragen. Admin- en directe omwegen en vervalste
correlatie werden afgewezen; een geautoriseerde aanvraag werd door Paper bevestigd.
De runner beperkte gelijktijdige uitvoering tot twee jobs, wees overloop af en
herstelde capaciteit. Time-out, begrensde uitvoer en cleanup beperkten de geteste
resourcegevallen. Dit is lokale beheersing, geen algemene DoS-bescherming.

Risicoanalyse verleent of ontneemt daarbij geen bevoegdheden. Bij een geteste
collectoruitval bleven beperkingen en hostautorisatie werken; een geïnjecteerde
analysefout kon naast succesvolle uitvoering bestaan. Die scheiding beperkt de
afhankelijkheid van advies en observability, maar bewijst geen herstelgarantie
voor een uitgevallen API of database. [S03,S06,S19–S23]

## Overkoepelend antwoord

De resultaten ondersteunen defense-in-depth voor gecontroleerde, beperkte
scriptuitvoering: verschillende lagen bewaken verschillende grenzen en koppelen
bruikbare observaties aan de uitvoering. De onderbouwing is het sterkst voor
gescopeerde bevoegdheden, de capabilitygrens en geselecteerde lifecyclecontroles.
Zij is beperkter voor volledige gedragsdetectie, de aanvullende classificatiewaarde
van Jev en de security-effectiviteit van kernelisolatie. Zonder volledige
laagverwijderingsproeven of representatieve aanvalspopulatie kan geen percentage
risicoreductie tegenover één enkele laag worden vastgesteld. Het oordeel geldt
voor de geteste PoC en expliciete grenzen, niet voor veilige willekeurige
TypeScript-uitvoering in productie. [S01–S32]


# 16. Research-question verdict

SUPPORTED WITH IMPORTANT LIMITATIONS

This refers to the bounded PoC's demonstrated scoped authority/effect/resource limitation and useful correlated available evidence. It does not assert exhaustive detection, incremental Jev security benefit, proven gVisor escape effectiveness, successful transparent runsc host-chat operation, broad TypeScript security or a quantified gain over one layer. Overall research judgment: MODERATE confidence; a qualitative synthesis, not Jev confidence.

# 17. Final conclusion draft


Dit onderzoek laat zien dat een defense-in-deptharchitectuur de bevoegdheden en
geselecteerde effecten van dynamisch uitgevoerde, onbetrouwbare scripts binnen een
gecontroleerde PoC kan begrenzen en daarbij bruikbare, maar onvolledige observaties
kan vastleggen. De sterkste bijdrage ligt in de combinatie van gescopeerde Deno-
permissies, Docker-uitvoeringsgrenzen, lokale lifecyclecontroles en een afzonderlijke
Host Gateway. Netwerktoegang verleende niet automatisch applicatiebevoegdheid;
geautoriseerde chatbroadcasts bereikten een door Paper bevestigde hostwerking,
terwijl geteste admin-, directe en correlatieomwegen werden afgewezen.

De detectiecomponent kent duidelijke grenzen. De deterministische baseline kwam
op 24 van 25 gecontroleerde gevallen overeen met de onderzoekerslabels. Jev bereikte
modaal 16 van 25, was op 23 gevallen unaniem en herstelde geen enkel modaal geval dat
de baseline miste. Beide misten HOL-008, waarin een vertrouwde observatie ontbrak.
Deze uitkomst ondersteunt geen algemene uitspraak over AI-risicoanalyse: zij geldt
voor één model, beleid, representatie en kleine, als JavaScript geregistreerde
casusverzameling. De TypeScript-uitvoering is slechts afzonderlijk en beperkt
gedemonstreerd.

gVisor werkte voor 9 van 10 workloads, maar introduceerde in de WSL2-opstelling
workloadspecifieke supervisor-duurratio's van ongeveer 1,62 tot 2,61 voor vergelijkbare
niet-time-outtaken. De host-chatworkload faalde door DNS-compatibiliteit. De proef
onderbouwt runtime-integratie en operationele afwegingen, geen escape-preventie.
OpenTelemetry maakte gecorreleerde uitvoering zichtbaar in spans en events, terwijl
PostgreSQL de duurzame projectregistratie bleef. De debugexporter en ontbrekende
volledige Paper-span beperken de observabilitybijdrage; de geteste collectoruitval
verzwakte de bestaande beperkingen niet.

De onderzoeksvraag wordt daarmee ondersteund met belangrijke beperkingen:
gescopeerde bevoegdheden en effecten zijn overtuigender onderbouwd dan uitputtende
detectie of extra kernelbeveiliging. De kleine gerelateerde casusset, één host en
runtimeconfiguratie, deels alleen geïnspecteerde controles en ontbrekende exploit-
en crashproeven begrenzen de generaliseerbaarheid. Vervolgonderzoek kan zich richten
op rijkere vertrouwde observaties, onafhankelijkere casussen en de geconstateerde
netwerk-/tracebeperkingen. Dat vervolg is niet uitgevoerd en vormt geen voorwaarde
om de huidige negatieve en positieve bevindingen te rapporteren.


# 18. Practical engineering recommendations

ESSENTIAL: deny-by-default trusted profiles, fresh execution environments, hard lifecycle/output/admission bounds, narrow host authorization separate from transport/admin, trusted correlation, explicit collection uncertainty and advisory separation. USEFUL: transparent deterministic comparator, durable project evidence plus best-effort standard telemetry, frozen provenance/failures. OPTIONAL / CONTEXT-DEPENDENT: runsc after topology/cost validation; model-based advice only when independently justified. Not a universal production reference architecture. Details: `practical-recommendations.md`.

# 19. Future work

Priorities derived from observed limits: trusted instrumentation; independent TypeScript/corpus coverage and explicit official questions; new equally controlled DNS-compatible runtime topology study; durable trace backend/bridge spans; native-Linux/larger workload generalization; narrowly justified extra capability; durable crash/finalization/tamper-evidence evaluation. No exploit campaign, arbitrary malware execution, IDS build or unrelated platform redesign. None is performed here. See `future-work.md`.

# 20. Evidence-to-conclusion traceability

`evidence-to-conclusion-matrix.json`/`.md` maps18 conclusions to32 source groups, original Phase 5 classes/claim IDs, explicit limitations and qualitative research-confidence labels. HIGH for a narrow observed count/configuration presence or an explicit evidence gap does not upgrade a NOT DEMONSTRATED positive security claim. MODERATE applies to broader interpretive/operational trade-offs. Results/interpretations/non-conclusions are separated throughout and in `results-interpretation-nonconclusions.md`. Fourteen self-critique checks include correct layer attribution, label/corpus/timing limits, negative findings, TypeScript framing and joint-stack limitations.

# 21. Files created

Only the new repository-relative directory `research-results/phase7-analysis/2026-11-09T18-02-24Z/`. `files-created.json` lists every file; required source/results/layer/risk/traceability pairs, component analyses, official-question search, Dutch answer/conclusion, validity/self-critique, recommendations/future work, verification helpers and integrity/seal artifacts are included. No implementation or existing project documentation was edited.

# 22. Research integrity

PASS: 1442 pre-existing source/docs/research files matched with0 changed/missing;759 original Phase3/4/5/6 manifest comparisons match. Git status outside this new directory is unchanged. No code/migration/UI/existing-doc edits, experiment/classifier/model/runtime/test reruns, label/policy/rule/result retuning or commits/pushes. Offline saved-data verification is analytical work, not a new experiment. No Phase 8 packaging started. Exact scope/exclusions are in `research-integrity.json`.

# 23. Remaining analytical limitations

The verdict is bounded by small related JavaScript cases, limited direct TypeScript evidence, missing official subquestions and incomplete sensing/causal security-effectiveness measurements. It cannot fill these gaps with positive assumptions or manufacturer claims. Manual acceptance and source publication remain unavailable/pending. These are disclosed limits; no remaining scoped technical experiment is invented as a prerequisite for reporting the existing findings.

# 24. Recommendation

The analytical phase is complete with limitations and ready for separately authorized source/evidence packaging. Do not reinterpret negative results or retroactively alter frozen data. Stop after this report; Phase 8 has not begun.

READY FOR PHASE 8
