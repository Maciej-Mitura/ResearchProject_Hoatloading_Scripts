import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ServerInfoPanel } from "./components/ServerInfoPanel";
import { Inspector } from "./components/Inspector";
import { api } from "./api/client";
import type { Execution } from "./types";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("shows confirmed world broadcasts in All, Chat and Commands and requests filtered history", async () => {
  const load = vi.spyOn(api, "hostEvents").mockResolvedValue([
    { id: "broadcast", connectionId: null, eventType: "server_broadcast", payload: { success: true, broadcastMessage: "Hello world every few seconds" }, createdAt: "2026-10-28T01:00:00Z" },
    { id: "failed", connectionId: null, eventType: "command_result", payload: { success: false, message: "failed" }, createdAt: "2026-10-28T01:00:01Z" },
  ]);
  render(<ServerInfoPanel host={{ connected: false, connection: null, pendingCommands: 0 }} />);
  expect(await screen.findByText("[SecureBridge] Hello world every few seconds")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Chat" }));
  await waitFor(() => expect(load).toHaveBeenLastCalledWith(100, "chat"));
  expect(screen.getByText("[SecureBridge] Hello world every few seconds")).toBeTruthy();
  expect(screen.queryByText("Host command failed: failed")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Commands" }));
  await waitFor(() => expect(load).toHaveBeenLastCalledWith(100, "commands"));
  expect(screen.getByText("[SecureBridge] Hello world every few seconds")).toBeTruthy();
});
it("expands the event timeline and panel while preserving runtime detail and controls", () => {
  const execution: Execution = { id: "run-1", scriptId: "s1", scriptVersionId: "v1", status: "completed", riskAssessmentId: null, errorMessage: null, result: null, startedAt: null, finishedAt: null, createdAt: "2026-10-28T00:00:00Z", updatedAt: "2026-10-28T00:00:00Z" };
  const { container } = render(<Inspector script={null} version={null} execution={execution} executionEvents={[]} risk={null} securityEvents={[]} host={null} running={false} onRun={() => undefined} onBroadcast={() => undefined} />);
  const expand = screen.getByRole("button", { name: "Expand timeline" });
  fireEvent.click(expand);
  expect(screen.getByRole("button", { name: "Collapse timeline" }).getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelector(".timeline-expanded")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Widen panel" }));
  expect(container.querySelector(".inspector-wide")).toBeTruthy();
  expect(screen.getByText("Runtime, permissions & identifiers")).toBeTruthy();
  expect(screen.getAllByRole("tab")).toHaveLength(4);
});
