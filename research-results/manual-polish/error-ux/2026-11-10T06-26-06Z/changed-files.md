# Changed files

Relative to before-fingerprints.json at task start (not Git HEAD, which already contains roadmap work):

- `apps/web/package-lock.json`
- `apps/web/package.json`
- `apps/web/src/App.tsx`
- `apps/web/src/execution-ux.test.tsx`
- `apps/web/src/execution-ux.ts`
- `apps/web/src/timeline.ts`
- `apps/web/src/workbench.test.tsx`
- `apps/web/src/components/ChatPanel.tsx`
- `apps/web/src/components/ExecutionDetail.tsx`
- `apps/web/src/components/ExecutionFeedback.tsx`
- `apps/web/src/components/ScriptEditor.tsx`
- `apps/web/src/styles/app.css`
- `apps/web/src/error-ux.test.tsx`
- `apps/web/src/execution-errors.ts`
- `apps/web/src/components/ExecutionError.tsx`

15 frontend/package files. The direct dependency is the already installed ansi-regex version, pinned at 5.0.1. New modules centralize normalization/error presentation and tests. Existing execution detail, feedback, timeline, editor, assistant, styles and presentation helpers integrate the changes. App.savedVersion and its regression add only the narrow stale-selection guard found in the wider smoke. No API/provider/runner/gateway/contracts/security/classifier/config/Compose source was changed. All other additions are scoped manual-polish evidence in this directory. No commit/push.
