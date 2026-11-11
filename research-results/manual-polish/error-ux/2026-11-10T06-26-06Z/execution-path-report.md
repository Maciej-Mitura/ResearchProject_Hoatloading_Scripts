# Execution path redesign result

COMPLETE

Implemented with the human-readable execution-error polish and the follow-up profile-info correction. The full error report is report.md; the per-stage contract is execution-path-stage-semantics.md.

# 1. Previous UX problem

Five independent rules and left dots looked like empty 0% progress bars. Repeated descriptions/provenance made each stage dense, while Result always saying Available obscured failed outcomes.

# 2. Stage semantics

| Stage | Existing source | Interpretation |
|---|---|---|
| Request | Local submission / stored execution ID | Sending before acceptance, observed Accepted afterward |
| Process | Coarse API status / stored result | Running inferred, returned/stopped result observed |
| Result | Stored provider result + API outcome | Pending/available or explicit Completed/Failed/Terminated; missing remains Not recorded |
| Evidence | auditCollection + historical fallback | Collection quality independently Complete/Partial/Unavailable/unknown |
| Assessment | Linked stored assessment | LOW/REVIEW/HIGH or failed/unavailable/missing; blocked path can be not applicable |

Full states, absence and provenance are documented in the semantics table. These dimensions can have different outcomes; there is no failure propagation.

# 3. New stepper design

One ordered horizontal node flow: Request -> Process -> Result -> Evidence -> Assessment. Each node shows a semantic symbol, stage name, status and small info icon. Detailed text is secondary. Narrow screens use the same component vertically. No progress-bar roles/tracks or invented percentage.

The follow-up profile request is also complete: all four option descriptions are inside the existing Execution profile info tooltip. No collapsible Profile guide remains; final desktop content fits its 356 px surface without scrolling.

# 4. State/icon system

✓ reached record/stage; × failed/blocked; ! terminated/partial; ↻ active; ? unavailable/unknown/not recorded; ○ pending/not applicable; ≈ inferred completed stage. Compact semantic colors supplement icon and text. A reached assessment node means the analyzer returned, not that the script is safe.

# 5. Provenance presentation

Observed/Inferred/Not recorded/Not applicable remain in the stage's reusable keyboard-focusable InfoTip with its supporting record description. Evidence may have an observed status record saying Unavailable. The global legend remains available; repeated provenance paragraphs no longer dominate the path.

# 6. Live execution mode

Same nodes during and after execution. Actual coarse API activity gets aria-current=step and a restrained pulse; elapsed time remains the running metric. Bounded run captured Running at 0.8 s with Inferred process provenance, then automatically completed at recorded 5,338 ms. No refresh/reselection required. No admission/container-start event was fabricated.

Actual host calls retain a separate secondary flow in Evidence, using the same node renderer. Profile alone never creates it; delivery remains inferred and successful correlated Paper acknowledgement observed.

# 7. Failed-execution example

Verified exact failure and same-source reproduction: ✓ Accepted -> ✓ Returned -> × Failed -> ✓ Complete -> ✓ LOW. Under none, host SDK import resolution failed at main.ts:1:22 with exit 1. LOW/R010 and complete audit are valid independent results. One human-readable diagnosis replaces duplicate raw error blocks; technical stderr remains normalized/copyable and raw evidence remains inspectable.

Paired same saved source under host-chat completed and Paper confirmed one broadcast. It had no false SDK-unavailable diagnosis.

# 8. Timeout example

Reopened existing controlled timeout: ✓ Accepted -> ✓ Stopped -> ! Terminated -> ? Unavailable -> ✓ HIGH. Duration 10,383 ms, configured 10 s deadline, unavailable audit reasons unchanged. Collection Unavailable is never marked with a completed green node; HIGH is an observed completed assessment, not a failed analyzer. Timeout card uses amber warning styling.

# 9. Successful example

New normal console execution: 542 ms, completed, complete collection, LOW; all five reached nodes. Compact checks, without large celebratory surfaces. A generic thrown error separately verified failed/complete/LOW and no host-profile suggestion.

# 10. Responsive/accessibility

Desktop horizontal; below 850 px vertical. Actual 820x1000 and 390x844 browser checks confirmed readable vertical nodes and no page-width overflow. Tooltips opened through keyboard focus and dismissed with Escape. Icons have accessible meanings, active state has aria-current, and reduced-motion CSS disables animation. Dark/light inspected. No formal assistive-technology certification claimed.

# 11. Tests

Frontend **107 passed / 0 failed / 0 skipped**, six files. Covers success, failed+complete+LOW, timeout+unavailable, active/inferred/unknown/not-applicable, completed process with failed assessment, tooltip and responsive structure, plus error UX and navigation regression. Typecheck, production build, local redeploy and diff whitespace check passed. API/contracts unchanged: no API test rerun. No Jev/gVisor rerun. Browser/results and validation-summary.json provide the live checks.

# 12. Files changed

15 frontend/package files, fully listed in changed-files.md. Shared lifecycle/error modules, detail/Insights integration, profile and assistant guidance, styles and focused tests; one narrow App stale-save selection guard discovered in smoke. No backend, runtime authority, classifier or collection logic changes. No commit/push.

# 13. Frozen research integrity

All **1,363 pre-existing research files match the pre-edit inventory**, none missing. Seven prior result seals plus the Phase 3 manifest verify 978 entries. Prior execution-UX and assistant-restoration evidence remain untouched.

# 14. Recommendation

Review screenshot 02 for the desktop failure hierarchy, screenshot 01 for consolidated profile help, and screenshots 08/09 for narrow behavior. Existing Gemini history, CRUD/versioning, Insights, Host Activity, Settings and Help remain usable; settings are unchanged. Review tab is left on the paired failure. Do NOT start Phase 8.

READY FOR MANUAL REVIEW
