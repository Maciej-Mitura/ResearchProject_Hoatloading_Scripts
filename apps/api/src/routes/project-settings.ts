import { Hono } from "jsr:@hono/hono@4.6.5";
import { jsonError } from "../middleware/errors.ts";
import {
  getProjectContextService,
} from "../project/project-context-service.ts";
import { ProjectSettingsValidationError } from "../project/schema.ts";

export function projectSettingsRoutes() {
  const app = new Hono();
  const svc = () => getProjectContextService();

  app.get("/settings", async (c) => {
    const data = await svc().getSettingsResponse();
    return c.json(data);
  });

  app.patch("/settings", async (c) => {
    const body = await c.req.json().catch(() => null);
    try {
      const data = await svc().patchSettings(body);
      return c.json(data);
    } catch (err) {
      if (err instanceof ProjectSettingsValidationError) {
        return jsonError(c, 400, "validation_error", err.message, {
          issues: err.issues,
        });
      }
      throw err;
    }
  });

  app.post("/settings/reset", async (c) => {
    const data = await svc().resetSettings();
    return c.json(data);
  });

  /** Safe AI context preview (no secrets / no full prompt dump by default). */
  app.get("/settings/context-preview", async (c) => {
    const built = await svc().buildChatContext();
    return c.json({ preview: built.preview });
  });

  return app;
}
