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

  const result = await withClient((client) =>
    repo.createScript(client, { name, description, language, source, status })
  );
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
