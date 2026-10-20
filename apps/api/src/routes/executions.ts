import { Hono } from "jsr:@hono/hono@4.6.5";
import { streamSSE } from "jsr:@hono/hono@4.6.5/streaming";
import { withClient } from "../db/client.ts";
import * as repo from "../repositories/executions.ts";
import * as riskRepo from "../repositories/risk.ts";
import type { ExecutionService } from "../services/mock-execution.ts";
import { jsonError } from "../middleware/errors.ts";
import {
  DEFAULT_PERMISSION_PROFILE,
  isPermissionProfileId,
  PERMISSION_PROFILE_IDS,
} from "../domain/types.ts";
import { buildExecutionTimeline } from "../telemetry/timeline.ts";

/** Fields that must never be accepted from clients (raw Deno / Docker control). */
const REJECTED_EXECUTION_FIELDS = [
  "denoArgs",
  "allowFlags",
  "allowRead",
  "allowNet",
  "allowEnv",
  "allowRun",
  "allowFfi",
  "allowWrite",
  "allowAll",
  "permissions",
  "denoPermissions",
  "image",
  "mounts",
  "privileged",
  "runtime",
  "network",
  "environment",
  "env",
  "command",
] as const;

export function executionRoutes(execService: ExecutionService) {
  const app = new Hono();

  app.get("/", async (c) => {
    const items = await withClient((client) => repo.listExecutions(client));
    return c.json({ items });
  });

  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const item = await withClient((client) => repo.getExecution(client, id));
    if (!item) return jsonError(c, 404, "not_found", "Execution not found");
    const events = await withClient((client) => repo.listExecutionEvents(client, id));
    const securityEvents = await withClient((client) =>
      riskRepo.listSecurityEvents(client, { executionId: id, limit: 500 })
    );
    const timeline = buildExecutionTimeline({
      execution: item,
      executionEvents: events,
      securityEvents,
    });
    const fromMeta = securityEvents.find((e) =>
      typeof e.metadata?.traceId === "string"
    );
    const traceId = item.result?.traceId ??
      (fromMeta ? String(fromMeta.metadata.traceId) : null);
    return c.json({
      execution: item,
      events,
      timeline,
      traceId,
    });
  });

  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return jsonError(c, 400, "validation_error", "Request body must be a JSON object");
    }
    const record = body as Record<string, unknown>;

    const rejected: string[] = REJECTED_EXECUTION_FIELDS.filter((f) => f in record);
    for (const key of Object.keys(record)) {
      if (key.startsWith("--allow") || key === "-A" || key === "allow-all") {
        rejected.push(key);
      }
    }
    if (rejected.length > 0) {
      return jsonError(
        c,
        400,
        "validation_error",
        "Raw Deno permission flags, paths, and Docker options are not accepted. Use permissionProfile with a known ID.",
        { rejectedFields: [...new Set(rejected)] },
      );
    }

    const scriptId = typeof record.scriptId === "string" ? record.scriptId : "";
    const scriptVersionId =
      typeof record.scriptVersionId === "string" ? record.scriptVersionId : undefined;
    if (!scriptId) {
      return jsonError(c, 400, "validation_error", "scriptId is required");
    }

    let permissionProfile = DEFAULT_PERMISSION_PROFILE;
    if (record.permissionProfile !== undefined) {
      if (typeof record.permissionProfile !== "string") {
        return jsonError(
          c,
          400,
          "validation_error",
          "permissionProfile must be a string ID",
        );
      }
      if (!isPermissionProfileId(record.permissionProfile)) {
        return jsonError(
          c,
          400,
          "validation_error",
          `Unknown permissionProfile. Allowed: ${PERMISSION_PROFILE_IDS.join(", ")}`,
        );
      }
      permissionProfile = record.permissionProfile;
    }

    try {
      const execution = await execService.start(
        scriptId,
        scriptVersionId,
        permissionProfile,
      );
      return c.json(execution, 201);
    } catch (err) {
      return jsonError(c, 400, "execution_error", String(err));
    }
  });

  /** SSE stream of execution status updates */
  app.get("/:id/events", async (c) => {
    const id = c.req.param("id");
    const existing = await withClient((client) => repo.getExecution(client, id));
    if (!existing) return jsonError(c, 404, "not_found", "Execution not found");

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: "execution",
        data: JSON.stringify(existing),
      });

      const events = await withClient((client) => repo.listExecutionEvents(client, id));
      for (const ev of events) {
        await stream.writeSSE({
          event: "execution_event",
          data: JSON.stringify(ev),
        });
      }

      const terminal = new Set([
        "completed",
        "blocked",
        "failed",
        "terminated",
      ]);

      if (terminal.has(existing.status)) {
        await stream.writeSSE({ event: "done", data: "{}" });
        return;
      }

      await new Promise<void>((resolve) => {
        const unsub = execService.subscribe(id, async (execution) => {
          await stream.writeSSE({
            event: "execution",
            data: JSON.stringify(execution),
          });
          if (terminal.has(execution.status)) {
            await stream.writeSSE({ event: "done", data: "{}" });
            unsub();
            resolve();
          }
        });

        // Safety timeout
        setTimeout(async () => {
          unsub();
          await stream.writeSSE({ event: "timeout", data: "{}" });
          resolve();
        }, 60_000);
      });
    });
  });

  return app;
}
