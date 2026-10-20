import { CHAT_BROADCAST } from "./config.ts";

export interface ValidationOk<T> {
  ok: true;
  value: T;
}

export interface ValidationErr {
  ok: false;
  reason: string;
}

export type ValidationResult<T> = ValidationOk<T> | ValidationErr;

export function validateChatBroadcastBody(
  body: unknown,
): ValidationResult<{ message: string }> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "invalid_body" };
  }
  const record = body as Record<string, unknown>;
  // Reject unexpected top-level capability overrides from the script.
  if ("capabilities" in record || "capability" in record || "command" in record) {
    return { ok: false, reason: "unexpected_fields" };
  }
  const message = record.message;
  if (typeof message !== "string") {
    return { ok: false, reason: "message_not_string" };
  }
  const trimmed = message.trim();
  if (!trimmed) {
    return { ok: false, reason: "message_empty" };
  }
  if (trimmed.length > CHAT_BROADCAST.maxMessageLength) {
    return { ok: false, reason: "message_too_long" };
  }
  return { ok: true, value: { message: trimmed } };
}

export function messagePreview(message: string): string {
  return message.length <= 80 ? message : `${message.slice(0, 80)}…`;
}
