import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkbenchExecution } from "./components/WorkbenchExecution";
import type { Execution } from "./types";
afterEach(cleanup);
const at = "2026-11-10T07:00:00Z";
const run: Execution = {
  id: "x",
  scriptId: "s",
  scriptVersionId: "v",
  status: "failed",
  errorMessage: "private raw terminal error",
  riskAssessmentId: null,
  result: null,
  createdAt: at,
  updatedAt: at,
  startedAt: at,
  finishedAt: at,
};
it("shows immediate submission activity without evidence tabs or a result link", () => {
  render(
    <WorkbenchExecution
      execution={null}
      submitting
      loading={false}
      requestedProfile="none"
      submittedAt={Date.now()}
      onView={() => {}}
      onRefresh={() => {}}
    />,
  );
  expect(screen.getByText("Sending execution request…")).toBeTruthy();
  expect(screen.getByRole("timer")).toBeTruthy();
  expect(
    screen.getByText(/Output will be available in Execution Insights/),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: /View in Execution Insights/ }),
  ).toBeNull();
  expect(screen.queryByRole("tablist")).toBeNull();
});
it("shows a concise failed outcome and opens details only after clicking", () => {
  const view = vi.fn();
  render(
    <WorkbenchExecution
      execution={run}
      submitting={false}
      loading={false}
      onView={view}
      onRefresh={() => {}}
    />,
  );
  expect(view).not.toHaveBeenCalled();
  expect(screen.getByText("Script execution failed")).toBeTruthy();
  expect(screen.queryByText("private raw terminal error")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "View in Execution Insights →" }),
  );
  expect(view).toHaveBeenCalledOnce();
});
it("distinguishes a status-read failure from a running or failed script", () => {
  const retry = vi.fn();
  render(
    <WorkbenchExecution
      execution={null}
      submitting={false}
      loading
      updateError="Read failed"
      onView={() => {}}
      onRefresh={retry}
    />,
  );
  expect(screen.getByText("Loading selected execution status…")).toBeTruthy();
  expect(screen.getByText(/does not indicate script failure/)).toBeTruthy();
  expect(screen.queryByRole("timer")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry status update" }));
  expect(retry).toHaveBeenCalledOnce();
});
