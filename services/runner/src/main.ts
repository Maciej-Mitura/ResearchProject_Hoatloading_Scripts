/**
 * Trusted execution supervisor.
 *
 * Sole service allowed to talk to the Docker Engine for script jobs.
 * Exposes a narrow POST /execute API — never generic Docker control.
 *
 * Sandbox policy (image, mounts, network, runtime, limits, permission profile,
 * audit path) is owned here.
 * Future gVisor: set SANDBOX_DOCKER_RUNTIME=runsc centrally (not per request).
 */

import { Hono } from "jsr:@hono/hono@4.6.5";
import {
  LIMITS,
  SANDBOX_DENO_VERSION,
  SANDBOX_DOCKER_RUNTIME,
  SANDBOX_IMAGE,
  SUPERVISOR_PORT,
} from "./config.ts";
import { dockerAvailable, runSandboxContainer } from "./docker.ts";
import { mapToExecutionStatus } from "./output.ts";
import {
  DEFAULT_PERMISSION_PROFILE,
  PERMISSION_PROFILES,
} from "./permissions.ts";
import { validateExecuteRequest } from "./validate.ts";

const app = new Hono();

app.get("/health", async (c) => {
  const docker = await dockerAvailable();
  return c.json({
    status: docker ? "ok" : "degraded",
    service: "execution-supervisor",
    mode: "docker",
    sandboxImage: SANDBOX_IMAGE,
    sandboxDenoVersion: SANDBOX_DENO_VERSION,
    permissionProfile: DEFAULT_PERMISSION_PROFILE,
    permissionProfiles: [...PERMISSION_PROFILES],
    dockerRuntime: SANDBOX_DOCKER_RUNTIME || "runc",
    dockerAvailable: docker,
    limits: {
      timeoutMs: LIMITS.timeoutMs,
      maxOutputBytes: LIMITS.maxOutputBytes,
      cpus: LIMITS.cpus,
      memory: LIMITS.memory,
      pidsLimit: LIMITS.pidsLimit,
    },
    warning:
      "Deno permission profiles are trusted supervisor configurations. Audit records access/check events, not allow/deny outcomes.",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /execute
 * Body: { executionId, language, source, permissionProfile? }
 * Rejects image/command/mounts/env/privileged/runtime/audit/--allow-* overrides.
 */
app.post("/execute", async (c) => {
  const body = await c.req.json().catch(() => null);
  const validated = validateExecuteRequest(body);
  if (!validated.ok) {
    return c.json(
      {
        error: {
          code: "validation_error",
          message: validated.message,
          rejectedFields: validated.rejectedFields ?? [],
        },
      },
      400,
    );
  }

  const docker = await dockerAvailable();
  if (!docker) {
    return c.json(
      {
        executionId: validated.value.executionId,
        exitCode: null,
        stdout: "",
        stderr: "",
        durationMs: 0,
        timedOut: false,
        outputTruncated: false,
        sandboxImage: SANDBOX_IMAGE,
        status: "failed",
        error:
          "Docker daemon unavailable to execution supervisor. Refusing to fall back to mock.",
        permissionEvents: [],
        permissionAuditTruncated: false,
        failureCategory: "supervisor_error",
      },
      503,
    );
  }

  const result = await runSandboxContainer(validated.value);
  const status = mapToExecutionStatus({
    timedOut: result.timedOut,
    exitCode: result.exitCode,
    supervisorError: Boolean(result.error),
  });

  return c.json({
    executionId: result.executionId,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    outputTruncated: result.outputTruncated,
    sandboxImage: result.sandboxImage,
    status,
    error: result.error ?? null,
    manifest: result.manifest,
    permissionEvents: result.permissionEvents,
    permissionAuditTruncated: result.permissionAuditTruncated,
    hostApiEvents: result.hostApiEvents,
    failureCategory: result.failureCategory,
    runtimeVersion: result.runtimeVersion,
    // Echo trusted correlation id — not an authorization decision.
    traceId: validated.value.traceId ?? null,
  });
});

// Intentionally no generic Docker proxy routes.

console.log(
  `[execution-supervisor] listening on :${SUPERVISOR_PORT}` +
    ` image=${SANDBOX_IMAGE} deno=${SANDBOX_DENO_VERSION}` +
    ` profile=${DEFAULT_PERMISSION_PROFILE}` +
    (SANDBOX_DOCKER_RUNTIME ? ` runtime=${SANDBOX_DOCKER_RUNTIME}` : ""),
);
Deno.serve({ port: SUPERVISOR_PORT, hostname: "0.0.0.0" }, app.fetch);
