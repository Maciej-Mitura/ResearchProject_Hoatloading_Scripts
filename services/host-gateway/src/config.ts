/**
 * Host Gateway configuration — trusted service only.
 * Never expose ADMIN_TOKEN or API credentials to sandboxes.
 */

export const PORT = Number(Deno.env.get("HOST_GATEWAY_PORT") ?? "3200");

/** Shared with runner/supervisor for session create/revoke. Never injected into sandboxes. */
export const ADMIN_TOKEN =
  Deno.env.get("HOST_GATEWAY_ADMIN_TOKEN") ?? "change-me-host-gateway-admin";

/** Backend API base (trusted app network). Used to enqueue SecureBridge commands. */
export const API_BASE_URL = (
  Deno.env.get("API_BASE_URL") ?? "http://api:3000"
).replace(/\/$/, "");

/** Optional: authenticate internal security-event posts (same value API expects). */
export const INTERNAL_SERVICE_TOKEN =
  Deno.env.get("HOST_GATEWAY_SERVICE_TOKEN") ?? ADMIN_TOKEN;

export const CHAT_BROADCAST = {
  capability: "chat.broadcast" as const,
  bridgeCommand: "broadcast_message" as const,
  maxMessageLength: Number(
    Deno.env.get("HOST_CHAT_BROADCAST_MAX_LEN") ?? "256",
  ),
  maxCallsPerExecution: Number(
    Deno.env.get("HOST_CHAT_BROADCAST_BUDGET") ?? "5",
  ),
};

/** Default session TTL if supervisor omits ttlMs (ms). */
export const DEFAULT_SESSION_TTL_MS = Number(
  Deno.env.get("HOST_SESSION_TTL_MS") ?? "40000",
);

export const MAX_SESSION_TTL_MS = Number(
  Deno.env.get("HOST_SESSION_MAX_TTL_MS") ?? "120000",
);
