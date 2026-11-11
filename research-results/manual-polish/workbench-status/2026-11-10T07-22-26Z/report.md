# Runlattice: Workbench, history navigation and branding

Implemented and deployed locally. No Phase 8, backend/security/classifier change, commit or push.

## Workbench

Full execution evidence moved out of Workbench. A compact Execution status card shows immediate submission/running/finalizing activity, a real elapsed timer and requested profile. Terminal runs show a short outcome and View in Execution Insights button. The link intentionally opens the same selected execution; no automatic redirect or extra run is triggered. Full output, evidence, timeline, runtime and diagnostics remain in Insights. Read/loading failures are distinguished from script failure. Running copy explicitly says output will be available in Execution Insights.

## History-first Insights

Ordinary navigation starts with history and filters, even if App already knows the latest execution. No statistics or full detail panel appears until a history row is opened. The explicit Workbench result link counts as an intentional selection and opens that run directly. Selected details receive keyboard focus and scroll into view. Close run details returns to the history-only state.

Filters: All loaded runs / Most recent run, all/7/30-day dates, provider. Sort: newest, oldest, longest duration, shortest duration. Missing durations stay last. Most recent means the newest recorded run for the selected script BEFORE the other filters; it never substitutes an older matching run. History has a bounded scroll area and sticky headers. The existing API loaded-window bound remains unchanged and is advertised in the UI.

Statistics for this run is a disclosure using only the opened record's duration, outcome, profile, advisory class/status, collection state and provider. Full evidence describes that same run. The previous automatic aggregate charts/data dump was removed from the entry view. Filters do not silently aggregate other runs into the selected statistics; a filtered-out selection is hidden. Switching scripts clears the opened pane. Obsolete history responses are ignored.

## Branding

Name and browser tab title: **Runlattice**. Header uses a new original SVG mark depicting a runnable script/play shape and connected evidence nodes. Reusable asset: apps/web/public/runlattice-mark.svg. Matching favicon: apps/web/public/favicon.svg. Both are scalable 64x64-viewBox vectors; no personal name or author-specific branding. They work offline as local static assets. Browser title/link and successful logo loading were verified.

## Validation

Frontend: **116 passed, 0 failed, 0 skipped**, eight files. Typecheck and production web build/deploy passed. API/provider contracts unchanged; their suites and Jev/gVisor experiments were not rerun.

Live: bounded console script showed running/elapsed feedback and automatically completed. Workbench contained no full execution-evidence heading/tabs. Direct navigation opened execution e0e1985b-0aea-45a1-afad-b5a5e537843a, independently matched to the local API, with duration 4,705 ms. Generic failed execution showed a concise failure and result link without raw stderr. Ordinary Insights navigation showed three rows and zero detail panels; oldest/newest sorts reversed the dates correctly. Latest filter showed exactly one row, with no details until click. Its statistics used that single 4,705 ms record. Closing hid the pane. Logo loaded, document title Runlattice and favicon href /favicon.svg were verified. Final browser console errors: none.

Phone 390 px: history and Workbench document widths 375 px; no page-width overflow. Temporary viewport restored. Light/dark toggles checked and dark restored. Review tab left on latest-only history, without an open detail panel. Screenshots 01 running, 02 completed, 03 branded latest history, 04 selected statistics, 05/06 phone, 07 failure, 08 light mode.

## Scope and integrity

13 web files changed/added, listed below. All **1,438 pre-existing research files remained byte-identical**; no missing prior artifacts. Earlier manual-polish evidence is untouched. Code, tests, assets and inventory are identified in scope-and-integrity.json. Two bounded live console runs were performed; no AI model request was made.

- `apps/web/index.html`
- `apps/web/src/App.tsx`
- `apps/web/src/insights.test.tsx`
- `apps/web/src/workbench.test.tsx`
- `apps/web/src/components/ExecutionFeedback.tsx`
- `apps/web/src/components/ExecutionInsights.tsx`
- `apps/web/src/components/HelpPanel.tsx`
- `apps/web/src/styles/app.css`
- `apps/web/public/favicon.svg`
- `apps/web/public/runlattice-mark.svg`
- `apps/web/src/history-navigation.test.tsx`
- `apps/web/src/workbench-status.test.tsx`
- `apps/web/src/components/WorkbenchExecution.tsx`

Ready for manual review.
