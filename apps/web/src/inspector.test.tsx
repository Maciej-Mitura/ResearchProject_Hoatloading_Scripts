import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ServerInfoPanel } from "./components/ServerInfoPanel";
import { ExecutionDetail } from "./components/ExecutionDetail";
import { api } from "./api/client";
import type { Execution } from "./types";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("shows confirmed world broadcasts in All, Chat and Commands and requests filtered history", async () => {
  const load = vi.spyOn(api, "hostEvents").mockResolvedValue([
    {
      id: "broadcast",
      connectionId: null,
      eventType: "server_broadcast",
      payload: {
        success: true,
        broadcastMessage: "Hello world every few seconds",
      },
      createdAt: "2026-10-28T01:00:00Z",
    },
    {
      id: "failed",
      connectionId: null,
      eventType: "command_result",
      payload: { success: false, message: "failed" },
      createdAt: "2026-10-28T01:00:01Z",
    },
  ]);
  render(
    <ServerInfoPanel
      host={{ connected: false, connection: null, pendingCommands: 0 }}
    />,
  );
  expect(
    await screen.findByText("[SecureBridge] Hello world every few seconds"),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Chat" }));
  await waitFor(() => expect(load).toHaveBeenLastCalledWith(100, "chat"));
  expect(
    screen.getByText("[SecureBridge] Hello world every few seconds"),
  ).toBeTruthy();
  expect(screen.queryByText("Host command failed: failed")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Commands" }));
  await waitFor(() => expect(load).toHaveBeenLastCalledWith(100, "commands"));
  expect(
    screen.getByText("[SecureBridge] Hello world every few seconds"),
  ).toBeTruthy();
});
it("expands the event timeline and panel while preserving runtime detail and controls", () => {
  const execution: Execution = {
    id: "run-1",
    scriptId: "s1",
    scriptVersionId: "v1",
    status: "completed",
    riskAssessmentId: null,
    errorMessage: null,
    result: null,
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-10-28T00:00:00Z",
    updatedAt: "2026-10-28T00:00:00Z",
  };
  render(<ExecutionDetail execution={execution} risk={null} />);
  expect(screen.getAllByRole("tab")).toHaveLength(4);
  fireEvent.click(screen.getByRole("tab", { name: "Runtime" }));
  expect(screen.getByText("Technical details & identifiers")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Copy Execution ID" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Timeline" }));
  expect(screen.getByText(/Reconstructed from PostgreSQL/)).toBeTruthy();
});

it("does not label an unknown host disconnected or unloaded history empty", () => {
  vi.spyOn(api, "hostEvents").mockReturnValue(new Promise(() => {}));
  render(<ServerInfoPanel host={null} />);
  expect(screen.getByText("Loading host activity…")).toBeTruthy();
  expect(
    screen.queryByText(/SecureBridge is currently disconnected/),
  ).toBeNull();
  expect(screen.queryByText(/No server activity recorded yet/)).toBeNull();
});
