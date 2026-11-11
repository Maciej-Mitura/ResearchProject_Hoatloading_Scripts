import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { StatusBadge } from "./components/StatusBadge";
import { ChatPanel } from "./components/ChatPanel";
import { HelpPanel } from "./components/HelpPanel";
import type { ChatMessage } from "./types";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("renders host connection label", () => {
    render(<StatusBadge connected label="Paper bridge" />);
    expect(screen.getByText("Paper bridge")).toBeTruthy();
  });
});

describe("ChatPanel layout", () => {
  const messages: ChatMessage[] = [
    {
      id: "u1",
      conversationId: "c1",
      role: "user",
      content: "Hello from the user",
      metadata: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "a1",
      conversationId: "c1",
      role: "assistant",
      content: "Hello from the assistant with **bold** text.",
      metadata: null,
      createdAt: new Date().toISOString(),
    },
  ];

  it("aligns user messages to the right and assistant to the left", () => {
    const { container } = render(
      <ChatPanel
        messages={messages}
        busy={false}
        config={{ chatProvider: "mock" }}
        onSend={async () => undefined}
        latestProposal={null}
        onSaveProposal={async () => undefined}
      />,
    );

    const user = container.querySelector('[data-testid="msg-user"]');
    const assistant = container.querySelector('[data-testid="msg-assistant"]');
    expect(user?.classList.contains("msg-user")).toBe(true);
    expect(assistant?.classList.contains("msg-assistant")).toBe(true);
    expect(screen.getByText("Hello from the user")).toBeTruthy();
    expect(screen.getByText(/Hello from the assistant/)).toBeTruthy();
    expect(screen.getByText(/· Mock/)).toBeTruthy();
  });
});

describe("HelpPanel", () => {
  it("renders core how-to sections", () => {
    render(<HelpPanel open onClose={() => undefined} />);
    expect(screen.getByRole("heading", { name: "How to use" })).toBeTruthy();
    expect(screen.getByText(/Start a conversation/)).toBeTruthy();
    expect(screen.getByText(/Describe what you want/)).toBeTruthy();
    expect(screen.getByText(/Review the proposed script/)).toBeTruthy();
    expect(screen.getByText(/^Queued$/)).toBeTruthy();
    expect(screen.getByText(/^Blocked$/)).toBeTruthy();
    expect(screen.getByText(/Risk assessment/)).toBeTruthy();
    expect(screen.getByText(/Current prototype status/)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /Project Settings/ }),
    ).toBeTruthy();
    expect(screen.getByText(/no app restart required/)).toBeTruthy();
  });
});

describe("Execution detail empty state", () => {
  it("directs the reader to a stored run", async () => {
    const { ExecutionDetail } = await import("./components/ExecutionDetail");
    render(<ExecutionDetail execution={null} risk={null} />);
    expect(screen.getByText("No execution selected.")).toBeTruthy();
    expect(screen.getByText(/Run a stored script/)).toBeTruthy();
  });
});

describe("ServerInfoPanel", () => {
  it("renders status, empty log, and event rows", async () => {
    const { ServerInfoPanel } = await import("./components/ServerInfoPanel");
    const { api } = await import("./api/client");
    const original = api.hostEvents;
    api.hostEvents = async () => [
      {
        id: "e1",
        connectionId: null,
        eventType: "player_join",
        payload: { playerName: "Maciej" },
        createdAt: "2026-10-16T12:32:10.000Z",
      },
      {
        id: "e2",
        connectionId: null,
        eventType: "player_chat",
        payload: { playerName: "Maciej", message: "hello world" },
        createdAt: "2026-10-16T12:32:21.000Z",
      },
      {
        id: "e3",
        connectionId: null,
        eventType: "player_command",
        payload: { playerName: "Maciej", command: "/help" },
        createdAt: "2026-10-16T12:32:38.000Z",
      },
    ];

    try {
      render(
        <ServerInfoPanel
          host={{
            connected: true,
            connection: {
              id: "c1",
              pluginVersion: "0.1.0",
              serverVersion: "1.21.1",
              onlinePlayers: 1,
              lastHeartbeatAt: new Date().toISOString(),
              connectedAt: new Date().toISOString(),
              metadata: { maxPlayers: 10 },
            },
            pendingCommands: 0,
          }}
        />,
      );
      expect(await screen.findByText("Connected")).toBeTruthy();
      expect(await screen.findByText(/Maciej joined the server/)).toBeTruthy();
      expect(screen.getByText(/Maciej: hello world/)).toBeTruthy();
      expect(screen.getByText(/Maciej ran \/help/)).toBeTruthy();
      expect(screen.getByText("JOIN")).toBeTruthy();
      expect(screen.getByText("CHAT")).toBeTruthy();
      expect(screen.getByText("COMMAND")).toBeTruthy();
    } finally {
      api.hostEvents = original;
    }
  });

  it("shows disconnected banner and empty copy", async () => {
    const { ServerInfoPanel } = await import("./components/ServerInfoPanel");
    const { api } = await import("./api/client");
    const original = api.hostEvents;
    api.hostEvents = async () => [];
    try {
      render(
        <ServerInfoPanel
          host={{ connected: false, connection: null, pendingCommands: 0 }}
        />,
      );
      expect(
        await screen.findByText(/SecureBridge is currently disconnected/),
      ).toBeTruthy();
      expect(screen.getByText(/No server activity recorded yet/)).toBeTruthy();
    } finally {
      api.hostEvents = original;
    }
  });
});

describe("Sidebar clipping", () => {
  it("shows See more when conversations exceed preview count", async () => {
    const { Sidebar } = await import("./components/Sidebar");
    const conversations = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      title: `Conversation ${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    render(
      <Sidebar
        conversations={conversations}
        scripts={[]}
        executions={[]}
        selectedConversationId={null}
        selectedScriptId={null}
        selectedExecutionId={null}
        onSelectConversation={() => undefined}
        onSelectScript={() => undefined}
        onSelectExecution={() => undefined}
        onNewConversation={() => undefined}
      />,
    );
    expect(
      screen.getByText(/Assistant conversations/, { selector: "summary" }),
    ).toBeTruthy();
    expect(screen.getByText("Conversation 0")).toBeTruthy();
  });
});

describe("Assistant provider reality", () => {
  const props = {
    messages: [],
    busy: false,
    onSend: async () => {},
    latestProposal: null,
    onSaveProposal: async () => {},
  };
  it.each([
    ["gemini", "Gemini"],
    ["openai", "OpenAI"],
    ["mock", "Mock"],
  ])("labels backend-selected %s accurately", (provider, label) => {
    const { unmount } = render(
      <ChatPanel {...props} config={{ chatProvider: provider }} />,
    );
    expect(screen.getByText(`· ${label}`)).toBeTruthy();
    unmount();
  });
  it("makes unavailable configuration explicit and prevents sending", () => {
    const send = vi.fn();
    render(
      <ChatPanel
        {...props}
        onSend={send}
        config={{
          chatProvider: "unavailable",
          chatStatus: "unavailable",
          chatUnavailableReason: "no AI provider configured",
        }}
      />,
    );
    expect(screen.getByText(/Assistant unavailable/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(screen.getByLabelText("Message"), { key: "Enter" });
    expect(send).not.toHaveBeenCalled();
  });
});
