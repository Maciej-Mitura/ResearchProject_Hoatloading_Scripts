import { Hono } from "jsr:@hono/hono@4.6.5";
import { withClient } from "../db/client.ts";
import * as repo from "../repositories/scripts.ts";
import { jsonError } from "../middleware/errors.ts";
import type { ScriptStatus } from "../domain/types.ts";

export const scriptRoutes = new Hono();

scriptRoutes.get("/", async (c) => {
  const items = await withClient((client) => repo.listScripts(client));
  return c.json({ items });
});

scriptRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const language = typeof body.language === "string" ? body.language : "javascript";
  const source = typeof body.source === "string" ? body.source : "";
  const description = typeof body.description === "string" ? body.description : null;
  const status = (body.status as ScriptStatus) ?? "draft";

  if (!name) return jsonError(c, 400, "validation_error", "name is required");
  if (!source) return jsonError(c, 400, "validation_error", "source is required");

  const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  const sourceMessageId = typeof body.sourceMessageId === "string" ? body.sourceMessageId : null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if ((conversationId && !uuid.test(conversationId)) || (sourceMessageId && !uuid.test(sourceMessageId)) || (sourceMessageId && !conversationId)) {
    return jsonError(c, 400, "validation_error", "Valid conversation and source message IDs are required");
  }
  if (conversationId) {
    const valid = await withClient(async (client) => {
      const conversation = await client.queryObject`SELECT id FROM conversations WHERE id = ${conversationId}`;
      if (!conversation.rows.length) return false;
      if (!sourceMessageId) return true;
      const message = await client.queryObject`SELECT id FROM messages WHERE id = ${sourceMessageId} AND conversation_id = ${conversationId} AND role = 'assistant'`;
      return message.rows.length > 0;
    });
    if (!valid) return jsonError(c, 400, "validation_error", "Source message must belong to this conversation");
  }
  const result = await withClient(async (client) => {
    await client.queryArray("BEGIN");
    try {
      const created = await repo.createScript(client, { name, description, language, source, status, conversationId, sourceMessageId });
      await client.queryArray("COMMIT");
      return created;
    } catch (error) {
      await client.queryArray("ROLLBACK");
      throw error;
    }
  });
  return c.json(result, 201);
});

scriptRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const script = await withClient((client) => repo.getScript(client, id));
  if (!script) return jsonError(c, 404, "not_found", "Script not found");
  const versions = await withClient((client) => repo.listVersions(client, id));
  const current = versions.find((v) => v.id === script.currentVersionId) ?? null;
  return c.json({ script, currentVersion: current, versions });
});

scriptRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const patch: { name?: string; description?: string | null; status?: ScriptStatus } = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (body.description !== undefined) {
    patch.description = body.description == null ? null : String(body.description);
  }
  if (body.status === "draft" || body.status === "ready" || body.status === "disabled") {
    patch.status = body.status;
  }
  const script = await withClient((client) => repo.updateScript(client, id, patch));
  if (!script) return jsonError(c, 404, "not_found", "Script not found");
  return c.json(script);
});

scriptRoutes.post("/:id/versions", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const source = typeof body.source === "string" ? body.source : "";
  const language = typeof body.language === "string" ? body.language : "javascript";
  const changelog = typeof body.changelog === "string" ? body.changelog : null;
  if (!source) return jsonError(c, 400, "validation_error", "source is required");

  const version = await withClient((client) =>
    repo.addScriptVersion(client, id, source, language, changelog)
  );
  if (!version) return jsonError(c, 404, "not_found", "Script not found");
  return c.json(version, 201);
});
