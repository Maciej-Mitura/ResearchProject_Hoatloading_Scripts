/**
 * ChatProvider abstraction.
 * The rest of the app must not know whether the provider is mock or real.
 * Provider selection happens only in createChatProvider().
 */

import type { ScriptProposal } from "../domain/types.ts";
import { ChatProviderError } from "./chat-errors.ts";
import { GeminiChatProvider } from "./gemini.ts";
import { OpenAIChatProvider } from "./openai.ts";

export interface ChatTurnInput {
  conversationId: string;
  userMessage: string;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  /**
   * Provider-independent system instruction built by AssistantContextBuilder.
   * Includes assistant policy, effective project settings, host capabilities,
   * and dynamic host state. Providers must not invent project facts themselves.
   */
  systemInstruction?: string;
}

export interface ChatTurnResult {
  content: string;
  proposal?: ScriptProposal;
  metadata?: Record<string, unknown>;
}

export interface ChatProvider {
  readonly name: string;
  /** Optional model id for public config (real LLM providers). */
  readonly model?: string;
  readonly unavailableReason?: string;
  respond(input: ChatTurnInput): Promise<ChatTurnResult>;
}

export { ChatProviderError };

/**
 * Deterministic keyword-based demo provider for local PoC.
 */
export class MockChatProvider implements ChatProvider {
  readonly name = "mock";

  async respond(input: ChatTurnInput): Promise<ChatTurnResult> {
    const text = input.userMessage.toLowerCase();
    const historyText = input.history.map((m) => m.content.toLowerCase()).join("\n");
    const welcomeContext =
      (text.includes("welcome") && (text.includes("join") || text.includes("player"))) ||
      text.includes("welcome message") || text.includes("broadcast") ||
      (historyText.includes("welcome") &&
        (historyText.includes("join") || historyText.includes("player")));

    // Scenario: a manually run broadcast; persistent event subscriptions are unavailable.
    if (welcomeContext) {
      const clarificationPending = input.history.some(
        (m) => m.role === "assistant" && m.content.toLowerCase().includes("clarification"),
      );
      const isAffirmation =
        text.includes("yes") ||
        text.includes("ok") ||
        text.includes("create it") ||
        text.includes("include");

      if (!clarificationPending && !isAffirmation && !text.includes("create it")) {
        return {
          content:
            "Player event subscriptions and player-name APIs are not implemented.\n\n" +
            "Clarification: would you like a one-shot welcome broadcast instead? Reply yes or create it; run it manually with the host-chat profile.",
          metadata: { scenario: "welcome", phase: "clarify" },
        };
      }

      const source = `import { host } from "host";\nawait host.chat.broadcast("Welcome to the server!");\n`;

      return {
        content:
          "Understood. I've prepared a one-shot welcome broadcast, not an event subscription.\n\n" +
          "You can save this proposal as a draft script from the inspector. " +
          "Select host-chat and use Run. Docker/Deno executes the stored source when EXECUTION_PROVIDER=docker; the mock execution provider only simulates it. Queued acceptance is not Paper confirmation.",
        proposal: {
          name: "welcome-message",
          description: "Broadcast a welcome message once when manually run with host-chat.",
          language: "javascript",
          source,
        },
        metadata: { scenario: "welcome", phase: "propose" },
      };
    }

    // Status/player listing is backend-only, not a sandbox SDK capability.
    if (text.includes("status") || text.includes("online") || text.includes("players")) {
      return {
        content: "Use Server Info for observed Paper status and player information. " +
          "Those bridge capabilities are backend-only; sandbox scripts cannot query them. " +
          "The current sandbox SDK exposes only host.chat.broadcast with the host-chat profile.",
        metadata: { scenario: "host-status", supportedInSandbox: false },
      };
    }

    // Scenario: calculation
    if (text.includes("calculat") || text.includes("math") || text.includes("2+2")) {
      return {
        content: "Here is a minimal calculation script proposal (sample data only).",
        proposal: {
          name: "simple-calculation",
          description: "Harmless arithmetic demo.",
          language: "javascript",
          source: `console.log(2 + 2);\n`,
        },
        metadata: { scenario: "calculation" },
      };
    }

    return {
      content:
        "I'm a mock assistant for this research PoC. Try asking me to:\n" +
        "• create a one-shot welcome broadcast (host-chat profile)\n" +
        "• explain the backend-only Server Info view\n" +
        "• create a simple calculation script\n\n" +
        "I don't call a real generative AI API.",
      metadata: { scenario: "fallback" },
    };
  }
}

/**
 * Factory — single place for provider selection.
 */
export function createChatProvider(kind: string = ""): ChatProvider {
  const normalized = kind.trim().toLowerCase();
  switch (normalized) {
    case "mock":
      return new MockChatProvider();
    case "gemini": {
      const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim() ?? "";
      if (!apiKey) {
        throw new ChatProviderError(
          "config",
          "CHAT_PROVIDER=gemini requires GEMINI_API_KEY to be set",
        );
      }
      const model = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-3.8-flash";
      return new GeminiChatProvider({ apiKey, model });
    }
    case "openai": {
      // Kept for optional local experiments; Gemini is the preferred real provider.
      const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";
      if (!apiKey) {
        throw new ChatProviderError(
          "config",
          "CHAT_PROVIDER=openai requires OPENAI_API_KEY to be set",
        );
      }
      const model = Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-5.5";
      return new OpenAIChatProvider({ apiKey, model });
    }
    default:
      throw new ChatProviderError("config", normalized ? "Unsupported assistant provider configuration" : "No AI provider configured. Set CHAT_PROVIDER to gemini, openai, or explicitly mock.");
  }
}

/** Keep execution/inspection available when assistant configuration is unavailable. */
export class UnavailableChatProvider implements ChatProvider {
  readonly name = "unavailable";
  constructor(readonly unavailableReason: string) {}
  respond(_input: ChatTurnInput): Promise<ChatTurnResult> {
    return Promise.reject(new ChatProviderError("config", this.unavailableReason));
  }
}
export function configureChatProvider(kind?: string): ChatProvider {
  try { return createChatProvider(kind); }
  catch (err) {
    if (err instanceof ChatProviderError && err.category === "config") return new UnavailableChatProvider(err.message);
    throw err;
  }
}
