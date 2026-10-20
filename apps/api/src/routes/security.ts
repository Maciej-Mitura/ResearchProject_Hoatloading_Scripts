import { Hono } from "jsr:@hono/hono@4.6.5";
import { withClient } from "../db/client.ts";
import * as riskRepo from "../repositories/risk.ts";

export const securityRoutes = new Hono();

securityRoutes.get("/events", async (c) => {
  const executionId = c.req.query("executionId") || undefined;
  const items = await withClient((client) =>
    riskRepo.listSecurityEvents(client, { executionId })
  );
  return c.json({ items });
});

securityRoutes.get("/risk-assessments", async (c) => {
  const executionId = c.req.query("executionId") || undefined;
  const items = await withClient((client) =>
    riskRepo.listRiskAssessments(client, { executionId })
  );
  return c.json({ items });
});
