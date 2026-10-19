/**
 * OpenAI ChatProvider — Responses API only.
 * Keeps SDK types inside this module; returns ChatTurnResult to the rest of the app.
 */

import OpenAI from "npm:openai@5.12.2";
import { ASSISTANT_INSTRUCTIONS } from "./chat-instructions.ts";
import { ChatProviderError } from "./chat-errors.ts";
import type { ChatProvider, ChatTurnInput, ChatTurnResult } from "./chat.ts";

export { ChatProviderError };

/** Minimal surface used by this provider (real SDK or test double). */
export interface OpenAIResponsesClient {
  responses: {
    create: (body: {
      model: string;
      instructions: string;
      input: Array<{ role: string; content: string }>;
    }) => Promise<{
      id?: string;
      output_text?: string;
      output?: unknown;
    }>;
  };
}

export interface OpenAIChatProviderOptions {
  apiKey: string;
  model: string;
  /** Optional injectable client for tests. */
  client?: OpenAIResponsesClient;
  timeoutMs?: number;
}

export class OpenAIChatProvider implements ChatProvider {
  readonly name = "openai";
  readonly model: string;
  #client: OpenAIResponsesClient;
  #timeoutMs: number;

  constructor(opts: OpenAIChatProviderOptions) {
    if (!opts.apiKey?.trim()) {
      throw new ChatProviderError(
        "config",
        "OPENAI_API_KEY is required when CHAT_PROVIDER=openai",
      );
    }
    this.model = opts.model?.trim() || "gpt-5.5";
    this.#timeoutMs = opts.timeoutMs ?? 60_000;
    this.#client = opts.client ??
      new OpenAI({
        apiKey: opts.apiKey,
        timeout: this.#timeoutMs,
        maxRetries: 1,
      }) as unknown as OpenAIResponsesClient;
  }

  async respond(input: ChatTurnInput): Promise<ChatTurnResult> {
    const messages = [
      ...input.history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user" as const, content: input.userMessage },
    ];

    let response: {
      id?: string;
      output_text?: string;
      output?: unknown;
    };
    try {
      response = await this.#client.responses.create({
        model: this.model,
        instructions: input.systemInstruction?.trim() || ASSISTANT_INSTRUCTIONS,
        input: messages,
      });
    } catch (err) {
      throw mapOpenAiError(err);
    }

    const text = extractOutputText(response).trim();
    if (!text) {
      throw new ChatProviderError(
        "empty",
        "Model returned an empty response",
        undefined,
        requestIdOf(response),
      );
    }

    return {
      content: text,
      metadata: {
        provider: "openai",
        model: this.model,
        responseId: typeof response.id === "string" ? response.id : undefined,
      },
    };
  }
}

function extractOutputText(response: {
  output_text?: unknown;
  output?: unknown;
}): string {
  if (typeof response.output_text === "string") return response.output_text;

  const output = response.output;
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const typed = item as { type?: string; content?: unknown };
    if (typed.type !== "message" || !Array.isArray(typed.content)) continue;
    for (const block of typed.content) {
      if (
        block &&
        typeof block === "object" &&
        (block as { type?: string }).type === "output_text" &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        parts.push((block as { text: string }).text);
      }
    }
  }
  return parts.join("\n");
}

function requestIdOf(response: { id?: unknown }): string | undefined {
  return typeof response.id === "string" ? response.id : undefined;
}

function mapOpenAiError(err: unknown): ChatProviderError {
  const anyErr = err as {
    status?: number;
    statusCode?: number;
    code?: string;
    message?: string;
    name?: string;
    headers?: { get?: (k: string) => string | null };
    error?: { message?: string; code?: string; type?: string };
    requestID?: string;
    request_id?: string;
  };

  const status = anyErr.status ?? anyErr.statusCode;
  const requestId = anyErr.requestID ?? anyErr.request_id ??
    anyErr.headers?.get?.("x-request-id") ?? undefined;
  const code = (anyErr.code ?? anyErr.error?.code ?? "").toLowerCase();
  const msg = (anyErr.error?.message ?? anyErr.message ?? "OpenAI request failed")
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]");

  if (
    status === 401 || status === 403 || code.includes("invalid_api_key") ||
    code.includes("authentication")
  ) {
    return new ChatProviderError("auth", "OpenAI authentication failed", status, requestId);
  }
  if (status === 404 || code.includes("model") || msg.toLowerCase().includes("model")) {
    return new ChatProviderError(
      "model",
      "Configured OpenAI model is unavailable",
      status,
      requestId,
    );
  }
  if (status === 429 || code.includes("rate")) {
    return new ChatProviderError("rate_limit", "OpenAI rate limit exceeded", status, requestId);
  }
  if (
    anyErr.name === "APIConnectionTimeoutError" ||
    code.includes("timeout") ||
    msg.toLowerCase().includes("timeout")
  ) {
    return new ChatProviderError("timeout", "OpenAI request timed out", status, requestId);
  }
  if (
    anyErr.name === "APIConnectionError" ||
    code.includes("connection") ||
    msg.toLowerCase().includes("network")
  ) {
    return new ChatProviderError("network", "Network failure talking to OpenAI", status, requestId);
  }
  if (status && status >= 500) {
    return new ChatProviderError("server", "OpenAI service error", status, requestId);
  }

  console.error("[chat/openai] request failed", {
    category: "unknown",
    httpStatus: status,
    requestId,
  });
  return new ChatProviderError("unknown", "OpenAI request failed", status, requestId);
}
