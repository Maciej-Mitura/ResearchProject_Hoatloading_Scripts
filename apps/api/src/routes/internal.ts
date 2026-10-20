/**
 * Internal service-to-service routes (Host Gateway → API).
 * Protected by shared HOST_GATEWAY_SERVICE_TOKEN — never exposed to sandboxes.
 */

import { Hono } from "jsr:@hono/hono@4.6.5";
import { withClient } from "../db/client.ts";
import * as riskRepo from "../repositories/risk.ts";
import { jsonError } from "../middleware/errors.ts";

const SERVICE_TOKEN =
  Deno.env.get("HOST_GATEWAY_SERVICE_TOKEN") ??
  Deno.env.get("HOST_GATEWAY_ADMIN_TOKEN") ??
  "change-me-host-gateway-admin";

export const internalRoutes = new Hono();

internalRoutes.post("/host-events", async (c) => {
  const token = c.req.header("X-Internal-Token") ?? "";
  if (!token || token !== SERVICE_TOKEN) {
    return jsonError(c, 401, "unauthorized", "internal token required");
  }

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(c, 400, "validation_error", "JSON body required");
  }
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events)) {
    return jsonError(c, 400, "validation_error", "events array required");
  }

  let stored = 0;
  await withClient(async (client) => {
    for (const raw of events) {
      if (!raw || typeof raw !== "object") continue;
      const ev = raw as Record<string, unknown>;
      const executionId = typeof ev.executionId === "string" ? ev.executionId : "";
      const eventType = typeof ev.eventType === "string" ? ev.eventType : "";
      // execution_id column is UUID — skip non-uuid test/probe ids.
      if (
        !executionId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          .test(executionId) ||
        !eventType.startsWith("host_api.")
      ) {
        continue;
      }

      await riskRepo.addSecurityEvent(client, {
        executionId,
        eventType,
        severity: eventType === "host_api.denied" ? "warning" : "info",
        message: typeof ev.reason === "string"
          ? `${eventType}: ${String(ev.capability ?? "")} (${ev.reason})`
          : `${eventType}: ${String(ev.capability ?? "")}`,
        metadata: {
          source: "host_gateway",
          capability: ev.capability ?? null,
          callId: ev.callId ?? null,
          commandId: ev.commandId ?? null,
          reason: ev.reason ?? null,
          messagePreview: typeof ev.messagePreview === "string"
            ? ev.messagePreview.slice(0, 80)
            : null,
          timestamp: ev.timestamp ?? null,
          traceId: typeof ev.traceId === "string" ? ev.traceId : null,
        },
      });
      stored++;
    }
  });

  return c.json({ ok: true, stored });
});
