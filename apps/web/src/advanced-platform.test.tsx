import { EditorView } from "@codemirror/view";
import { editorView } from "./editor-test-utils";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ScriptEditor } from "./components/ScriptEditor";
import { LimitsPanel } from "./components/LimitsPanel";
import { dateRange, ExecutionInsights } from "./components/ExecutionInsights";
import { api } from "./api/client";
import { editSource, sourceValue } from "./editor-test-utils";
import { CAPABILITIES } from "../../../packages/contracts/src/capabilities";
import type { Script, ScriptVersion } from "./types";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const project = {
  entrypoint: "main.ts",
  files: [
    {
      path: "main.ts",
      content: 'import {n} from "./helper.ts";console.log(n)',
    },
    { path: "helper.ts", content: "export const n = 4;" },
    { path: "config.json", content: '{"count":4}' },
  ],
};
function props(id: string) {
  const script: Script = {
    id,
    name: id,
    description: null,
    language: "typescript",
    status: "draft",
    currentVersionId: id + "v",
    createdAt: "2026-11-10T00:00:00Z",
    updatedAt: "2026-11-10T00:00:00Z",
  };
  const version: ScriptVersion = {
    id: id + "v",
    scriptId: id,
    versionNumber: 1,
    source: project.files[0]!.content,
    language: "typescript",
    createdAt: script.createdAt,
    changelog: null,
    project,
  };
  return {
    script,
    version,
    versions: [version],
    profile: "none" as const,
    running: false,
    execution: null,
    onProfile: vi.fn(),
    onRun: vi.fn(),
    onSaved: vi.fn(),
    onCreated: vi.fn(),
    onVersion: vi.fn(),
  };
}
it("project tabs edit supporting files and save the entire immutable version", async () => {
  const p = props("project-save");
  const save = vi.spyOn(api, "saveScriptVersion").mockResolvedValue({
    ...p.version,
    id: "new",
  });
  render(<ScriptEditor {...p} />);
  fireEvent.click(screen.getByRole("tab", { name: "helper.ts" }));
  expect(sourceValue(screen.getByRole("textbox", { name: "Script source" })))
    .toBe(project.files[1]!.content);
  editSource(
    screen.getByRole("textbox", { name: "Script source" }),
    "export const n = 9;",
  );
  expect(screen.getByRole("button", { name: "▶ Run" }).hasAttribute("disabled"))
    .toBe(true);
  fireEvent.click(screen.getByRole("tab", { name: /main.ts/ }));
  expect(sourceValue(screen.getByRole("textbox", { name: "Script source" })))
    .toBe(project.files[0]!.content);
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(
    save.mock.calls[0]![3]!.files.find((f) => f.path === "helper.ts")!.content,
  ).toBe("export const n = 9;");
  expect(save.mock.calls[0]![3]!.files.length).toBe(3);
});
it("tabs have keyboard navigation and per-file JSON editing", () => {
  render(<ScriptEditor {...props("tabs-json")} />);
  fireEvent.keyDown(screen.getByRole("tab", { name: /main.ts/ }), {
    key: "End",
  });
  expect(
    screen.getByRole("tab", { name: "config.json" }).getAttribute(
      "aria-selected",
    ),
  ).toBe("true");
  expect(sourceValue(screen.getByRole("textbox", { name: "Script source" })))
    .toBe('{"count":4}');
});
it("supports bounded add rename delete without allowing traversal", () => {
  render(<ScriptEditor {...props("file-actions")} />);
  fireEvent.click(screen.getByText("Project files", { selector: "summary" }));
  fireEvent.change(screen.getByRole("textbox", { name: "File path" }), {
    target: { value: "../escape.ts" },
  });
  fireEvent.click(screen.getByRole("button", { name: "New file" }));
  expect(screen.getByRole("alert").textContent).toContain("relative");
  fireEvent.change(screen.getByRole("textbox", { name: "File path" }), {
    target: { value: "utils/new.ts" },
  });
  fireEvent.click(screen.getByRole("button", { name: "New file" }));
  expect(screen.getByRole("tab", { name: /utils\/new.ts/ })).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "File path" }), {
    target: { value: "utils/renamed.ts" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Rename active file" }));
  expect(screen.getByRole("tab", { name: /renamed.ts/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Delete active file" }));
  expect(screen.queryByRole("tab", { name: /renamed.ts/ })).toBeNull();
});
it("preserves dirty supporting files across unmount and remount", () => {
  const p = props("project-draft");
  const r = render(<ScriptEditor {...p} />);
  fireEvent.click(screen.getByRole("tab", { name: "helper.ts" }));
  editSource(
    screen.getByRole("textbox", { name: "Script source" }),
    "draft helper",
  );
  r.unmount();
  render(<ScriptEditor {...p} />);
  fireEvent.click(screen.getByRole("tab", { name: /helper.ts/ }));
  expect(sourceValue(screen.getByRole("textbox", { name: "Script source" })))
    .toBe("draft helper");
});
it("error navigation selects a matching version helper and ignores a different version", () => {
  const p = props("project-error");
  const r = render(
    <ScriptEditor
      {...p}
      errorTarget={{
        versionId: p.version.id,
        path: "helper.ts",
        line: 1,
        column: 3,
        serial: 1,
      }}
    />,
  );
  expect(
    screen.getByRole("tab", { name: "helper.ts" }).getAttribute(
      "aria-selected",
    ),
  ).toBe("true");
  r.rerender(
    <ScriptEditor
      {...p}
      errorTarget={{
        versionId: "other",
        path: "config.json",
        line: 1,
        column: 1,
        serial: 2,
      }}
    />,
  );
  expect(
    screen.getByRole("tab", { name: "helper.ts" }).getAttribute(
      "aria-selected",
    ),
  ).toBe("true");
});
it("limits renders the running registry exact APIs and intentional unsupported model", async () => {
  vi.spyOn(api, "capabilityRegistry").mockResolvedValue(CAPABILITIES);
  render(<LimitsPanel onClose={vi.fn()} />);
  await screen.findByText("world.setBlock", { selector: "code" });
  expect(screen.getByText('await host.world.setWeather("THUNDER");'))
    .toBeTruthy();
  expect(screen.getByText(/no persistent event listeners/)).toBeTruthy();
  expect(screen.getByText(/one immutable version/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Close limits" })).toBeTruthy();
});
it("date presets use local midnight and exact rolling hours; custom range converts timezone", () => {
  const now = new Date(2026, 10, 10, 16, 30).getTime();
  expect(new Date(dateRange("today", "", "", now).start).getHours()).toBe(0);
  for (const days of ["1", "7", "30"]) {
    expect(
      Date.parse(dateRange(days, "", "", now).end) -
        Date.parse(dateRange(days, "", "", now).start),
    ).toBe(Number(days) * 86400000);
  }
  expect(dateRange("custom", "2026-11-10T00:00", "2026-11-11T00:00").start)
    .toBe(new Date("2026-11-10T00:00").toISOString());
});
it("period pagination keeps date/provider parameters and aggregates the whole range", async () => {
  const query = vi.spyOn(api, "executionPeriod").mockResolvedValue({
    items: [],
    total: 125,
    limit: 50,
    offset: 0,
    summary: {
      completed: 120,
      failed: 3,
      terminated: 2,
      averageDurationMs: 25,
      completeEvidence: 100,
    },
  });
  render(
    <ExecutionInsights
      scripts={[]}
      scriptId={null}
      selectedExecutionId={null}
      revision={0}
      onSelectScript={() => {}}
      onSelectExecution={() => {}}
      detail={null}
    />,
  );
  await screen.findByText(/125 executions in selected period/);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => expect(query.mock.calls.at(-1)![0].offset).toBe("50"));
  fireEvent.change(screen.getByRole("combobox", { name: "Period" }), {
    target: { value: "custom" },
  });
  fireEvent.change(screen.getByLabelText("From date/time"), {
    target: { value: "2026-11-10T00:00" },
  });
  fireEvent.change(screen.getByLabelText("To date/time"), {
    target: { value: "2026-11-11T00:00" },
  });
  await waitFor(() =>
    expect(query.mock.calls.at(-1)![0].start).toBe(
      new Date("2026-11-10T00:00").toISOString(),
    )
  );
  expect(query.mock.calls.at(-1)![0].offset).toBe("0");
});

it("cached tabs adopt the current theme without losing their documents", async () => {
  document.documentElement.dataset.theme = "dark";
  render(<ScriptEditor {...props("cached-theme")} />);
  fireEvent.click(screen.getByRole("tab", { name: "helper.ts" }));
  expect(
    editorView(screen.getByRole("textbox", { name: "Script source" })).state
      .facet(EditorView.darkTheme),
  ).toBe(true);
  fireEvent.click(screen.getByRole("tab", { name: /main.ts/ }));
  document.documentElement.dataset.theme = "light";
  await waitFor(() =>
    expect(
      editorView(screen.getByRole("textbox", { name: "Script source" })).state
        .facet(EditorView.darkTheme),
    ).toBe(false)
  );
  fireEvent.click(screen.getByRole("tab", { name: "helper.ts" }));
  expect(
    editorView(screen.getByRole("textbox", { name: "Script source" })).state
      .facet(EditorView.darkTheme),
  ).toBe(false);
  expect(sourceValue(screen.getByRole("textbox", { name: "Script source" })))
    .toBe(project.files[1]!.content);
  document.documentElement.dataset.theme = "dark";
});
