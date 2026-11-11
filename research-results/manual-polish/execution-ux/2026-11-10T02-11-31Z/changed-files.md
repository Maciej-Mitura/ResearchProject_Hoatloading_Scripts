# Changed files

Comparison is to before-fingerprints.json captured at the start of this manual polish, not to Git HEAD (the workspace already contained earlier roadmap changes).

- `apps/web/src/App.tsx`
- `apps/web/src/insights.test.tsx`
- `apps/web/src/insights.ts`
- `apps/web/src/timeline.ts`
- `apps/web/src/types.ts`
- `apps/web/src/workbench.test.tsx`
- `apps/web/src/api/client.ts`
- `apps/web/src/components/ExecutionDetail.tsx`
- `apps/web/src/components/ExecutionInsights.tsx`
- `apps/web/src/components/HelpPanel.tsx`
- `apps/web/src/components/ScriptEditor.tsx`
- `apps/web/src/styles/app.css`
- `apps/api/src/routes/executions.ts`
- `apps/web/src/execution-ux.test.tsx`
- `apps/web/src/execution-ux.ts`
- `apps/web/src/host-evidence.ts`
- `apps/web/src/useExecutionMonitor.ts`
- `apps/web/src/components/ExecutionFeedback.tsx`
- `apps/web/src/components/InfoTip.tsx`

19 source files: 18 frontend, one API read-only response projection. New frontend modules cover shared presentation mapping, host aggregation, execution monitoring, tooltips, feedback and focused tests. Existing workbench/Insights/detail/editor/Help/styles/client/types/timeline and regression assertions integrate them. The API returns an existing queried array; SQL is unchanged. No dependency, frozen classifier, execution grant, runner, gateway, Compose, assistant-provider or credential configuration was changed by this task. All additional evidence is under this timestamped directory. No commit or push.
