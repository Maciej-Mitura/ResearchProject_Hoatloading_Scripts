/**
 * Trusted Host Gateway.
 *
 * Sandbox-facing: narrow capability endpoints authenticated by execution-scoped tokens.
 * Supervisor-facing: session create/revoke with admin token.
 *
 * Deno --allow-net to this service is TRANSPORT only — this process decides
 * whether chat.broadcast is authorized for the session.
 */

import { Hono } from "jsr:@hono/hono@4.6.5";
import { enqueueBroadcastMessage, postSecurityEvents } from "./api-client.ts";
import {
  ADMIN_TOKEN,
  CHAT_BROADCAST,
  PORT,
} from "./config.ts";
import {
  createSession,
  hasCapability,
  incrementCallCount,
  lookupSession,
  recordEvent,
  revokeSession,
  type HostApiEvent,
} from "./sessions.ts";
import { messagePreview, validateChatBroadcastBody } from "./validate.ts";

const app = new Hono();

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

function requireAdmin(c: { req: { header: (n: string) => string | undefined } }): boolean {
  const token = bearerToken(c.req.header("Authorization")) ??
    c.req.header("X-Admin-Token");
  return !!token && token === ADMIN_TOKEN;
}

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "host-gateway",
    capabilities: [CHAT_BROADCAST.capability],
    warning:
      "Transport reachability ≠ capability authority. chat.broadcast is authorized per execution-scoped session.",
  }));

/** Supervisor: create execution-scoped capability session. */
app.post("/internal/sessions", async (c) => {
  if (!requireAdmin(c)) {
    return c.json({ error: { code: "unauthorized", message: "admin required" } }, 401);
  }
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: { code: "validation_error", message: "JSON body required" } }, 400);
  }
  const record = body as Record<string, unknown>;
  try {
    const created = createSession({
      executionId: String(record.executionId ?? ""),
      capabilities: Array.isArray(record.capabilities)
        ? record.capabilities.map(String)
        : [],
      ttlMs: typeof record.ttlMs === "number" ? record.ttlMs : undefined,
      // Correlation only — admin/supervisor supplied; never from sandbox body.
      traceId: typeof record.traceId === "string" ? record.traceId : null,
    });
    return c.json(created, 201);
  } catch (err) {
    return c.json(
      { error: { code: "validation_error", message: String(err) } },
      400,
    );
  }
});

/** Supervisor: revoke session and return collected host API events. */
app.post("/internal/sessions/revoke", async (c) => {
  if (!requireAdmin(c)) {
    return c.json({ error: { code: "unauthorized", message: "admin required" } }, 401);
  }
  const body = await c.req.json().catch(() => null);
  const token = body && typeof body === "object"
    ? String((body as { token?: unknown }).token ?? "")
    : "";
  const events = revokeSession(token);
  return c.json({ revoked: true, events });
});

/**
 * Sandbox-facing capability endpoint — only chat.broadcast.
 * Authorization is derived from the session token, not the request body,
 * and not from any traceparent / traceId the sandbox may forge.
 */
app.post("/v1/capabilities/chat.broadcast", async (c) => {
  const callId = crypto.randomUUID();
  const token = bearerToken(c.req.header("Authorization")) ??
    c.req.header("X-Capability-Token");
  // Intentionally ignore sandbox-supplied traceparent for authorization.
  // Correlation uses the trusted session.traceId from supervisor create.
  void c.req.header("traceparent");
  const { session, denial } = lookupSession(token);

  if (!session) {
    return c.json(
      {
        accepted: false,
        error: {
          code: "unauthorized",
          message: "capability credential rejected",
          denial: denial ?? "invalid_token",
        },
      },
      401,
    );
  }

  const requested = recordEvent(session, {
    eventType: "host_api.requested",
    capability: CHAT_BROADCAST.capability,
    callId,
  });
  await postSecurityEvents([requested]);

  if (!hasCapability(session, CHAT_BROADCAST.capability)) {
    const denied = recordEvent(session, {
      eventType: "host_api.denied",
      capability: CHAT_BROADCAST.capability,
      callId,
      reason: "capability_not_granted",
    });
    await postSecurityEvents([denied]);
    return c.json(
      {
        accepted: false,
        error: { code: "forbidden", message: "capability not granted" },
      },
      403,
    );
  }

  const body = await c.req.json().catch(() => null);
  const validated = validateChatBroadcastBody(body);
  if (!validated.ok) {
    const denied = recordEvent(session, {
      eventType: "host_api.denied",
      capability: CHAT_BROADCAST.capability,
      callId,
      reason: validated.reason,
    });
    await postSecurityEvents([denied]);
    return c.json(
      {
        accepted: false,
        error: { code: "validation_error", message: validated.reason },
      },
      400,
    );
  }

  const count = incrementCallCount(session, CHAT_BROADCAST.capability);
  if (count > CHAT_BROADCAST.maxCallsPerExecution) {
    const denied = recordEvent(session, {
      eventType: "host_api.denied",
      capability: CHAT_BROADCAST.capability,
      callId,
      reason: "budget_exhausted",
      messagePreview: messagePreview(validated.value.message),
    });
    await postSecurityEvents([denied]);
    return c.json(
      {
        accepted: false,
        error: {
          code: "budget_exhausted",
          message: `chat.broadcast budget exceeded (max ${CHAT_BROADCAST.maxCallsPerExecution} per execution)`,
        },
      },
      429,
    );
  }

  const allowed = recordEvent(session, {
    eventType: "host_api.allowed",
    capability: CHAT_BROADCAST.capability,
    callId,
    messagePreview: messagePreview(validated.value.message),
  });
  await postSecurityEvents([allowed]);

  const enqueued = await enqueueBroadcastMessage(validated.value.message, {
    executionId: session.executionId,
    callId,
    traceId: session.traceId,
    // Trusted correlation toward API only — built from session, not sandbox header.
    traceparent: session.traceId
      ? `00-${session.traceId}-${callId.replace(/-/g, "").slice(0, 16)}-01`
      : null,
  });
  if (!enqueued.ok || !enqueued.commandId) {
    const denied = recordEvent(session, {
      eventType: "host_api.denied",
      capability: CHAT_BROADCAST.capability,
      callId,
      reason: enqueued.error ?? "enqueue_failed",
    });
    await postSecurityEvents([denied]);
    return c.json(
      {
        accepted: false,
        error: { code: "enqueue_failed", message: "failed to queue host command" },
      },
      502,
    );
  }

  const queued = recordEvent(session, {
    eventType: "host_api.queued",
    capability: CHAT_BROADCAST.capability,
    callId,
    commandId: enqueued.commandId,
    messagePreview: messagePreview(validated.value.message),
  });
  await postSecurityEvents([queued]);

  // Queued/accepted — not proof the message was displayed in Minecraft yet.
  return c.json({
    accepted: true,
    commandId: enqueued.commandId,
    callId,
    capability: CHAT_BROADCAST.capability,
    executionId: session.executionId,
  });
});

/** Reject unknown capability paths explicitly (no dynamic dispatch). */
app.all("/v1/capabilities/*", (c) => {
  return c.json(
    {
      accepted: false,
      error: { code: "unknown_capability", message: "capability not available" },
    },
    404,
  );
});

// Intentionally no /executeCommand, no arbitrary proxy, no Docker.

export { app };
export type { HostApiEvent };

if (import.meta.main) {
  console.log(
    `[host-gateway] listening on :${PORT} capability=${CHAT_BROADCAST.capability}` +
      ` budget=${CHAT_BROADCAST.maxCallsPerExecution}`,
  );
  Deno.serve({ port: PORT, hostname: "0.0.0.0" }, app.fetch);
}
