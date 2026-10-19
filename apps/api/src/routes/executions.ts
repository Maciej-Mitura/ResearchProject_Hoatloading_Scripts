import { Hono } from "jsr:@hono/hono@4.6.5";
import { streamSSE } from "jsr:@hono/hono@4.6.5/streaming";
import { withClient } from "../db/client.ts";
import * as repo from "../repositories/executions.ts";
import type { MockExecutionService } from "../services/mock-execution.ts";
import { jsonError } from "../middleware/errors.ts";

export function executionRoutes(mockExec: MockExecutionService) {
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
    return c.json({ execution: item, events });
  });

  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const scriptId = typeof body.scriptId === "string" ? body.scriptId : "";
    const scriptVersionId =
      typeof body.scriptVersionId === "string" ? body.scriptVersionId : undefined;
    if (!scriptId) {
      return jsonError(c, 400, "validation_error", "scriptId is required");
    }
    try {
      const execution = await mockExec.start(scriptId, scriptVersionId);
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
        const unsub = mockExec.subscribe(id, async (execution) => {
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
