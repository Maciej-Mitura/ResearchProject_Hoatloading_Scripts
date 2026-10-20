/**
 * Trusted client: Host Gateway → API host command queue.
 * Uses the existing allowlisted host command pipeline (no direct Paper access).
 */

import { API_BASE_URL, INTERNAL_SERVICE_TOKEN } from "./config.ts";
import type { HostApiEvent } from "./sessions.ts";

export interface EnqueueResult {
  ok: boolean;
  commandId?: string;
  error?: string;
}

export async function enqueueBroadcastMessage(
  message: string,
  correlation?: {
    executionId?: string;
    callId?: string;
    traceId?: string | null;
    traceparent?: string | null;
  },
): Promise<EnqueueResult> {
  const url = `${API_BASE_URL}/api/host/commands`;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (correlation?.traceparent) {
      headers.traceparent = correlation.traceparent;
    }
    const payload: Record<string, unknown> = { message };
    // Correlation metadata for SecureBridge result linking — not used by Paper effect.
    if (correlation?.executionId || correlation?.callId || correlation?.traceId) {
      payload._meta = {
        executionId: correlation.executionId ?? null,
        callId: correlation.callId ?? null,
        traceId: correlation.traceId ?? null,
      };
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandType: "broadcast_message",
        payload,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `api_enqueue_failed:${res.status}:${text.slice(0, 200)}`,
      };
    }
    const body = await res.json() as { id?: string };
    if (typeof body.id !== "string") {
      return { ok: false, error: "api_enqueue_missing_id" };
    }
    return { ok: true, commandId: body.id };
  } catch (err) {
    return { ok: false, error: `api_unreachable:${String(err)}` };
  }
}

/** Best-effort persistence of host API events into the API security_events table. */
export async function postSecurityEvents(
  events: HostApiEvent[],
): Promise<void> {
  if (events.length === 0) return;
  const url = `${API_BASE_URL}/api/internal/host-events`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": INTERNAL_SERVICE_TOKEN,
      },
      body: JSON.stringify({ events }),
    });
    await res.body?.cancel().catch(() => undefined);
  } catch {
    /* best-effort — runner also returns events on revoke */
  }
}
