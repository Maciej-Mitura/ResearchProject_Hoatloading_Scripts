/**
 * Redact arguments for auth/password-style player commands before persistence.
 * Mirrors minecraft/bridge CommandSanitizer — keep lists in sync.
 */

const SENSITIVE_COMMANDS = new Set([
  "login",
  "l",
  "register",
  "reg",
  "password",
  "passwd",
  "changepassword",
  "changepass",
  "auth",
  "setpassword",
]);

/**
 * @param rawCommand player command text, with or without leading '/'
 * @returns sanitized form safe to store/display
 */
export function sanitizePlayerCommand(rawCommand: string): string {
  const trimmed = (rawCommand ?? "").trim();
  if (!trimmed) return "";

  const hadSlash = trimmed.startsWith("/");
  const withoutSlash = hadSlash ? trimmed.slice(1) : trimmed;
  if (!withoutSlash) return hadSlash ? "/" : "";

  const space = withoutSlash.indexOf(" ");
  const name = (space < 0 ? withoutSlash : withoutSlash.slice(0, space))
    .toLowerCase();
  const prefix = hadSlash ? "/" : "";

  if (SENSITIVE_COMMANDS.has(name) && space >= 0) {
    return `${prefix}${name} [REDACTED]`;
  }
  return trimmed;
}

/** Sanitize host event payloads before DB write (defense in depth). */
export function sanitizeHostEventPayload(
  eventType: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (eventType !== "player_command") return payload;
  const next = { ...payload };
  if (typeof next.command === "string") {
    next.command = sanitizePlayerCommand(next.command);
  }
  return next;
}
