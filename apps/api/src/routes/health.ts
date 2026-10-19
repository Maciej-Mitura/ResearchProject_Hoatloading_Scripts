import { Hono } from "jsr:@hono/hono@4.6.5";
import { withClient } from "../db/client.ts";

export const healthRoutes = new Hono();

healthRoutes.get("/health", async (c) => {
  let db = "unknown";
  try {
    await withClient(async (client) => {
      await client.queryArray`SELECT 1`;
    });
    db = "ok";
  } catch {
    db = "error";
  }
  const status = db === "ok" ? 200 : 503;
  return c.json(
    {
      status: db === "ok" ? "ok" : "degraded",
      service: "api",
      db,
      timestamp: new Date().toISOString(),
    },
    status,
  );
});
