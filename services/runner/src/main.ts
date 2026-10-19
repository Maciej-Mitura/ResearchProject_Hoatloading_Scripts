/**
 * Runner service — foundation / boundary only.
 *
 * RESEARCH TODO (do not invent final values yet):
 * - per-execution container lifecycle
 * - Deno permissions
 * - dependency policy
 * - filesystem mounts
 * - egress policy
 * - CPU/memory/output limits
 * - watchdog/timeouts
 * - gVisor runtime (runsc) — see compose.gvisor.yaml
 * - telemetry
 * - cleanup/reset between runs
 *
 * This service must NOT execute arbitrary uploaded code.
 */

import { Hono } from "jsr:@hono/hono@4.6.5";

const port = Number(Deno.env.get("RUNNER_PORT") ?? "3100");

/**
 * Future protocol sketch (not enforced yet):
 * POST /v1/executions { executionId, scriptVersionId, language, sourceRef, limits? }
 * GET  /v1/executions/:id
 *
 * Source must arrive via controlled references — never trust raw uploads blindly.
 */
export interface RunnerExecutionRequest {
  executionId: string;
  scriptVersionId: string;
  language: string;
  /** Opaque reference — RESEARCH TODO: content-addressed store */
  sourceRef: string;
}

const app = new Hono();

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "runner",
    mode: "mock",
    warning:
      "This runner does NOT execute untrusted code. Sandbox orchestration is deferred.",
    timestamp: new Date().toISOString(),
  })
);

/** Internal mock endpoint — echoes request, does not run source */
app.post("/v1/executions", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<RunnerExecutionRequest>;
  if (!body.executionId || !body.scriptVersionId || !body.sourceRef) {
    return c.json(
      {
        error: {
          code: "validation_error",
          message: "executionId, scriptVersionId, and sourceRef are required",
        },
      },
      400,
    );
  }

  return c.json({
    executionId: body.executionId,
    status: "accepted_mock",
    message:
      "Mock runner acknowledged request. No code was executed. RESEARCH TODO: real sandbox.",
    received: {
      language: body.language ?? "unknown",
      sourceRef: body.sourceRef,
    },
  }, 202);
});

app.get("/v1/executions/:id", (c) => {
  return c.json({
    executionId: c.req.param("id"),
    status: "not_implemented",
    message: "Real runner state machine not implemented yet.",
  });
});

console.log(`[runner] mock foundation listening on :${port}`);
Deno.serve({ port, hostname: "0.0.0.0" }, app.fetch);
