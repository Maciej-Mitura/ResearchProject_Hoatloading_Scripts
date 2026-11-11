import { editSource, sourceValue } from "./editor-test-utils";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  assessmentLabel,
  evidenceStatus,
  hostCapabilityChain,
  permissionObservations,
  summarizeHistory,
} from "./insights";
import { ExecutionDetail } from "./components/ExecutionDetail";
import { ExecutionInsights } from "./components/ExecutionInsights";
import { ProjectSettingsPanel } from "./components/ProjectSettingsPanel";
import { ScriptEditor } from "./components/ScriptEditor";
import { api } from "./api/client";
import type {
  Execution,
  ExecutionHistoryItem,
  ProjectSettingsResponse,
  Script,
  ScriptVersion,
  SecurityEvent,
} from "./types";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
const at = "2026-11-09T10:00:00Z";
const execution: Execution = {
  id: "x",
  scriptId: "s",
  scriptVersionId: "v",
  status: "completed",
  riskAssessmentId: null,
  errorMessage: null,
  result: null,
  startedAt: null,
  finishedAt: null,
  createdAt: at,
  updatedAt: at,
};
const result: NonNullable<Execution["result"]> = {
  provider: "docker",
  exitCode: 0,
  stdout: "actual output",
  stderr: "",
  durationMs: 12,
  timedOut: false,
  outputTruncated: false,
};
const row: ExecutionHistoryItem = {
  id: "x",
  scriptId: "s",
  scriptVersionId: "v",
  status: "completed",
  createdAt: at,
  durationMs: 12,
  provider: "docker",
  runtime: "runc",
  profile: "none",
  auditStatus: "complete",
  assessmentId: "r",
  classification: "low",
  assessmentStatus: "ok",
};
const script: Script = {
  id: "s",
  name: "Example",
  language: "javascript",
  description: null,
  status: "draft",
  currentVersionId: "v",
  createdAt: at,
  updatedAt: at,
};
const version: ScriptVersion = {
  id: "v",
  scriptId: "s",
  versionNumber: 1,
  language: "javascript",
  source: "console.log(1)",
  changelog: null,
  createdAt: at,
};
const event = (
  eventType: string,
  metadata: Record<string, unknown> = {},
): SecurityEvent => ({
  id: eventType,
  executionId: "x",
  eventType,
  severity: "info",
  message: eventType,
  metadata,
  createdAt: at,
});
it("keeps empty history empty and missing duration null", () => {
  const s = summarizeHistory([]);
  expect(s.count).toBe(0);
  expect(s.median).toBeNull();
  expect(s.durations).toEqual([]);
});
it("aggregates actual mixed outcomes and finite measured durations only", () => {
  const s = summarizeHistory([
    row,
    { ...row, id: "2", status: "failed", durationMs: null },
    {
      ...row,
      id: "3",
      status: "terminated",
      durationMs: 20,
      auditStatus: "partial",
    },
  ]);
  expect(s.median).toBe(16);
  expect(s.completed).toBe(1);
  expect(s.complete).toBe(2);
  expect(s.outcomes.map((x) => x.name)).toEqual([
    "completed",
    "failed",
    "terminated",
  ]);
  expect(s.durations[1]?.durationMs).toBeNull();
});
it.each([
  ["low", "LOW"],
  ["review", "REVIEW"],
  ["medium", "REVIEW"],
  ["high", "HIGH"],
])(
  "maps %s advisory classification without a composite score",
  (classification, label) =>
    expect(assessmentLabel({ classification, assessmentStatus: "ok" })).toBe(
      label,
    ),
);
it.each(["failed", "unavailable"])(
  "keeps %s assessment separate from stale classification",
  (status) =>
    expect(
      assessmentLabel({ classification: "low", assessmentStatus: status }),
    ).toBe(status === "failed" ? "Failed" : "Unavailable"),
);
it.each(["complete", "partial", "unavailable", "legacy_unknown"] as const)(
  "renders %s zero-observation collection truthfully",
  (status) => {
    render(
      <ExecutionDetail
        execution={{
          ...execution,
          result: {
            ...result,
            auditCollection: { version: 1, status, reasons: [] },
          },
        }}
        risk={null}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Evidence" }));
    expect(
      screen.getByText(
        status === "complete"
          ? "No permission observations were recorded for this execution."
          : "No observations are available; collection was incomplete or unknown.",
      ),
    ).toBeTruthy();
    expect(!!screen.queryByText(/Absence of observations cannot/)).toBe(
      status !== "complete",
    );
    expect(
      screen.getByText(/No host capability request was recorded/),
    ).toBeTruthy();
  },
);
it("does not infer missing historical profile, runtime or collection", () => {
  expect(evidenceStatus(execution)).toBe("not_recorded");
  expect(evidenceStatus({ ...execution, result })).toBe("legacy_unknown");
  render(<ExecutionDetail execution={execution} risk={null} />);
  fireEvent.click(screen.getByRole("tab", { name: "Runtime" }));
  expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(8);
  expect(screen.queryByText("runc")).toBeNull();
});
it("uses native permission rows once and falls back to matching stored rows", () => {
  const native = {
    ...execution,
    result: {
      ...result,
      permissionEvents: [
        {
          event: "permission.accessed" as const,
          permission: "read",
          target: "/fixture",
          source: "deno_permission_audit" as const,
        },
      ],
    },
  };
  const events = [
    event("permission.accessed", { permission: "read", target: "/fixture" }),
  ];
  expect(permissionObservations(native, events)).toHaveLength(1);
  expect(permissionObservations(execution, events)).toHaveLength(1);
  expect(
    permissionObservations(execution, [
      { ...events[0]!, executionId: "other" },
    ]),
  ).toHaveLength(0);
});
it("has no host diagram without recorded host interaction", () =>
  expect(hostCapabilityChain(execution, [])).toEqual([]));
it("requires matching queued command and trusted successful acknowledgement", () => {
  const events = [
    event("host_api.requested"),
    event("host_api.allowed"),
    event("host_api.queued", { commandId: "cmd" }),
    event("host.command.result", {
      commandId: "cmd",
      source: "secure_bridge",
      origin: "sandbox_capability",
      success: true,
    }),
  ];
  const chain = hostCapabilityChain(execution, events);
  expect(chain.map((x) => x.state)).toEqual([
    "Observed",
    "Observed",
    "Observed",
    "Inferred",
    "Observed",
  ]);
  expect(chain[3]?.detail).toMatch(/no independent delivery timestamp/);
  expect(
    hostCapabilityChain(execution, [
      ...events.slice(0, 3),
      {
        ...events[3]!,
        metadata: { ...events[3]!.metadata, commandId: "wrong" },
      },
    ])[4]?.state,
  ).toBe("Not recorded");
});
it("never marks failed Paper acknowledgement confirmed", () => {
  const chain = hostCapabilityChain(execution, [
    event("host_api.queued", { commandId: "cmd" }),
    event("host.command.result", {
      commandId: "cmd",
      source: "secure_bridge",
      origin: "sandbox_capability",
      success: false,
    }),
  ]);
  expect(chain[4]?.state).toBe("Failed");
});
it("shows a clean empty date range without charts", async () => {
  render(
    <ExecutionInsights
      scripts={[script]}
      scriptId="s"
      selectedExecutionId={null}
      revision={0}
      onSelectScript={() => {}}
      onSelectExecution={() => {}}
      detail={null}
    />,
  );
  expect(
    await screen.findByText("No executions were recorded during this period."),
  ).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: /^Script$/ })).toBeNull();
});
it("selects history rows and submits server-side provider/date filters", async () => {
  const period = vi.spyOn(api, "executionPeriod").mockResolvedValue({
    items: [{ ...row, scriptName: script.name }],
    total: 101,
    limit: 50,
    offset: 0,
    summary: {
      completed: 101,
      failed: 0,
      terminated: 0,
      averageDurationMs: 10,
      completeEvidence: 100,
    },
  });
  const choose = vi.fn();
  render(
    <ExecutionInsights
      scripts={[script]}
      scriptId="s"
      selectedExecutionId="x"
      revision={0}
      onSelectScript={() => {}}
      onSelectExecution={choose}
      detail={<p>Selected evidence</p>}
    />,
  );
  await screen.findByText(/101 executions in selected period/);
  expect(screen.queryByText("Selected evidence")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Select execution 1/ }));
  expect(choose).toHaveBeenCalledWith("x");
  fireEvent.change(screen.getByRole("combobox", { name: "Provider" }), {
    target: { value: "mock" },
  });
  await waitFor(() =>
    expect(period.mock.calls.at(-1)![0].provider).toBe("mock")
  );
});
it("discards late responses for a previous date range", async () => {
  let resolve!: (
    value: Awaited<ReturnType<typeof api.executionPeriod>>,
  ) => void;
  vi.spyOn(api, "executionPeriod").mockImplementation((q) =>
    q.provider === "all" ? new Promise((r) => resolve = r) : Promise.resolve({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
      summary: {
        completed: 0,
        failed: 0,
        terminated: 0,
        averageDurationMs: null,
        completeEvidence: 0,
      },
    })
  );
  render(
    <ExecutionInsights
      scripts={[script]}
      scriptId="s"
      selectedExecutionId={null}
      revision={0}
      onSelectScript={() => {}}
      onSelectExecution={() => {}}
      detail={null}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Provider" }), {
    target: { value: "mock" },
  });
  await screen.findByText("No executions were recorded during this period.");
  resolve({
    items: [{ ...row, scriptName: script.name }],
    total: 1,
    limit: 50,
    offset: 0,
    summary: {
      completed: 1,
      failed: 0,
      terminated: 0,
      averageDurationMs: 10,
      completeEvidence: 1,
    },
  });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: /Select execution 1/ }))
      .toBeNull()
  );
});
it("blocks running dirty source and saves an actual new stored version", async () => {
  const save = vi
    .spyOn(api, "saveScriptVersion")
    .mockResolvedValue({ ...version, id: "v2", versionNumber: 2 });
  const done = vi.fn();
  render(
    <ScriptEditor
      script={script}
      version={version}
      versions={[version]}
      profile="none"
      provider="docker"
      running={false}
      execution={null}
      onProfile={() => {}}
      onRun={() => {}}
      onSaved={done}
      onCreated={() => {}}
      onVersion={() => {}}
    />,
  );
  editSource(
    screen.getByRole("textbox", { name: "Script source" }),
    "console.log(2)",
  );
  expect(
    (screen.getByRole("button", { name: /Run/ }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith("s", "console.log(2)", "javascript")
  );
  expect(done).toHaveBeenCalledWith(expect.objectContaining({ id: "v2" }));
});
it("supports keyboard execution detail tabs", () => {
  render(<ExecutionDetail execution={execution} risk={null} />);
  fireEvent.keyDown(screen.getByRole("tab", { name: "Output" }), {
    key: "ArrowRight",
  });
  expect(
    screen.getByRole("tab", { name: "Evidence" }).getAttribute("aria-selected"),
  ).toBe("true");
});

const settings: ProjectSettingsResponse = {
  base: {},
  overrides: {},
  effective: {},
  hostState: {},
  issues: [],
  fields: [
    {
      path: "scripting.preferredLanguage",
      category: "scripting",
      type: "enum",
      label: "Preferred language",
      editable: true,
      values: ["javascript", "typescript"],
      value: "javascript",
      source: "base",
    },
    {
      path: "scripting.style",
      category: "scripting",
      type: "enum",
      label: "Style",
      editable: true,
      values: ["short", "long"],
      value: "short",
      source: "base",
    },
  ],
  preview: {
    game: "Minecraft",
    server: "Paper",
    runtime: "Deno",
    preferredLanguage: "javascript",
    network: "none",
    filesystem: "none",
    hostCapabilities: [],
    hostStatus: "connected",
    reportedGameVersion: null,
    versionMismatch: false,
    enforcement: "Context only",
    warnings: [],
  },
};
it("coalesces rapid context edits and flushes pending changes when leaving Settings", async () => {
  vi.spyOn(api, "getProjectSettings").mockResolvedValue(settings);
  const save = vi
    .spyOn(api, "patchProjectSettings")
    .mockResolvedValue(settings);
  const { unmount } = render(<ProjectSettingsPanel />);
  await screen.findByText("Assistant / generation context");
  fireEvent.change(
    screen.getByRole("combobox", { name: /Preferred language/ }),
    { target: { value: "typescript" } },
  );
  fireEvent.change(screen.getByRole("combobox", { name: /Style/ }), {
    target: { value: "long" },
  });
  unmount();
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      scripting: { preferredLanguage: "typescript", style: "long" },
    })
  );
});
it("retains in-memory source drafts when leaving and reopening the editor", () => {
  const props = {
    script: { ...script, id: "draft-test" },
    version: { ...version, id: "draft-v" },
    versions: [],
    profile: "none" as const,
    running: false,
    execution: null,
    onProfile: () => {},
    onRun: () => {},
    onSaved: () => {},
    onCreated: () => {},
    onVersion: () => {},
  };
  const { unmount } = render(<ScriptEditor {...props} />);
  editSource(
    screen.getByRole("textbox", { name: "Script source" }),
    "draft source",
  );
  unmount();
  render(<ScriptEditor {...props} />);
  expect(
    sourceValue(screen.getByRole("textbox", { name: "Script source" })),
  ).toBe("draft source");
});

it("initializes usable source and language under React Strict Mode effect replay", () => {
  const props = {
    script: { ...script, id: "strict-mode" },
    version: { ...version, id: "strict-v" },
    versions: [],
    profile: "none" as const,
    running: false,
    execution: null,
    onProfile: () => {},
    onRun: () => {},
    onSaved: () => {},
    onCreated: () => {},
    onVersion: () => {},
  };
  render(
    <StrictMode>
      <ScriptEditor {...props} />
    </StrictMode>,
  );
  expect(
    sourceValue(screen.getByRole("textbox", { name: "Script source" })),
  ).toBe(version.source);
  expect(
    (screen.getByRole("textbox", { name: "Script name" }) as HTMLInputElement)
      .value,
  ).toBe(script.name);
  expect(
    (screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement)
      .value,
  ).toBe("javascript");
});
