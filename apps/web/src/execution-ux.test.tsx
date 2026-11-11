import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { InfoTip } from "./components/InfoTip";
import {
  ExecutionActivity,
  ExecutionJourney,
  CollectionBadge,
} from "./components/ExecutionFeedback";
import { ExecutionDetail } from "./components/ExecutionDetail";
import { ScriptEditor } from "./components/ScriptEditor";
import {
  isTerminal,
  outcomeSummary,
  explainReason,
  preferNewerExecution,
} from "./execution-ux";
import { hostInteraction } from "./host-evidence";
import { hostCapabilityChain } from "./insights";
import { useExecutionMonitor } from "./useExecutionMonitor";
import { api } from "./api/client";
import type {
  Execution,
  ExecutionResult,
  RiskAssessment,
  SecurityEvent,
} from "./types";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const at = "2026-11-10T01:49:12.000Z";
const base: Execution = {
  id: "x",
  scriptId: "s",
  scriptVersionId: "v",
  status: "completed",
  riskAssessmentId: "r",
  errorMessage: null,
  result: null,
  startedAt: at,
  finishedAt: at,
  createdAt: at,
  updatedAt: at,
};
const raw: ExecutionResult = {
  provider: "docker",
  exitCode: 0,
  stdout: "Hello world",
  stderr: "",
  durationMs: 10440,
  timedOut: false,
  outputTruncated: false,
  cleanupErrors: [],
  manifest: {
    runtime: "deno",
    runtimeVersion: "2.9.7",
    executionProvider: "docker",
    permissionProfile: "host-chat",
    timeoutMs: 10000,
  },
  auditCollection: { version: 1, status: "complete", reasons: [] },
};
const risk: RiskAssessment = {
  id: "r",
  executionId: "x",
  scriptVersionId: "v",
  classification: "high",
  score: 0.8,
  confidence: 1,
  reasons: ["[R006] Execution timed out (resource limit)"],
  provider: "deterministic",
  assessmentStatus: "ok",
  createdAt: at,
};
const ev = (
  type: string,
  commandId: string,
  success?: boolean,
): SecurityEvent => ({
  id: type + commandId,
  executionId: "x",
  eventType: type,
  message: type,
  severity: "info",
  createdAt: at,
  metadata: {
    commandId,
    source: "secure_bridge",
    origin: "sandbox_capability",
    success,
  },
});
it("shows sending immediately and never invents container startup or a percentage", () => {
  render(
    <>
      <ExecutionActivity
        execution={null}
        requestedProfile="none"
        submittedAt={Date.now()}
      />
      <ExecutionJourney execution={null} risk={null} />
    </>,
  );
  expect(screen.getByText("Sending execution request…")).toBeTruthy();
  expect(screen.getByRole("timer")).toBeTruthy();
  expect(screen.queryByText(/container created/i)).toBeNull();
  expect(screen.queryByRole("progressbar")).toBeNull();
});
it("updates elapsed time during running and stops activity at terminal state", () => {
  vi.useFakeTimers();
  const started = Date.now();
  const { rerender } = render(
    <ExecutionActivity
      execution={{ ...base, status: "running", result: null }}
      submittedAt={started}
      requestedProfile="none"
    />,
  );
  act(() => vi.advanceTimersByTime(1500));
  expect(screen.getByRole("timer").textContent).toBe("1.5 s");
  rerender(<ExecutionActivity execution={base} />);
  expect(screen.queryByRole("timer")).toBeNull();
});
it("explains actual timeout, missing audit frame and stored R006 reason", () => {
  const x = {
    ...base,
    status: "terminated" as const,
    result: {
      ...raw,
      timedOut: true,
      exitCode: null,
      failureCategory: "timeout",
      auditCollection: {
        version: 1 as const,
        status: "unavailable" as const,
        reasons: ["job_wall_timeout", "missing_audit_frame"],
      },
    },
  };
  render(<ExecutionDetail execution={x} risk={risk} />);
  expect(
    screen.getByText("Execution terminated after reaching its 10 s limit."),
  ).toBeTruthy();
  expect(screen.getByText("Final audit frame not received")).toBeTruthy();
  expect(screen.getAllByText(risk.reasons[0]!).length).toBeGreaterThan(0);
  expect(screen.getByText("No cleanup errors reported")).toBeTruthy();
  expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(0);
});
it("does not guess missing timeout, OOM or historical metadata", () => {
  expect(
    outcomeSummary({
      ...base,
      status: "terminated",
      result: { ...raw, manifest: null, timedOut: true },
    }),
  ).not.toContain("10 s");
  render(<ExecutionDetail execution={base} risk={null} />);
  fireEvent.click(screen.getByRole("tab", { name: "Runtime" }));
  expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(5);
});
it("distinguishes script failure and infrastructure failure", () => {
  expect(
    outcomeSummary({
      ...base,
      status: "failed",
      result: { ...raw, exitCode: 1 },
    }),
  ).toContain("exit code 1");
  expect(
    outcomeSummary({
      ...base,
      status: "failed",
      result: { ...raw, failureCategory: "supervisor_error" },
    }),
  ).toContain("infrastructure");
  expect(isTerminal({ ...base, status: "analysing" })).toBe(false);
});
it.each(["complete", "partial", "unavailable", "legacy_unknown"])(
  "explains collection %s through the shared tooltip",
  (status) => {
    render(<CollectionBadge status={status} />);
    const button = screen.getByRole("button");
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    expect(button.getAttribute("aria-describedby")).toBe(
      screen.getByRole("tooltip").id,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  },
);
it("supports tap, hover and Escape without relying on title attributes", () => {
  render(<InfoTip label="Example">Helpful text</InfoTip>);
  const button = screen.getByRole("button", { name: "About Example" });
  fireEvent.click(button);
  expect(screen.getByRole("tooltip").textContent).toContain("Helpful text");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.blur(button);
  fireEvent.mouseEnter(button);
  expect(screen.getByRole("tooltip")).toBeTruthy();
});
it("keeps each profile explanation available without native-option hover", () => {
  render(
    <ScriptEditor
      script={null}
      version={null}
      versions={[]}
      profile="none"
      running={false}
      execution={null}
      onProfile={() => {}}
      onRun={() => {}}
      onSaved={() => {}}
      onCreated={() => {}}
      onVersion={() => {}}
    />,
  );
  expect(screen.queryByText(/Profile guide/)).toBeNull();
  fireEvent.focus(
    screen.getByRole("button", { name: "About Execution profile" }),
  );
  const tooltip = screen.getByRole("tooltip");
  for (const name of ["No permissions", "Read test fixture", "Demo environment", "Chat broadcast (fixed)", "Per-script permissions"])
    expect(tooltip.textContent).toContain(name);
  expect(tooltip.textContent).toContain("SANDBOX_DEMO_VALUE");
  expect(tooltip.textContent).toContain(
    'New saved versions use reviewed Per-script permissions.',
  );
});
it("does not turn a host-chat profile into host usage", () => {
  const x = { ...base, result: raw };
  expect(hostInteraction(x, []).hasEvidence).toBe(false);
  expect(hostCapabilityChain(x, [])).toEqual([]);
});
it("reports partial host confirmation rather than treating one success as all", () => {
  const events = [
    ev("host_api.queued", "a"),
    ev("host_api.queued", "b"),
    ev("host.command.result", "a", true),
    ev("host.command.result", "b", false),
  ];
  const h = hostInteraction({ ...base, result: raw }, events);
  expect(h.confirmed).toBe(1);
  expect(h.failed).toBe(1);
  expect(h.pending).toBe(0);
  expect(hostCapabilityChain({ ...base, result: raw }, events)[4]?.state).toBe(
    "Partial",
  );
});
it("preserves successful execution when advisory analysis fails", () => {
  render(
    <ExecutionDetail
      execution={{ ...base, result: raw }}
      risk={{
        ...risk,
        classification: null,
        assessmentStatus: "failed",
        failureKind: "rate_limit",
      }}
    />,
  );
  expect(screen.getByText(/Execution completed in/)).toBeTruthy();
  expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/rate_limit/).length).toBeGreaterThan(0);
});
it("retains unknown collection reasons rather than hiding them", () => {
  expect(explainReason("new_future_reason").title).toBe("new future reason");
});
it("does not regress terminal SSE state with an older polling response", () => {
  expect(preferNewerExecution(base, { ...base, status: "running" })).toBe(base);
});
const setup = () => {
  vi.spyOn(api, "getExecution").mockResolvedValue({
    execution: base,
    events: [],
    securityEvents: [],
  });
  vi.spyOn(api, "riskAssessments").mockResolvedValue([risk]);
};
it("stops polling when terminal execution and assessment are settled", async () => {
  vi.useFakeTimers();
  setup();
  renderHook(() => useExecutionMonitor("x", 0));
  await act(async () => {});
  expect(api.getExecution).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(10000));
  expect(api.getExecution).toHaveBeenCalledTimes(1);
});
it("polls active execution and automatically transitions to a final result", async () => {
  vi.useFakeTimers();
  setup();
  vi.mocked(api.getExecution).mockResolvedValueOnce({
    execution: { ...base, status: "running", riskAssessmentId: null },
    events: [],
    securityEvents: [],
  });
  const { result } = renderHook(() => useExecutionMonitor("x", 0));
  await act(async () => {});
  expect(result.current.data?.execution.status).toBe("running");
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(result.current.data?.execution.status).toBe("completed");
  await act(async () => vi.advanceTimersByTimeAsync(9000));
  expect(api.getExecution).toHaveBeenCalledTimes(2);
});
it("retains last loaded data and distinguishes refresh failure from script failure", async () => {
  vi.useFakeTimers();
  setup();
  vi.mocked(api.getExecution)
    .mockResolvedValueOnce({
      execution: { ...base, status: "running" },
      events: [],
      securityEvents: [],
    })
    .mockRejectedValueOnce(new Error("connection lost"));
  const { result } = renderHook(() => useExecutionMonitor("x", 0));
  await act(async () => {});
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(result.current.data?.execution.status).toBe("running");
  expect(result.current.error).toContain(
    "does not establish execution failure",
  );
});
it("ignores late data from a previously selected execution", async () => {
  setup();
  let resolve!: (x: {
    execution: Execution;
    events: [];
    securityEvents: [];
  }) => void;
  vi.mocked(api.getExecution).mockImplementation((id) =>
    id === "old"
      ? new Promise((r) => (resolve = r))
      : Promise.resolve({ execution: base, events: [], securityEvents: [] }),
  );
  const { result, rerender } = renderHook(
    ({ id }) => useExecutionMonitor(id, 0),
    { initialProps: { id: "old" } },
  );
  rerender({ id: "x" });
  await waitFor(() => expect(result.current.data?.execution.id).toBe("x"));
  await act(async () =>
    resolve({
      execution: { ...base, id: "old" },
      events: [],
      securityEvents: [],
    }),
  );
  expect(result.current.data?.execution.id).toBe("x");
});

it("bounds follow-up reads when a host acknowledgement never arrives", async () => {
  vi.useFakeTimers();
  setup();
  vi.mocked(api.getExecution).mockResolvedValue({
    execution: { ...base, result: raw },
    events: [],
    securityEvents: [ev("host_api.queued", "pending")],
  });
  renderHook(() => useExecutionMonitor("x", 0));
  await act(async () => {});
  await act(async () => vi.advanceTimersByTimeAsync(33000));
  const calls = vi.mocked(api.getExecution).mock.calls.length;
  expect(calls).toBe(11);
  await act(async () => vi.advanceTimersByTimeAsync(30000));
  expect(api.getExecution).toHaveBeenCalledTimes(calls);
});

it("does not mistake administrative session metadata for a script host call", () => {
  expect(
    hostInteraction({ ...base, result: raw }, [
      ev("host_api.session_created", "none"),
    ]).hasEvidence,
  ).toBe(false);
});
