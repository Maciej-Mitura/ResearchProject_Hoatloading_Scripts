import { Hono } from "jsr:@hono/hono@4.6.5";
import { withClient } from "../db/client.ts";
import * as riskRepo from "../repositories/risk.ts";

export const securityRoutes = new Hono();

securityRoutes.get("/events", async (c) => {
  const items = await withClient((client) => riskRepo.listSecurityEvents(client));
  return c.json({ items });
});

securityRoutes.get("/risk-assessments", async (c) => {
  const items = await withClient((client) => riskRepo.listRiskAssessments(client));
  return c.json({ items });
});
