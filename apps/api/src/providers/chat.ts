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
      text.includes("welcome message") ||
      (historyText.includes("welcome") &&
        (historyText.includes("join") || historyText.includes("player")));

    // Scenario: welcome message on join (supports clarify → propose turns)
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
            "I understand you want a script that sends a welcome message when a player joins.\n\n" +
            "Clarification: should the message include the player's name? Reply with yes/no, or just say \"create it\".",
          metadata: { scenario: "welcome", phase: "clarify" },
        };
      }

      const includeName = !text.includes("no") && !text.includes("without name");
      const source = includeName
        ? `// welcome-message.js — proposed draft (not executed)\nexport function onPlayerJoin(player) {\n  host.broadcast(\`Welcome, \${player.name}!\`);\n}\n`
        : `// welcome-message.js — proposed draft (not executed)\nexport function onPlayerJoin(_player) {\n  host.broadcast("Welcome to the server!");\n}\n`;

      return {
        content:
          "Understood. I've prepared a draft JavaScript extension that broadcasts a welcome on player join.\n\n" +
          "You can save this proposal as a draft script from the inspector. " +
          "Note: execution is currently mocked — arbitrary code is not run in this PoC foundation.",
        proposal: {
          name: "welcome-message",
          description: "Broadcast a welcome message when a player joins.",
          language: "javascript",
          source,
        },
        metadata: { scenario: "welcome", phase: "propose" },
      };
    }

    // Scenario: host status
    if (text.includes("status") || text.includes("online") || text.includes("players")) {
      return {
        content:
          "I can draft a script that requests host status via the restricted host API " +
          "(request_status / request_player_list only).",
        proposal: {
          name: "host-status-query",
          description: "Query host status through the allowlisted bridge API.",
          language: "typescript",
          source:
            `// host-status-query.ts — proposed draft (not executed)\n` +
            `export async function run(host: HostApi) {\n  return host.requestStatus();\n}\n`,
        },
        metadata: { scenario: "host-status" },
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
          source: `// simple-calculation.js — proposed draft\nexport function run() {\n  return 2 + 2;\n}\n`,
        },
        metadata: { scenario: "calculation" },
      };
    }

    return {
      content:
        "I'm a mock assistant for this research PoC. Try asking me to:\n" +
        "• create a welcome message when a player joins\n" +
        "• query host status / online players\n" +
        "• create a simple calculation script\n\n" +
        "I don't call a real generative AI API.",
      metadata: { scenario: "fallback" },
    };
  }
}

/**
 * Factory — single place for provider selection.
 */
export function createChatProvider(kind: string = "mock"): ChatProvider {
  const normalized = (kind || "mock").trim().toLowerCase();
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
      console.warn(`[chat] unknown provider "${kind}", falling back to mock`);
      return new MockChatProvider();
  }
}
