/**
 * Trusted supervisor client for Host Gateway session lifecycle.
 */

import {
  HOST_GATEWAY_ADMIN_TOKEN,
  HOST_GATEWAY_URL,
  LIMITS,
} from "./config.ts";

export interface HostApiEvent {
  eventType: string;
  capability: string;
  executionId: string;
  callId: string;
  commandId?: string;
  reason?: string;
  messagePreview?: string;
  source: "host_gateway";
  timestamp: string;
}

export interface CapabilitySession {
  token: string;
  expiresAt: string;
  capabilities: string[];
}

export async function createCapabilitySession(input: {
  executionId: string;
  capabilities: string[];
  /** Correlation only — stored on session; never authorizes capabilities. */
  traceId?: string | null;
}): Promise<CapabilitySession> {
  const ttlMs = LIMITS.timeoutMs + 30_000; // execution timeout + cleanup buffer
  const res = await fetch(`${HOST_GATEWAY_URL}/internal/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HOST_GATEWAY_ADMIN_TOKEN}`,
    },
    body: JSON.stringify({
      executionId: input.executionId,
      capabilities: input.capabilities,
      ttlMs,
      traceId: input.traceId ?? null,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Host Gateway session create failed (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }
  return await res.json() as CapabilitySession;
}

export async function revokeCapabilitySession(
  token: string,
): Promise<HostApiEvent[]> {
  try {
    const res = await fetch(`${HOST_GATEWAY_URL}/internal/sessions/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HOST_GATEWAY_ADMIN_TOKEN}`,
      },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return [];
    const body = await res.json() as { events?: HostApiEvent[] };
    return Array.isArray(body.events) ? body.events : [];
  } catch {
    return [];
  }
}
