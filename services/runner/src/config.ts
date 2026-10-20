/**
 * Central supervisor configuration.
 * The API/clients cannot override these values — only the trusted supervisor owns them.
 *
 * Limits are STARTING PoC values for later experimental evaluation, not proven optima.
 * Manifest metadata MUST be derived from these values (see manifest.ts).
 */

export const SUPERVISOR_PORT = Number(Deno.env.get("RUNNER_PORT") ?? "3100");

/** Fixed sandbox image — never accepted from API requests. */
export const SANDBOX_IMAGE =
  Deno.env.get("SANDBOX_IMAGE") ?? "research-poc-sandbox:local";

/**
 * Pinned Deno version expected inside the sandbox image.
 * Must match services/sandbox/Dockerfile (FROM denoland/deno:<version>).
 */
export const SANDBOX_DENO_VERSION =
  Deno.env.get("SANDBOX_DENO_VERSION") ?? "2.9.7";

/**
 * Optional Docker runtime for future gVisor experiments (e.g. "runsc").
 * Empty/unset = Docker default (runc). Not selectable by scripts or API clients.
 */
export const SANDBOX_DOCKER_RUNTIME = (Deno.env.get("SANDBOX_DOCKER_RUNTIME") ?? "")
  .trim();

export const LIMITS = {
  /** Wall-clock timeout for the job container (ms). */
  timeoutMs: Number(Deno.env.get("SANDBOX_TIMEOUT_MS") ?? "10000"),
  /** Combined stdout+stderr soft cap (bytes). */
  maxOutputBytes: Number(Deno.env.get("SANDBOX_MAX_OUTPUT_BYTES") ?? String(1024 * 1024)),
  cpus: Deno.env.get("SANDBOX_CPUS") ?? "0.5",
  memory: Deno.env.get("SANDBOX_MEMORY") ?? "256m",
  pidsLimit: Deno.env.get("SANDBOX_PIDS_LIMIT") ?? "64",
  /** tmpfs size for /workspace */
  workspaceTmpfsSize: Deno.env.get("SANDBOX_WORKSPACE_TMPFS") ?? "64m",
  /** tmpfs size for /tmp */
  tmpTmpfsSize: Deno.env.get("SANDBOX_TMP_TMPFS") ?? "16m",
  /** Max source length accepted by supervisor (bytes, UTF-8). */
  maxSourceBytes: Number(Deno.env.get("SANDBOX_MAX_SOURCE_BYTES") ?? String(512 * 1024)),
} as const;

export const ALLOWED_LANGUAGES = ["javascript", "typescript"] as const;
export type AllowedLanguage = (typeof ALLOWED_LANGUAGES)[number];

/**
 * Dedicated Docker network for host-capable sandboxes (internal, no internet).
 * Must match compose network name for `sandbox-host`.
 */
export const SANDBOX_HOST_NETWORK =
  Deno.env.get("SANDBOX_HOST_NETWORK") ?? "research-poc-sandbox-host";

/** Host Gateway base URL as seen from the supervisor (app network). */
export const HOST_GATEWAY_URL = (
  Deno.env.get("HOST_GATEWAY_URL") ?? "http://host-gateway:3200"
).replace(/\/$/, "");

/**
 * Host Gateway URL injected into the sandbox (sandbox-host network DNS name).
 * Distinct from HOST_GATEWAY_URL if supervisor and sandbox resolve differently.
 */
export const HOST_GATEWAY_SANDBOX_URL = (
  Deno.env.get("HOST_GATEWAY_SANDBOX_URL") ?? "http://host-gateway:3200"
).replace(/\/$/, "");

/** Deno --allow-net target for host-chat (host:port, no scheme). */
export const HOST_GATEWAY_NET_ALLOW =
  Deno.env.get("HOST_GATEWAY_NET_ALLOW") ?? "host-gateway:3200";

/** Admin token for session create/revoke — never injected into sandboxes. */
export const HOST_GATEWAY_ADMIN_TOKEN =
  Deno.env.get("HOST_GATEWAY_ADMIN_TOKEN") ?? "change-me-host-gateway-admin";

/** Fields the supervisor API accepts — anything else is rejected. */
export const ALLOWED_REQUEST_FIELDS = [
  "executionId",
  "language",
  "source",
  "permissionProfile",
  /** Correlation only — never used for capability authorization. */
  "traceId",
] as const;
