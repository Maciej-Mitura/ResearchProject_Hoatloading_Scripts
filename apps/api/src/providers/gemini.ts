/**
 * Gemini ChatProvider — Generative Language REST API (no Node-only SDK).
 * Uses fetch so Deno does not pull in gcp-metadata / google-auth-library.
 */

import { ASSISTANT_INSTRUCTIONS } from "./chat-instructions.ts";
import { ChatProviderError } from "./chat-errors.ts";
import type { ChatProvider, ChatTurnInput, ChatTurnResult } from "./chat.ts";

export interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface GeminiGenerateParams {
  model: string;
  contents: GeminiContent[];
  systemInstruction: string;
  apiKey: string;
}

export type GeminiGenerateFn = (params: GeminiGenerateParams) => Promise<string>;

export interface GeminiChatProviderOptions {
  apiKey: string;
  model: string;
  /** Optional injectable generate function for tests. */
  generate?: GeminiGenerateFn;
}

const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiChatProvider implements ChatProvider {
  readonly name = "gemini";
  readonly model: string;
  #apiKey: string;
  #generate: GeminiGenerateFn;

  constructor(opts: GeminiChatProviderOptions) {
    if (!opts.apiKey?.trim()) {
      throw new ChatProviderError(
        "config",
        "GEMINI_API_KEY is required when CHAT_PROVIDER=gemini",
      );
    }
    this.model = opts.model?.trim() || "gemini-3.8-flash";
    this.#apiKey = opts.apiKey.trim();
    this.#generate = opts.generate ?? defaultGeminiGenerate;
  }

  async respond(input: ChatTurnInput): Promise<ChatTurnResult> {
    const contents: GeminiContent[] = [
      ...input.history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
          parts: [{ text: m.content }],
        })),
      {
        role: "user",
        parts: [{ text: input.userMessage }],
      },
    ];

    const systemInstruction = input.systemInstruction?.trim() ||
      ASSISTANT_INSTRUCTIONS;

    let text: string;
    try {
      text = await this.#generate({
        model: this.model,
        contents,
        systemInstruction,
        apiKey: this.#apiKey,
      });
    } catch (err) {
      if (err instanceof ChatProviderError) throw err;
      throw mapGeminiError(err);
    }

    text = text.trim();
    if (!text) {
      throw new ChatProviderError("empty", "Model returned an empty response");
    }

    return {
      content: text,
      metadata: {
        provider: "gemini",
        model: this.model,
      },
    };
  }
}

async function defaultGeminiGenerate(params: GeminiGenerateParams): Promise<string> {
  const url =
    `${DEFAULT_BASE}/models/${encodeURIComponent(params.model)}:generateContent` +
    `?key=${encodeURIComponent(params.apiKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: params.systemInstruction }],
        },
        contents: params.contents,
      }),
    });
  } catch (err) {
    throw mapGeminiError(err);
  }

  const raw = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? JSON.parse(raw) as Record<string, unknown> : {};
  } catch {
    body = { error: { message: raw.slice(0, 200) } };
  }

  if (!res.ok) {
    const errObj = body.error as { message?: string; status?: string; code?: number } | undefined;
    const message = sanitizeMessage(errObj?.message ?? `Gemini HTTP ${res.status}`);
    console.error("[chat/gemini] upstream error", {
      httpStatus: res.status,
      model: params.model,
      apiStatus: errObj?.status,
      message,
    });
    throw new ChatProviderError(
      categorizeHttp(res.status, errObj?.status, errObj?.message),
      message,
      res.status,
    );
  }

  return extractText(body);
}

function extractText(body: Record<string, unknown>): string {
  const candidates = body.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const content = (candidates[0] as { content?: { parts?: unknown } })?.content;
  const parts = content?.parts;
  if (!Array.isArray(parts)) return "";
  const texts: string[] = [];
  for (const part of parts) {
    if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
      texts.push((part as { text: string }).text);
    }
  }
  return texts.join("\n");
}

function categorizeHttp(
  status: number,
  apiStatus?: string,
  message?: string,
): ChatProviderError["category"] {
  const combined = `${apiStatus ?? ""} ${message ?? ""}`.toLowerCase();
  if (status === 401 || status === 403 || combined.includes("api key") ||
    combined.includes("permission") || combined.includes("unauthenticated")) {
    return "auth";
  }
  if (status === 404 || combined.includes("not_found") || combined.includes("model")) {
    return "model";
  }
  if (status === 429 || combined.includes("resource_exhausted") || combined.includes("rate")) {
    return "rate_limit";
  }
  if (status >= 500) return "server";
  return "unknown";
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]")
    .replace(/AQ\.[0-9A-Za-z_-]+/g, "[redacted]");
}

function mapGeminiError(err: unknown): ChatProviderError {
  if (err instanceof ChatProviderError) return err;
  const anyErr = err as { message?: string; name?: string };
  const msg = sanitizeMessage(anyErr.message ?? "Gemini request failed");
  if (
    anyErr.name === "AbortError" ||
    msg.toLowerCase().includes("timeout")
  ) {
    return new ChatProviderError("timeout", "Gemini request timed out");
  }
  if (
    msg.toLowerCase().includes("network") ||
    msg.toLowerCase().includes("fetch failed")
  ) {
    return new ChatProviderError("network", "Network failure talking to Gemini");
  }
  console.error("[chat/gemini] request failed", { category: "unknown" });
  return new ChatProviderError("unknown", "Gemini request failed");
}
