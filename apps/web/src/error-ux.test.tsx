import { sourceValue } from "./editor-test-utils";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  displayOutput,
  executionError,
  failureLabel,
  importsHost,
  sourceLocation,
} from "./execution-errors";
import { executionJourney, stageVisual } from "./execution-ux";
import { ExecutionJourney } from "./components/ExecutionFeedback";
import { ExecutionDetail } from "./components/ExecutionDetail";
import { ScriptEditor } from "./components/ScriptEditor";
import type { Execution, PermissionProfileId, RiskAssessment } from "./types";
import { buildExecutionTimeline } from "./timeline";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const at = "2026-11-10T06:09:27.000Z";
const source =
  'import { host } from "host";\nconsole.log("Hello world");\nawait host.chat.broadcast("Hello world");';
const stderr =
  '\x1b[0m\x1b[1m\x1b[31merror\x1b[0m: Import "host" not a dependency\n  hint: If you want to use the npm package, try running `deno add npm:host`\n    at \x1b[36mfile:///workspace/main.ts\x1b[0m:\x1b[33m1\x1b[0m:\x1b[33m22\x1b[0m\n';
function execution(profile = "none"): Execution {
  return {
    id: "error",
    scriptId: "s",
    scriptVersionId: "v",
    status: "failed",
    riskAssessmentId: "r",
    errorMessage: stderr,
    createdAt: at,
    startedAt: at,
    finishedAt: at,
    updatedAt: at,
    result: {
      provider: "docker",
      exitCode: 1,
      stdout: "",
      stderr,
      durationMs: 700,
      timedOut: false,
      outputTruncated: false,
      failureCategory: "process_nonzero_exit",
      auditCollection: { version: 1, status: "complete", reasons: [] },
      manifest: {
        runtime: "deno",
        runtimeVersion: "2.9.7",
        executionProvider: "docker",
        permissionProfile: profile,
        timeoutMs: 10000,
      },
    },
  };
}
const risk: RiskAssessment = {
  id: "r",
  executionId: "error",
  scriptVersionId: "v",
  classification: "low",
  score: 0.15,
  confidence: 1,
  reasons: [
    "[R010] No predefined high-risk indicators observed in this controlled model",
  ],
  provider: "deterministic",
  assessmentStatus: "ok",
  createdAt: at,
};

it.each([
  ["colored Deno", "\x1b[31merror\x1b[0m", "error"],
  ["multiple", "\x1b[1m\x1b[36mA\x1b[0m\x1b[2KB", "AB"],
  ["plain", "plain stderr", "plain stderr"],
  ["multiline", "a\n\x1b[33mb\x1b[0m\n", "a\nb\n"],
  ["Unicode", "\x1b[1m你好 · é ✓\x1b[0m", "你好 · é ✓"],
  ["empty", "", ""],
  [
    "OSC hyperlink",
    "\x1b]8;;https://example.invalid\x1b\\link\x1b]8;;\x1b\\",
    "link",
  ],
])(
  "normalizes %s without destroying text",
  (_, raw, expected) => expect(displayOutput(raw)).toBe(expected),
);
it.each(["none", "read-fixture", "env-demo"])(
  "explains the recorded %s mismatch",
  (profile) => {
    const d = executionError(execution(profile));
    expect(d?.kind).toBe("profile");
    expect(d?.suggestedProfile).toBe("host-chat");
    expect(d?.explanation).toContain(profile);
  },
);
it("treats a failing host-chat import as setup trouble, not a request to reselect it", () => {
  const d = executionError(execution("host-chat"));
  expect(d?.kind).toBe("host-setup");
  expect(d?.suggestedProfile).toBeUndefined();
  expect(d?.action).not.toContain("Select host-chat");
});
it("uses generic import guidance for an unrelated module or missing profile", () => {
  const x = execution();
  x.result!.stderr = 'error: Import "other" not a dependency';
  expect(executionError(x)?.kind).toBe("import");
  expect(executionError(x)?.suggestedProfile).toBeUndefined();
  x.result!.stderr = stderr;
  x.result!.manifest = null;
  expect(executionError(x)?.kind).toBe("import");
});
it("does not diagnose host imports from arbitrary mentions or stdout", () => {
  const x = execution();
  x.result!.stderr = "error: Uncaught Error: host is not available";
  x.result!.stdout = stderr;
  expect(executionError(x)?.kind).toBe("runtime");
  expect(executionError(x)?.suggestedProfile).toBeUndefined();
});
it("falls back for missing stderr and missing locations", () => {
  const x = execution();
  x.errorMessage = null;
  x.result!.stderr = "";
  expect(executionError(x)?.title).toBe("Script execution failed");
  expect(executionError(x)?.location).toBeNull();
  expect(sourceLocation("bad location foo")).toBeNull();
});
it("extracts Deno source URI, filename, line and column", () =>
  expect(sourceLocation(stderr)).toEqual({
    uri: "file:///workspace/main.ts",
    path: "main.ts",
    line: 1,
    column: 22,
    label: "main.ts · line 1, column 22",
  }));
it("keeps actual infrastructure, permission, timeout and unknown categories distinct", () => {
  for (
    const [code, kind] of [
      ["supervisor_error", "infrastructure"],
      ["docker_operation_timeout", "infrastructure"],
      ["deno_permission", "permission"],
      ["timeout", "timeout"],
      ["memory_limit", "memory"],
    ]
  ) {
    const x = execution();
    x.result!.stderr = "";
    x.errorMessage = null;
    x.result!.failureCategory = code;
    expect(executionError(x)?.kind).toBe(kind);
  }
  expect(failureLabel("future_code")).toBe("Unrecognized execution failure");
});
it.each([
  [source, true],
  ['import "host";', true],
  ["import {\n host\n} from 'host'", true],
  ['// import {host} from "host"', false],
  ['/* import "host" */', false],
  ["console.log('import {host} from \"host\"')", false],
  ['const x = `import "host"`;', false],
  ['await import("host")', false],
  ["import.meta.url", false],
  ['import {host} from "other"', false],
])(
  "recognizes only clear static Host SDK imports: %s",
  (code, expected) => expect(importsHost(code as string)).toBe(expected),
);
it("shows one primary diagnosis, quiet collapsed stderr and unchanged historical evidence", () => {
  const x = execution(),
    before = JSON.stringify(x);
  const { container } = render(<ExecutionDetail execution={x} risk={risk} />);
  expect(
    screen.getAllByRole("heading", { name: "Host SDK unavailable" }),
  ).toHaveLength(1);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(
    screen.getByText("Technical error details · STDERR recorded"),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("region", { name: "Execution error" })
      .querySelector(".error-symbol")?.textContent,
  ).toBe("×");
  const technical = container.querySelector(
    ".technical-error-details",
  ) as HTMLDetailsElement;
  expect(technical.open).toBe(false);
  expect(container.textContent).not.toContain("\x1b");
  expect(
    container.textContent?.match(/Import "host" not a dependency/g),
  ).toHaveLength(1); // normalized once; raw JSON strings remain escaped and secondary
  expect(container.querySelectorAll(".error-banner")).toHaveLength(0);
  expect(JSON.stringify(x)).toBe(before);
  fireEvent.click(
    screen.getByRole("button", { name: "About Evidence collection: Complete" }),
  );
  expect(screen.getByRole("tooltip").textContent).toContain(
    "does not mean the script succeeded",
  );
});
it("copies normalized stderr rather than control sequences", async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: copy },
  });
  render(<ExecutionDetail execution={execution()} risk={risk} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy STDERR" }));
  expect(copy).toHaveBeenCalledWith(displayOutput(stderr));
});
it("changes only the visible profile after explicit suggestion; never runs or persists", () => {
  const onRun = vi.fn(),
    onSaved = vi.fn(),
    onCreated = vi.fn();
  function Editor() {
    const [profile, onProfile] = useState<PermissionProfileId>("none");
    return (
      <ScriptEditor
        script={null}
        version={{
          id: "v",
          scriptId: "s",
          versionNumber: 1,
          changelog: null,
          language: "typescript",
          source,
          createdAt: at,
        }}
        versions={[]}
        profile={profile}
        running={false}
        execution={null}
        onProfile={onProfile}
        onRun={onRun}
        onSaved={onSaved}
        onCreated={onCreated}
        onVersion={() => {}}
      />
    );
  }
  render(<Editor />);
  expect(
    (
      screen.getByRole("combobox", {
        name: "Permission profile",
      }) as HTMLSelectElement
    ).value,
  ).toBe("none");
  fireEvent.click(
    screen.getByRole("button", { name: "Use Per-script permissions" }),
  );
  expect(
    (
      screen.getByRole("combobox", {
        name: "Permission profile",
      }) as HTMLSelectElement
    ).value,
  ).toBe("host-capabilities");
  expect(screen.queryByText("This script imports the Host SDK.")).toBeNull();
  expect(onRun).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
  expect(onCreated).not.toHaveBeenCalled();
  expect(
    sourceValue(screen.getByRole("textbox", { name: "Script source" })),
  ).toBe(source);
});
it("keeps failed result, complete collection and LOW assessment independent", () => {
  render(<ExecutionJourney execution={execution()} risk={risk} />);
  const flow = screen.getByRole("list", { name: "Recorded execution path" });
  const nodes = within(flow).getAllByRole("img");
  expect(nodes.map((n) => n.textContent)).toEqual(["✓", "✓", "×", "✓", "•"]);
  expect(within(flow).getByRole("img", { name: "Assessment: Record returned" }))
    .toBeTruthy();
  expect(flow.textContent).toContain("Failed");
  expect(flow.textContent).toContain("Complete");
  expect(flow.textContent).toContain("LOW");
  expect(flow.textContent).not.toContain("Observed");
});
it("renders successful records with a neutral advisory marker", () => {
  const x = execution();
  x.status = "completed";
  x.result!.exitCode = 0;
  render(<ExecutionJourney execution={x} risk={risk} />);
  expect(screen.getAllByRole("img").map((n) => n.textContent)).toEqual([
    "✓",
    "✓",
    "✓",
    "✓",
    "•",
  ]);
});
it("uses a warning for timeout result and question for unavailable evidence", () => {
  const x = execution();
  x.status = "terminated";
  x.result!.timedOut = true;
  x.result!.auditCollection = {
    version: 1,
    status: "unavailable",
    reasons: [],
  };
  const stages = executionJourney(x, { ...risk, classification: "high" });
  expect(stages.map(stageVisual).map((v) => v.icon)).toEqual([
    "✓",
    "✓",
    "!",
    "?",
    "✓",
  ]);
});
it("identifies the active stage without animation and exposes inferred provenance on keyboard focus", () => {
  const x = execution();
  x.status = "running";
  x.result = null;
  render(<ExecutionJourney execution={x} risk={null} />);
  const flow = screen.getByRole("list");
  expect(flow.querySelector('[aria-current="step"]')?.textContent).toContain(
    "Running",
  );
  fireEvent.focus(
    screen.getByRole("button", { name: "About Process stage: Running" }),
  );
  expect(screen.getByRole("tooltip").textContent).toContain("Inferred");
});
it("keeps successful execution nodes reached when analysis fails", () => {
  const x = execution();
  x.status = "completed";
  render(
    <ExecutionJourney
      execution={x}
      risk={{ ...risk, assessmentStatus: "failed", classification: null }}
    />,
  );
  expect(screen.getAllByRole("img").map((n) => n.textContent)).toEqual([
    "✓",
    "✓",
    "✓",
    "✓",
    "×",
  ]);
});
it("keeps not-recorded and not-applicable stages explicit", () => {
  const x = execution();
  x.result = null;
  const stages = executionJourney(x, null);
  expect(stageVisual(stages[2]!).icon).toBe("?");
  x.status = "blocked";
  expect(executionJourney(x, null)[4]?.provenance).toBe("Not applicable");
  expect(stageVisual(executionJourney(x, null)[4]!).icon).toBe("○");
});
it("uses ordered semantic nodes and shared responsive hooks without progress-bar roles", () => {
  render(<ExecutionJourney execution={execution()} risk={risk} />);
  expect(screen.getByRole("list").className).toBe("execution-lifecycle");
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
  expect(screen.queryByRole("progressbar")).toBeNull();
});
it("labels error timeline diagnosis as derived and does not repeat raw failure output", () => {
  const x = execution();
  const entries = buildExecutionTimeline({
    execution: x,
    executionEvents: [
      {
        id: "e",
        executionId: x.id,
        status: "failed",
        message: stderr,
        createdAt: at,
      },
    ],
    securityEvents: [],
  });
  expect(entries.find((e) => e.kind === "DERIVED_ERROR")?.reconstructed).toBe(
    true,
  );
  expect(entries.find((e) => e.kind === "FAILED")?.detail).not.toContain(
    'Import "host"',
  );
});

it("keeps timeout warning styling and avoids irrelevant LOW text for HIGH", () => {
  const x = execution();
  x.status = "terminated";
  x.result!.timedOut = true;
  render(
    <ExecutionDetail
      execution={x}
      risk={{ ...risk, classification: "high" }}
    />,
  );
  const card = screen.getByRole("region", { name: "Execution error" });
  expect(card.className).toContain("error-warning");
  expect(card.textContent).not.toContain("LOW");
});
