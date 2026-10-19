import { Hono } from "jsr:@hono/hono@4.6.5";
import { waitForDb, withClient } from "./db/client.ts";
import { runMigrations } from "./db/migrate.ts";
import { createChatProvider } from "./providers/chat.ts";
import { createRiskAnalyzer } from "./providers/risk.ts";
import { MockExecutionService } from "./services/mock-execution.ts";
import { initTelemetry, shutdownTelemetry } from "./telemetry/otel.ts";
import { corsMiddleware } from "./middleware/cors.ts";
import { errorMiddleware } from "./middleware/errors.ts";
import { healthRoutes } from "./routes/health.ts";
import { conversationRoutes } from "./routes/conversations.ts";
import { scriptRoutes } from "./routes/scripts.ts";
import { executionRoutes } from "./routes/executions.ts";
import { hostRoutes } from "./routes/host.ts";
import { securityRoutes } from "./routes/security.ts";
import { configRoutes } from "./routes/config.ts";
import { projectSettingsRoutes } from "./routes/project-settings.ts";
import * as riskRepo from "./repositories/risk.ts";
import { ChatProviderError } from "./providers/chat.ts";
import { getProjectContextService } from "./project/project-context-service.ts";

const port = Number(Deno.env.get("API_PORT") ?? "3000");

await waitForDb();
await runMigrations(Deno.env.get("DATABASE_URL")!);
await initTelemetry();

let chat;
try {
  chat = createChatProvider(Deno.env.get("CHAT_PROVIDER") ?? "mock");
} catch (err) {
  if (err instanceof ChatProviderError) {
    console.error(`[api] chat provider configuration error: ${err.message}`);
    Deno.exit(1);
  }
  throw err;
}
console.log(
  `[api] chat provider: ${chat.name}` +
    (chat.model ? ` (model=${chat.model})` : ""),
);
const risk = createRiskAnalyzer(Deno.env.get("RISK_ANALYZER") ?? "mock");
const mockExec = new MockExecutionService(risk);

// Eager-load base project context (fail fast if config missing / invalid)
try {
  const pcs = getProjectContextService();
  const base = await pcs.loadBaseSpec();
  const caps = await pcs.loadCapabilities();
  console.log(
    `[api] project context: game=${base.host.game} ${base.host.edition} ` +
      `${base.host.gameVersion ?? "?"} / ${base.host.serverSoftware}; ` +
      `implemented capabilities=${caps.implemented.length}`,
  );
} catch (err) {
  console.error("[api] failed to load project context:", err);
  Deno.exit(1);
}

const app = new Hono();
app.use("*", corsMiddleware);
app.use("*", errorMiddleware);

app.route("/", healthRoutes);
app.route("/api/config", configRoutes(chat));
app.route("/api/project", projectSettingsRoutes());
app.route("/api/conversations", conversationRoutes(chat));
app.route("/api/scripts", scriptRoutes);
app.route("/api/executions", executionRoutes(mockExec));
app.route("/api/host", hostRoutes);
app.route("/api/security", securityRoutes);

app.get("/api/risk-assessments", async (c) => {
  const items = await withClient((client) => riskRepo.listRiskAssessments(client));
  return c.json({ items });
});

console.log(`[api] listening on :${port}`);

try {
  Deno.addSignalListener("SIGTERM", async () => {
    await shutdownTelemetry();
    Deno.exit(0);
  });
} catch {
  /* signals may be unavailable on some platforms */
}

Deno.serve({ port, hostname: "0.0.0.0" }, app.fetch);
