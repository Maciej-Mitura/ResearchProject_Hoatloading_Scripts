import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "./App";
import { api } from "./api/client";
import { messageProposals, newestFirst } from "./workbench";
import type { ChatMessage, Script, Execution } from "./types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const message: ChatMessage = { id: "message-a", conversationId: "chat-a", role: "assistant", content: '```javascript\nconsole.log("hello");\n```', metadata: null, createdAt: "2026-10-20T00:00:00Z" };
const script = (id: string, conversationId: string, date: string): Script => ({ id, conversationId, sourceMessageId: "message-a", name: id, description: null, language: "javascript", status: "draft", currentVersionId: "v1", createdAt: date, updatedAt: date });
const old = script("old-script", "chat-a", "2026-10-20T00:00:00Z");
const recent = script("new-script", "chat-b", "2026-10-21T00:00:00Z");
const run = (id: string, scriptId: string, date: string): Execution => ({ id, scriptId, scriptVersionId: "v1", status: "completed", riskAssessmentId: null, errorMessage: null, result: null, startedAt: null, finishedAt: null, createdAt: date, updatedAt: date });
const runs = [run("old-run", old.id, old.createdAt), run("new-run", recent.id, recent.createdAt)];
function mockApi() {
  vi.spyOn(api, "listConversations").mockResolvedValue([
    { id: "chat-a", title: "Chat A", createdAt: old.createdAt, updatedAt: old.createdAt },
    { id: "chat-b", title: "Chat B", createdAt: recent.createdAt, updatedAt: recent.createdAt },
    { id: "empty-chat", title: "Empty chat", createdAt: recent.createdAt, updatedAt: recent.createdAt },
  ]);
  vi.spyOn(api, "listScripts").mockResolvedValue([old, recent]);
  vi.spyOn(api, "listExecutions").mockResolvedValue(runs);
  vi.spyOn(api, "hostStatus").mockResolvedValue({ connected: false, connection: null, pendingCommands: 0 });
  vi.spyOn(api, "health").mockResolvedValue({ status: "ok" });
  vi.spyOn(api, "publicConfig").mockResolvedValue({ chatProvider: "gemini", executionProvider: "docker" });
  vi.spyOn(api, "listMessages").mockImplementation(async (id) => id === "chat-a" ? [message] : []);
  vi.spyOn(api, "getScript").mockImplementation(async (id) => ({ script: id === old.id ? old : recent, currentVersion: { id: "v1", scriptId: id, versionNumber: 1, source: 'console.log("hello");', language: "javascript", changelog: null, createdAt: old.createdAt }, versions: [] }));
  vi.spyOn(api, "getExecution").mockImplementation(async (id) => ({ execution: runs.find((item) => item.id === id)!, events: [] }));
  vi.spyOn(api, "securityEvents").mockResolvedValue([]);
  vi.spyOn(api, "riskAssessments").mockResolvedValue([]);
}

describe("workbench navigation and saving", () => {
  it("sorts by creation time without mutating input", () => {
    const items = [old, recent];
    expect(newestFirst(items).map((item) => item.id)).toEqual([recent.id, old.id]);
    expect(items[0]).toBe(old);
  });
  it("recovers code from historical replies and ignores user and unsupported blocks", () => {
    expect(messageProposals(message)[0]?.source).toBe('console.log("hello");');
    expect(messageProposals({ ...message, role: "user" })).toEqual([]);
    expect(messageProposals({ ...message, content: "```bash\necho hello\n```" })).toEqual([]);
    expect(messageProposals({ ...message, content: "```ts\nconst x: number = 1;\n```" })[0]?.language).toBe("typescript");
  });
  it("orders histories and synchronizes chat, script, and execution; clears unrelated context", async () => {
    mockApi(); render(<App />);
    await screen.findByRole("button", { name: /new-script/ });
    const sidebar = screen.getByRole("complementary", { name: "Navigation" });
    const buttons = within(sidebar).getAllByRole("button");
    expect(buttons.findIndex((b) => b.textContent?.includes("new-script"))).toBeLessThan(buttons.findIndex((b) => b.textContent?.includes("old-script")));
    expect(buttons.findIndex((b) => b.textContent?.includes("new-run"))).toBeLessThan(buttons.findIndex((b) => b.textContent?.includes("old-run")));
    fireEvent.click(screen.getByRole("button", { name: /Chat A/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /old-script/ }).classList.contains("active")).toBe(true));
    await screen.findByText("old-run");
    fireEvent.click(screen.getByRole("button", { name: /new-script/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Chat B/ }).classList.contains("active")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /old-run/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Chat A/ }).classList.contains("active")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /Empty chat/ }));
    await screen.findByText("No execution selected.");
    expect(screen.getByText("Select a script.")).toBeTruthy();
  });
  it("offers saving in a reopened ordinary AI reply and persists its conversation/message link", async () => {
    mockApi();
    vi.mocked(api.listScripts).mockResolvedValue([]);
    const create = vi.spyOn(api, "createScript").mockResolvedValue({ script: old, version: { id: "v1", scriptId: old.id, versionNumber: 1, language: "javascript", source: 'console.log("hello");', changelog: null, createdAt: old.createdAt } });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Chat A/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Save script as draft" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "chat-a", sourceMessageId: "message-a", source: 'console.log("hello");' })));
  });
});
