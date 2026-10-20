/**
 * Trusted permission-profile abstraction and Deno permission-audit parsing.
 *
 * Clients may only select a known profile ID. The supervisor owns the mapping
 * from ID → Deno argv / sandbox env. Raw --allow-* flags are never accepted
 * from API requests.
 *
 * Native Deno audit JSONL records ACCESS/CHECK events — not allow/deny outcomes.
 */

import {
  HOST_GATEWAY_NET_ALLOW,
  HOST_GATEWAY_SANDBOX_URL,
} from "./config.ts";

export const PERMISSION_PROFILES = [
  "none",
  "read-fixture",
  "env-demo",
  "host-chat",
] as const;
export type PermissionProfileName = (typeof PERMISSION_PROFILES)[number];

/** Future reserved names — not implemented in this milestone. */
export const FUTURE_PERMISSION_PROFILES = [
  "scoped-network",
] as const;

export const DEFAULT_PERMISSION_PROFILE: PermissionProfileName = "none";

export const PERMISSION_AUDIT_PATH = "/workspace/permission-audit.jsonl";
export const RUNTIME_VERSION_PATH = "/workspace/runtime-version.txt";

/** Harmless demo env — never application secrets. */
export const SANDBOX_DEMO_ENV_KEY = "SANDBOX_DEMO_VALUE";
export const SANDBOX_DEMO_ENV_VALUE = "hello-from-supervisor";

/** Controlled fixture directory baked into the sandbox image. */
export const FIXTURE_READ_ROOT = "/fixtures";
export const FIXTURE_ALLOWED_FILE = "/fixtures/allowed.txt";

export const HOST_SDK_READ_ROOT = "/trusted/host";

export interface DenoPermissionsGrant {
  read: string[];
  env: string[];
  net: string[];
  run: string[];
  write: string[];
  ffi: string[];
}

export type DockerNetworkMode = "none" | "sandbox-host";

export interface PermissionProfileDefinition {
  id: PermissionProfileName;
  /** Structured Deno CLI flags (no shell concatenation). */
  denoArgs: readonly string[];
  /** Extra env vars the supervisor injects into the job container. */
  envVars: Readonly<Record<string, string>>;
  /** Manifest representation derived from the same definition. */
  denoPermissions: DenoPermissionsGrant;
  /** Docker network for the job container. */
  dockerNetwork: DockerNetworkMode;
  /**
   * Host capabilities granted via Host Gateway session (distinct from Deno perms).
   * Empty for profiles without host access.
   */
  hostCapabilities: readonly string[];
}

function emptyGrants(): DenoPermissionsGrant {
  return { read: [], env: [], net: [], run: [], write: [], ffi: [] };
}

/**
 * Single source of truth for profile → Deno flags / grants / network.
 * Must stay aligned with services/sandbox/entrypoint.sh.
 *
 * IMPORTANT: Deno --allow-net to the gateway is TRANSPORT only.
 * Host capability authorization is performed by the Host Gateway.
 */
export const PERMISSION_PROFILE_DEFINITIONS: Record<
  PermissionProfileName,
  PermissionProfileDefinition
> = {
  none: {
    id: "none",
    denoArgs: [],
    envVars: {},
    denoPermissions: emptyGrants(),
    dockerNetwork: "none",
    hostCapabilities: [],
  },
  "read-fixture": {
    id: "read-fixture",
    denoArgs: [`--allow-read=${FIXTURE_READ_ROOT}`],
    envVars: {},
    denoPermissions: {
      ...emptyGrants(),
      read: [FIXTURE_READ_ROOT],
    },
    dockerNetwork: "none",
    hostCapabilities: [],
  },
  "env-demo": {
    id: "env-demo",
    denoArgs: [`--allow-env=${SANDBOX_DEMO_ENV_KEY}`],
    envVars: {
      [SANDBOX_DEMO_ENV_KEY]: SANDBOX_DEMO_ENV_VALUE,
    },
    denoPermissions: {
      ...emptyGrants(),
      env: [SANDBOX_DEMO_ENV_KEY],
    },
    dockerNetwork: "none",
    hostCapabilities: [],
  },
  "host-chat": {
    id: "host-chat",
    denoArgs: [
      "--import-map=/trusted/import_map.json",
      `--allow-read=${HOST_SDK_READ_ROOT}`,
      `--allow-net=${HOST_GATEWAY_NET_ALLOW}`,
      "--allow-env=HOST_GATEWAY_URL,HOST_CAPABILITY_TOKEN",
    ],
    // HOST_CAPABILITY_TOKEN is injected per-execution by the supervisor.
    envVars: {
      HOST_GATEWAY_URL: HOST_GATEWAY_SANDBOX_URL,
    },
    denoPermissions: {
      ...emptyGrants(),
      read: [HOST_SDK_READ_ROOT],
      env: ["HOST_GATEWAY_URL", "HOST_CAPABILITY_TOKEN"],
      net: [HOST_GATEWAY_NET_ALLOW],
    },
    dockerNetwork: "sandbox-host",
    hostCapabilities: ["chat.broadcast"],
  },
};

export function isPermissionProfileName(
  value: string,
): value is PermissionProfileName {
  return (PERMISSION_PROFILES as readonly string[]).includes(value);
}

export function resolvePermissionProfile(
  name: string | undefined | null,
): PermissionProfileDefinition | null {
  if (name === undefined || name === null || name === "") {
    return PERMISSION_PROFILE_DEFINITIONS[DEFAULT_PERMISSION_PROFILE];
  }
  if (!isPermissionProfileName(name)) return null;
  return PERMISSION_PROFILE_DEFINITIONS[name];
}

/** Build Deno CLI argv for a trusted profile (unit-testable; entrypoint mirrors this). */
export function denoCliArgsForProfile(
  profile: PermissionProfileName,
  scriptPath: string,
): string[] {
  const def = PERMISSION_PROFILE_DEFINITIONS[profile];
  return ["run", "--no-prompt", ...def.denoArgs, scriptPath];
}

export interface AuditLimits {
  maxEvents: number;
  maxBytes: number;
}

export const DEFAULT_AUDIT_LIMITS: AuditLimits = {
  maxEvents: Number(Deno.env.get("SANDBOX_AUDIT_MAX_EVENTS") ?? "200"),
  maxBytes: Number(Deno.env.get("SANDBOX_AUDIT_MAX_BYTES") ?? String(64 * 1024)),
};

/** Neutral observation derived from Deno permission audit JSONL. */
export interface PermissionAccessEvent {
  event: "permission.accessed";
  permission: string;
  /** Resource target when present (path, host, env key, etc.), else null. */
  target: string | null;
  datetime?: string;
  auditVersion?: number;
  source: "deno_permission_audit";
}

export interface ParseAuditResult {
  events: PermissionAccessEvent[];
  truncated: boolean;
  rawLineCount: number;
  acceptedCount: number;
  malformedCount: number;
}

const ALLOWED_PERMISSION_NAMES = new Set([
  "read",
  "write",
  "net",
  "env",
  "run",
  "ffi",
  "sys",
  "import",
  "hrtime",
]);

/**
 * Parse Deno permission-audit JSONL.
 * Expected fields (format v1): v, datetime, permission, value, optional stack.
 * Explicit allow/deny outcome is NOT present in the native format.
 */
export function parsePermissionAuditJsonl(
  text: string,
  limits: AuditLimits = DEFAULT_AUDIT_LIMITS,
): ParseAuditResult {
  const events: PermissionAccessEvent[] = [];
  let truncated = false;
  let rawLineCount = 0;
  let malformedCount = 0;
  let bytesSeen = 0;

  const encoder = new TextEncoder();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    rawLineCount++;
    bytesSeen += encoder.encode(line).byteLength + 1;
    if (bytesSeen > limits.maxBytes) {
      truncated = true;
      break;
    }
    if (events.length >= limits.maxEvents) {
      truncated = true;
      break;
    }

    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      malformedCount++;
      continue;
    }
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
      malformedCount++;
      continue;
    }
    const rec = obj as Record<string, unknown>;
    const permission = typeof rec.permission === "string"
      ? rec.permission.toLowerCase()
      : "";
    if (!permission || !ALLOWED_PERMISSION_NAMES.has(permission)) {
      if (!permission || permission.length > 64) {
        malformedCount++;
        continue;
      }
    }

    let target: string | null = null;
    if (rec.value === null || rec.value === undefined) {
      target = null;
    } else if (typeof rec.value === "string") {
      target = sanitizeTarget(rec.value);
    } else if (typeof rec.value === "number" || typeof rec.value === "boolean") {
      target = sanitizeTarget(String(rec.value));
    } else {
      target = sanitizeTarget(JSON.stringify(rec.value).slice(0, 256));
    }

    const event: PermissionAccessEvent = {
      event: "permission.accessed",
      permission,
      target,
      source: "deno_permission_audit",
    };
    if (typeof rec.datetime === "string") {
      event.datetime = rec.datetime.slice(0, 64);
    }
    if (typeof rec.v === "number" && Number.isFinite(rec.v)) {
      event.auditVersion = rec.v;
    }
    events.push(event);
  }

  return {
    events,
    truncated,
    rawLineCount,
    acceptedCount: events.length,
    malformedCount,
  };
}

function sanitizeTarget(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 512) return trimmed;
  return `${trimmed.slice(0, 512)}…`;
}

/** Classify subprocess failure without inventing certainty. */
export function classifyExecutionFailure(input: {
  timedOut: boolean;
  exitCode: number | null;
  stderr: string;
}): string | null {
  if (input.timedOut) return "timeout";
  if (input.exitCode === 0 || input.exitCode === null) return null;

  const stderr = input.stderr;
  if (
    stderr.includes("NotCapable") ||
    /Requires\s+\S+.*--allow-/i.test(stderr) ||
    /run again with the --allow-/i.test(stderr)
  ) {
    return "deno_permission";
  }
  return "process_nonzero_exit";
}
