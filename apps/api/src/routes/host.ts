import { Hono } from "jsr:@hono/hono@4.6.5";
import { withClient } from "../db/client.ts";
import * as hostRepo from "../repositories/host.ts";
import * as riskRepo from "../repositories/risk.ts";
import { bridgeAuth } from "../middleware/bridge-auth.ts";
import { jsonError } from "../middleware/errors.ts";
import { ALLOWED_HOST_EVENTS, CONTRACT_VERSION } from "../domain/types.ts";
import { sanitizeHostEventPayload } from "../host/command-sanitizer.ts";
import { trustedCommandCorrelation } from "../host/provenance.ts";
import { clampHostEventLimit } from "../repositories/host.ts";

const HEARTBEAT_STALE_MS = 30_000;

export function createHostRoutes(runDb: typeof withClient = withClient) {
  const hostRoutes = new Hono();

  /** Public status for UI */
  hostRoutes.get("/status", async (c) => {
    const connection = await runDb((client) =>
      hostRepo.getLatestConnection(client)
    );
    const pendingCommands = await runDb((client) =>
      hostRepo.countPendingCommands(client)
    );
    const connected = !!connection &&
      Date.now() - new Date(connection.lastHeartbeatAt).getTime() <
        HEARTBEAT_STALE_MS;
    return c.json({ connected, connection, pendingCommands });
  });

  /** Direct/debug submission is disabled; use a sandbox host-chat execution. */
  hostRoutes.post(
    "/commands",
    (c) =>
      jsonError(
        c,
        403,
        "direct_commands_disabled",
        "Use a sandbox host-chat execution; direct/debug commands are disabled",
      ),
  );

  /** Host observability log (Paper/SecureBridge events — not OTEL/script telemetry). */
  hostRoutes.get("/events", async (c) => {
    const limit = clampHostEventLimit(c.req.query("limit"));
    const filter = c.req.query("filter") ?? "";
    if (
      !["", "all", "players", "chat", "commands", "system"].includes(filter)
    ) {
      return jsonError(
        c,
        400,
        "validation_error",
        "Unknown host activity filter",
      );
    }
    const items = await runDb((client) =>
      hostRepo.listHostEvents(client, limit, filter)
    );
    return c.json({ items, limit });
  });

  /** Bridge endpoints (token-protected) */
  const bridge = new Hono();
  bridge.use("*", bridgeAuth);

  bridge.post("/heartbeat", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (body.protocolVersion !== CONTRACT_VERSION) {
      return jsonError(
        c,
        400,
        "protocol_mismatch",
        `Expected protocolVersion ${CONTRACT_VERSION}`,
      );
    }
    const pluginVersion = String(body.pluginVersion ?? "unknown");
    const serverVersion = String(body.serverVersion ?? "unknown");
    const onlinePlayers = Number(body.onlinePlayers ?? 0);
    const maxPlayers = Number(body.maxPlayers ?? 0);

    const connection = await runDb(async (client) => {
      const conn = await hostRepo.upsertHeartbeat(client, {
        pluginVersion,
        serverVersion,
        onlinePlayers,
        metadata: { maxPlayers, motd: body.motd ?? null },
      });
      await hostRepo.addHostEvent(client, conn.id, "heartbeat", {
        onlinePlayers,
        maxPlayers,
        serverVersion,
      });
      return conn;
    });

    return c.json({ ok: true, connectionId: connection.id });
  });

  bridge.post("/events", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (body.protocolVersion !== CONTRACT_VERSION) {
      return jsonError(
        c,
        400,
        "protocol_mismatch",
        `Expected protocolVersion ${CONTRACT_VERSION}`,
      );
    }
    const eventType = String(body.eventType ?? "");
    if (
      !ALLOWED_HOST_EVENTS.includes(
        eventType as (typeof ALLOWED_HOST_EVENTS)[number],
      )
    ) {
      return jsonError(c, 400, "validation_error", "eventType not allowed", {
        allowed: ALLOWED_HOST_EVENTS,
      });
    }
    const rawPayload = body.payload && typeof body.payload === "object"
      ? body.payload as Record<string, unknown>
      : {};
    const payload = sanitizeHostEventPayload(eventType, rawPayload);

    const connection = await runDb((client) =>
      hostRepo.getLatestConnection(client)
    );
    const event = await runDb((client) =>
      hostRepo.addHostEvent(client, connection?.id ?? null, eventType, payload)
    );

    // Update player count on join/leave if provided
    if (
      connection &&
      (eventType === "player_join" || eventType === "player_leave") &&
      typeof payload.onlinePlayers === "number"
    ) {
      await runDb((client) =>
        hostRepo.upsertHeartbeat(client, {
          pluginVersion: connection.pluginVersion,
          serverVersion: connection.serverVersion ?? "unknown",
          onlinePlayers: payload.onlinePlayers as number,
          metadata: connection.metadata,
        })
      );
    }

    return c.json({ ok: true, eventId: event.id }, 201);
  });

  bridge.get("/commands/pending", async (c) => {
    const commands = await runDb((client) =>
      hostRepo.claimPendingCommands(client)
    );
    return c.json({
      protocolVersion: CONTRACT_VERSION,
      commands: commands.map((cmd) => ({
        id: cmd.id,
        commandType: cmd.commandType,
        payload: cmd.payload,
      })),
    });
  });

  bridge.post("/commands/result", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (body.protocolVersion !== CONTRACT_VERSION) {
      return jsonError(
        c,
        400,
        "protocol_mismatch",
        `Expected protocolVersion ${CONTRACT_VERSION}`,
      );
    }
    const commandId = String(body.commandId ?? "");
    if (!commandId) {
      return jsonError(c, 400, "validation_error", "commandId is required");
    }

    const updated = await runDb((client) =>
      hostRepo.completeHostCommand(
        client,
        commandId,
        Boolean(body.success),
        String(body.message ?? ""),
        body.data && typeof body.data === "object"
          ? body.data as Record<string, unknown>
          : undefined,
      )
    );
    if (!updated) return jsonError(c, 404, "not_found", "Command not found");

    const connection = await runDb((client) =>
      hostRepo.getLatestConnection(client)
    );
    await runDb((client) =>
      hostRepo.addHostEvent(client, connection?.id ?? null, "command_result", {
        commandId,
        origin: updated.origin ?? "unknown",
        success: body.success,
        message: body.message,
      })
    );

    // Queue-side mapping only: never promote historical/caller payload._meta.
    const m = trustedCommandCorrelation(updated);
    if (m) {
      const executionId = m.executionId;
      await runDb((client) =>
        riskRepo.addSecurityEvent(client, {
          executionId,
          eventType: "host.command.result",
          severity: body.success ? "info" : "warning",
          message: body.success
            ? "SecureBridge command_result received"
            : "SecureBridge command_result reported failure",
          metadata: {
            source: "secure_bridge",
            origin: updated.origin,
            capability: m.capability,
            scriptVersionId: m.scriptVersionId ?? null, manifestId: m.manifestId ?? null,
            commandId,
            callId: typeof m.callId === "string" ? m.callId : null,
            traceId: typeof m.traceId === "string" ? m.traceId : null,
            success: Boolean(body.success),
            // Short message only — avoid full arbitrary chat text in durable events.
            resultMessage: String(body.message ?? "").slice(0, 120),
          },
        })
      );
    }

    return c.json({ ok: true, command: updated });
  });

  hostRoutes.route("/bridge", bridge);

  return hostRoutes;
}
export const hostRoutes = createHostRoutes();
