import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { App } from "./App";
import { api, ApiError } from "./api/client";
import { messageProposals, newestFirst } from "./workbench";
import type { ChatMessage, Execution, Script } from "./types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = "";
});
const message: ChatMessage = {
  id: "message-a",
  conversationId: "chat-a",
  role: "assistant",
  content: '```javascript\nconsole.log("hello");\n```',
  metadata: null,
  createdAt: "2026-10-20T00:00:00Z",
};
const script = (id: string, conversationId: string, date: string): Script => ({
  id,
  conversationId,
  sourceMessageId: "message-a",
  name: id,
  description: null,
  language: "javascript",
  status: "draft",
  currentVersionId: "v1",
  createdAt: date,
  updatedAt: date,
});
const old = script("old-script", "chat-a", "2026-10-20T00:00:00Z");
const recent = script("new-script", "chat-b", "2026-10-21T00:00:00Z");
const run = (id: string, scriptId: string, date: string): Execution => ({
  id,
  scriptId,
  scriptVersionId: "v1",
  status: "completed",
  riskAssessmentId: null,
  errorMessage: null,
  result: null,
  startedAt: null,
  finishedAt: null,
  createdAt: date,
  updatedAt: date,
});
const runs = [
  run("old-run", old.id, old.createdAt),
  run("new-run", recent.id, recent.createdAt),
];
function mockApi() {
  vi.spyOn(api, "listConversations").mockResolvedValue([
    {
      id: "chat-a",
      title: "Chat A",
      createdAt: old.createdAt,
      updatedAt: old.createdAt,
    },
    {
      id: "chat-b",
      title: "Chat B",
      createdAt: recent.createdAt,
      updatedAt: recent.createdAt,
    },
    {
      id: "empty-chat",
      title: "Empty chat",
      createdAt: recent.createdAt,
      updatedAt: recent.createdAt,
    },
  ]);
  vi.spyOn(api, "listScripts").mockResolvedValue([old, recent]);
  vi.spyOn(api, "listExecutions").mockResolvedValue(runs);
  vi.spyOn(api, "executionHistory").mockResolvedValue({
    items: [],
    total: 0,
    limit: 100,
  });
  vi.spyOn(api, "hostStatus").mockResolvedValue({
    connected: false,
    connection: null,
    pendingCommands: 0,
  });
  vi.spyOn(api, "health").mockResolvedValue({ status: "ok" });
  vi.spyOn(api, "publicConfig").mockResolvedValue({
    chatProvider: "gemini",
    executionProvider: "docker",
  });
  vi.spyOn(api, "listMessages").mockImplementation(async (id) =>
    id === "chat-a" ? [message] : []
  );
  vi.spyOn(api, "getScript").mockImplementation(async (id) => ({
    script: id === old.id ? old : recent,
    currentVersion: {
      id: "v1",
      scriptId: id,
      versionNumber: 1,
      source: 'console.log("hello");',
      language: "javascript",
      changelog: null,
      createdAt: old.createdAt,
    },
    versions: [],
  }));
  vi.spyOn(api, "getExecution").mockImplementation(async (id) => ({
    execution: runs.find((item) => item.id === id)!,
    events: [],
  }));
  vi.spyOn(api, "securityEvents").mockResolvedValue([]);
  vi.spyOn(api, "riskAssessments").mockResolvedValue([]);
}

describe("workbench navigation and saving", () => {
  it("sorts by creation time without mutating input", () => {
    const items = [old, recent];
    expect(newestFirst(items).map((item) => item.id)).toEqual([
      recent.id,
      old.id,
    ]);
    expect(items[0]).toBe(old);
  });
  it("recovers code from historical replies and ignores user and unsupported blocks", () => {
    expect(messageProposals(message)[0]?.source).toBe('console.log("hello");');
    expect(messageProposals({ ...message, role: "user" })).toEqual([]);
    expect(
      messageProposals({ ...message, content: "```bash\necho hello\n```" }),
    ).toEqual([]);
    expect(
      messageProposals({
        ...message,
        content: "```ts\nconst x: number = 1;\n```",
      })[0]?.language,
    ).toBe("typescript");
  });
  it("orders histories and synchronizes chat, script, and execution; clears unrelated context", async () => {
    mockApi();
    render(<App />);
    await screen.findByRole("button", { name: /new-script/ });
    const sidebar = screen.getByRole("complementary", { name: "Navigation" });
    const buttons = within(sidebar).getAllByRole("button");
    expect(
      buttons.findIndex((b) => b.textContent?.includes("new-script")),
    ).toBeLessThan(
      buttons.findIndex((b) => b.textContent?.includes("old-script")),
    );
    fireEvent.click(screen.getByText(/Assistant conversations/));
    fireEvent.click(screen.getByRole("button", { name: /Chat A/ }));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /old-script/ })
          .classList.contains("active"),
      ).toBe(true)
    );
    await screen.findByTestId("history-old-run");
    fireEvent.click(screen.getByRole("button", { name: /new-script/ }));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /Chat B/ })
          .classList.contains("active"),
      ).toBe(true)
    );
    fireEvent.click(screen.getByRole("button", { name: /old-script/ }));
    fireEvent.click(await screen.findByTestId("history-old-run"));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /Chat A/ })
          .classList.contains("active"),
      ).toBe(true)
    );
    fireEvent.click(screen.getByRole("button", { name: /Empty chat/ }));
    await screen.findByText("Run a saved script to see its status here.");
    expect(screen.getByRole("textbox", { name: "Script name" })).toBeTruthy();
  });
  it("offers saving in a reopened ordinary AI reply and persists its conversation/message link", async () => {
    mockApi();
    vi.mocked(api.listScripts).mockResolvedValue([]);
    const create = vi.spyOn(api, "createScript").mockResolvedValue({
      script: old,
      version: {
        id: "v1",
        scriptId: old.id,
        versionNumber: 1,
        language: "javascript",
        source: 'console.log("hello");',
        changelog: null,
        createdAt: old.createdAt,
      },
    });
    render(<App />);
    await screen.findByText(/Assistant conversations/);
    fireEvent.click(screen.getByText(/Assistant conversations/));
    fireEvent.click(await screen.findByRole("button", { name: /Chat A/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Save script as draft" }),
    );
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "chat-a",
          sourceMessageId: "message-a",
          source: 'console.log("hello");',
        }),
      )
    );
  });
});

it("uses the execution-linked assessment instead of another assessment for the same run", async () => {
  mockApi();
  vi.mocked(api.getExecution).mockResolvedValue({
    execution: { ...runs[0]!, riskAssessmentId: "authoritative" },
    events: [],
  });
  const risk = {
    id: "other",
    scriptVersionId: "v1",
    executionId: "old-run",
    classification: "low" as const,
    score: 0,
    confidence: null,
    reasons: [],
    provider: "deterministic",
    assessmentStatus: "ok",
    createdAt: old.createdAt,
  };
  vi.mocked(api.riskAssessments).mockResolvedValue([
    risk,
    { ...risk, id: "authoritative", classification: "high" },
  ]);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /old-script/ }));
  fireEvent.click(
    await screen.findByRole("button", { name: "View in Execution Insights →" }),
  );
  await waitFor(() =>
    expect(screen.getAllByText("HIGH").length).toBeGreaterThan(0)
  );
  expect(screen.queryByText("LOW")).toBeNull();
});

it("starts a new page at its heading and moves keyboard focus to the workspace", async () => {
  mockApi();
  vi.spyOn(api, "hostEvents").mockResolvedValue([]);
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<App />);
  await screen.findByRole("button", { name: /new-script/ });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 400 });
  try {
    fireEvent.click(screen.getByRole("button", { name: "Host Activity" }));
    await screen.findByRole("heading", { name: "Host Activity" });
    expect(scroll).toHaveBeenCalledWith(0, 0);
    expect(document.activeElement).toBe(screen.getByRole("main"));
  } finally {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  }
});

it("clears the previous result and shows submission feedback before the API responds", async () => {
  mockApi();
  vi.spyOn(api, "startExecution").mockReturnValue(new Promise(() => {}));
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /old-script/ }));
  await screen.findByRole("button", { name: "View in Execution Insights →" });
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "▶ Run" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  );
  fireEvent.click(screen.getByRole("button", { name: "▶ Run" }));
  expect(await screen.findByText("Sending execution request…")).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Execution evidence" }),
  ).toBeNull();
});

it("ignores a late saved-version refresh after navigating to New script", async () => {
  mockApi();
  vi.spyOn(api, "patchScript").mockResolvedValue({
    ...old,
    name: "Renamed old script",
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /old-script/ }));
  await screen.findByRole("button", { name: "View in Execution Insights →" });
  const detail = await api.getScript(old.id);
  let resolve: (value: typeof detail) => void = () => {};
  let requested = false;
  vi.mocked(api.getScript).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
        requested = true;
      }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Script name" }), {
    target: { value: "Renamed old script" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(requested).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "＋ New script" }));
  await screen.findByRole("button", { name: "Create script" });
  await act(async () =>
    resolve({ ...detail, script: { ...old, name: "Renamed old script" } })
  );
  expect(screen.getByRole("button", { name: "Create script" })).toBeTruthy();
  expect(
    (screen.getByRole("textbox", { name: "Script name" }) as HTMLInputElement)
      .value,
  ).not.toBe("Renamed old script");
});

it("keeps Workbench compact and opens the same selected execution in Insights", async () => {
  mockApi();
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /old-script/ }));
  const view = await screen.findByRole("button", {
    name: "View in Execution Insights →",
  });
  expect(
    screen.queryByRole("heading", { name: "Execution evidence" }),
  ).toBeNull();
  expect(
    screen.queryByRole("tablist", { name: "Execution details" }),
  ).toBeNull();
  fireEvent.click(view);
  await screen.findByRole("heading", { name: "Execution evidence" });
  expect(window.location.hash).toBe("#insights");
  fireEvent.click(screen.getByRole("tab", { name: "Runtime" }));
  expect(screen.getByText("old-run", { exact: true })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Script" })).toBeNull();
  expect(screen.getByRole("combobox", { name: "Period" })).toBeTruthy();
});

function runManifest(
  reviewed: boolean,
): import("../../../packages/contracts/src/capabilities").CapabilityManifest {
  const requested = [{
    capability: "chat.broadcast",
    required: true,
    reason: "Run workflow test",
    constraints: { maxCalls: 1 },
  }];
  return {
    schemaVersion: 1,
    id: "run-manifest",
    scriptId: old.id,
    scriptVersionId: "v1",
    sourceSha256: "a".repeat(64),
    requested,
    warnings: [],
    review: reviewed
      ? {
        id: "run-review",
        approvedAt: old.createdAt,
        approved: requested,
        denied: [],
      }
      : null,
  };
}
function workflowApi(reviewed: boolean) {
  mockApi();
  const target = {
    ...old,
    id: "workflow-" + crypto.randomUUID(),
    name: "old-script workflow",
  };
  vi.mocked(api.listScripts).mockResolvedValue([target]);
  vi.mocked(api.listExecutions).mockResolvedValue([]);
  vi.mocked(api.getScript).mockResolvedValue({
    script: target,
    currentVersion: {
      id: "v1",
      scriptId: target.id,
      versionNumber: 1,
      source: 'console.log("hello");',
      language: "javascript",
      changelog: null,
      createdAt: target.createdAt,
    },
    versions: [],
  });
  vi.mocked(api.getManifest).mockResolvedValue({
    manifest: { ...runManifest(reviewed), scriptId: target.id },
    legacy: false,
  });
  return target;
}
it("does not submit an execution before permission review", async () => {
  workflowApi(false);
  const start = vi.spyOn(api, "startExecution");
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /old-script/ }));
  await screen.findByText("Permissions: Review required");
  fireEvent.click(screen.getByRole("button", { name: "▶ Run" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(start).not.toHaveBeenCalled();
  expect(document.body.textContent).not.toContain("ApiError:");
});
it("submits a reviewed version with the visible per-script mode", async () => {
  const target = workflowApi(true);
  const start = vi.spyOn(api, "startExecution").mockReturnValue(
    new Promise(() => {}),
  );
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /old-script/ }));
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Permission profile") as HTMLSelectElement).value,
    ).toBe("host-capabilities")
  );
  fireEvent.click(screen.getByRole("button", { name: "▶ Run" }));
  await waitFor(() =>
    expect(start).toHaveBeenCalledWith(target.id, {
      permissionProfile: "host-capabilities",
      scriptVersionId: "v1",
    })
  );
});
it("maps the exact backend rejection into review guidance even after a preflight race", async () => {
  workflowApi(true);
  const start = vi.spyOn(api, "startExecution").mockRejectedValue(
    new ApiError(
      "Error: This version uses capability manifests. Review permissions and select host-capabilities.",
      400,
    ),
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /old-script/ }));
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Permission profile") as HTMLSelectElement).value,
    ).toBe("host-capabilities")
  );
  fireEvent.click(screen.getByRole("button", { name: "▶ Run" }));
  await waitFor(() => expect(start).toHaveBeenCalledOnce());
  await screen.findByRole("dialog");
  expect(document.body.textContent).not.toContain("ApiError:");
  expect(document.body.textContent).not.toContain("select host-capabilities");
  expect(screen.getByText("Permission review required")).toBeTruthy();
});
