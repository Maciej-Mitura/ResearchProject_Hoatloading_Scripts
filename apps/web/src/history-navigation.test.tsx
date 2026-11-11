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
  ExecutionInsights,
  filterHistory,
} from "./components/ExecutionInsights";
import { api } from "./api/client";
import type { ExecutionHistoryItem, Script } from "./types";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const script: Script = {
  id: "s",
  name: "History test",
  language: "typescript",
  status: "draft",
  description: null,
  currentVersionId: "v",
  createdAt: "2026-11-10T00:00:00Z",
  updatedAt: "2026-11-10T00:00:00Z",
};
const item: ExecutionHistoryItem = {
  id: "new",
  scriptId: "s",
  scriptVersionId: "v",
  status: "completed",
  createdAt: "2026-11-10T00:00:00Z",
  durationMs: 20,
  provider: "docker",
  runtime: "runc",
  profile: "none",
  auditStatus: "complete",
  assessmentId: "r",
  classification: "low",
  assessmentStatus: "ok",
};
const items = [
  { ...item, id: "old", createdAt: "2026-10-01T00:00:00Z", durationMs: 50 },
  {
    ...item,
    id: "missing",
    createdAt: "2026-11-09T00:00:00Z",
    durationMs: null,
  },
  item,
];
function Viewer({ direct = false }: { direct?: boolean }) {
  const [selected, setSelected] = useState<string | null>("new");
  return (
    <ExecutionInsights
      scripts={[script]}
      scriptId="s"
      selectedExecutionId={selected}
      initialExecutionId={direct ? "new" : undefined}
      revision={0}
      onSelectScript={() => {}}
      onSelectExecution={setSelected}
      detail={<p>Evidence for {selected}</p>}
    />
  );
}
const mock = () =>
  vi.spyOn(api, "executionPeriod").mockResolvedValue({
    items: [...items].reverse().map((r) => ({ ...r, scriptName: script.name })),
    total: 3,
    limit: 50,
    offset: 0,
    summary: {
      completed: 3,
      failed: 0,
      terminated: 0,
      averageDurationMs: 35,
      completeEvidence: 3,
    },
  });
it("opens with history only even if App already has a selected run", async () => {
  mock();
  render(<Viewer />);
  await screen.findByRole("heading", { name: "Execution history" });
  expect(screen.queryByText("Evidence for new")).toBeNull();
  expect(screen.queryByText("Statistics for this run")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Select execution 1/ }));
  expect(screen.getByText("Evidence for new")).toBeTruthy();
  expect(document.activeElement).toBe(
    screen.getByRole("region", { name: "Selected run" }),
  );
  expect(
    within(screen.getByRole("region", { name: "Selected run" })).getByText(
      "Evidence for new",
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close run details" }));
  expect(screen.queryByText("Evidence for new")).toBeNull();
});
it("replaces the competing script and run selectors with a period query", async () => {
  const query = mock();
  render(<Viewer />);
  await screen.findByRole("heading", { name: "Execution history" });
  expect(screen.queryByRole("combobox", { name: /^Script$/ })).toBeNull();
  expect(screen.queryByRole("combobox", { name: /^Runs$/ })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Period" }), {
    target: { value: "7" },
  });
  await screen.findByRole("heading", { name: "Execution history" });
  expect(query.mock.calls.at(-1)![0].limit).toBe("50");
  expect(screen.queryByText("Evidence for new")).toBeNull();
});
it("treats explicit Workbench navigation as an intentional run selection", async () => {
  mock();
  render(<Viewer direct />);
  expect(await screen.findByText("Evidence for new")).toBeTruthy();
});
it("sorts a copy of history, retains missing durations last and filters dates", () => {
  expect(
    filterHistory(items, "all", "all", "all", "oldest").map((r) => r.id),
  ).toEqual(["old", "missing", "new"]);
  expect(
    filterHistory(items, "all", "all", "all", "longest").map((r) => r.id),
  ).toEqual(["old", "new", "missing"]);
  expect(
    filterHistory(items, "all", "all", "all", "shortest").map((r) => r.id),
  ).toEqual(["new", "old", "missing"]);
  expect(
    filterHistory(
      items,
      "all",
      "7",
      "all",
      "newest",
      Date.parse("2026-11-10T00:00:00Z"),
    ),
  ).toHaveLength(2);
  expect(items[0]?.id).toBe("old");
});
it("does not replace a filtered-out latest run with an older matching provider", () => {
  expect(
    filterHistory(
      [{ ...item, provider: "mock" }, items[0]!],
      "latest",
      "all",
      "docker",
      "newest",
    ),
  ).toEqual([]);
});
