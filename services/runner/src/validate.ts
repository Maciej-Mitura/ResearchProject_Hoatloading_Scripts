import {
  ALLOWED_LANGUAGES,
  ALLOWED_REQUEST_FIELDS,
  LIMITS,
  type AllowedLanguage,
} from "./config.ts";
import {
  DEFAULT_PERMISSION_PROFILE,
  isPermissionProfileName,
  type PermissionProfileName,
} from "./permissions.ts";

export interface ExecuteRequest {
  executionId: string;
  language: AllowedLanguage;
  source: string;
  permissionProfile: PermissionProfileName;
  /** Trusted OTel correlation id from API — never capability authorization. */
  traceId?: string | null;
}

export interface ValidationOk {
  ok: true;
  value: ExecuteRequest;
}

export interface ValidationErr {
  ok: false;
  message: string;
  rejectedFields?: string[];
}

export type ValidationResult = ValidationOk | ValidationErr;

/**
 * Narrow request validation.
 * Rejects unknown fields (image, mounts, privileged, runtime, raw Deno flags, etc.).
 * Only a trusted permissionProfile ID is accepted — never --allow-* strings.
 */
export function validateExecuteRequest(body: unknown): ValidationResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Request body must be a JSON object" };
  }

  const record = body as Record<string, unknown>;
  const allowed = new Set<string>(ALLOWED_REQUEST_FIELDS);
  const rejectedFields = Object.keys(record).filter((k) => !allowed.has(k));
  if (rejectedFields.length > 0) {
    return {
      ok: false,
      message:
        "Unsupported fields rejected. The supervisor owns image, mounts, env, runtime, resource limits, and Deno permission flags.",
      rejectedFields,
    };
  }

  const executionId = record.executionId;
  const language = record.language;
  const source = record.source;

  if (typeof executionId !== "string" || executionId.trim().length === 0) {
    return { ok: false, message: "executionId is required (non-empty string)" };
  }
  if (executionId.length > 128) {
    return { ok: false, message: "executionId is too long" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(executionId)) {
    return {
      ok: false,
      message: "executionId must be alphanumeric, underscore, or hyphen",
    };
  }

  if (typeof language !== "string") {
    return { ok: false, message: "language is required" };
  }
  if (!(ALLOWED_LANGUAGES as readonly string[]).includes(language)) {
    return {
      ok: false,
      message: `language must be one of: ${ALLOWED_LANGUAGES.join(", ")}`,
    };
  }

  if (typeof source !== "string") {
    return { ok: false, message: "source is required (string)" };
  }
  const sourceBytes = new TextEncoder().encode(source).byteLength;
  if (sourceBytes > LIMITS.maxSourceBytes) {
    return {
      ok: false,
      message: `source exceeds maximum size (${LIMITS.maxSourceBytes} bytes)`,
    };
  }

  let permissionProfile: PermissionProfileName = DEFAULT_PERMISSION_PROFILE;
  if (record.permissionProfile !== undefined) {
    if (typeof record.permissionProfile !== "string") {
      return { ok: false, message: "permissionProfile must be a string ID" };
    }
    if (!isPermissionProfileName(record.permissionProfile)) {
      return {
        ok: false,
        message:
          `Unknown permissionProfile '${record.permissionProfile}'. ` +
          "Allowed: none, read-fixture, env-demo. Raw Deno flags are not accepted.",
      };
    }
    permissionProfile = record.permissionProfile;
  }

  let traceId: string | null = null;
  if (record.traceId !== undefined && record.traceId !== null) {
    if (typeof record.traceId !== "string") {
      return { ok: false, message: "traceId must be a string when provided" };
    }
    const t = record.traceId.trim().toLowerCase();
    if (t && !/^[0-9a-f]{32}$/.test(t)) {
      return {
        ok: false,
        message: "traceId must be a 32-char hex W3C trace id when provided",
      };
    }
    traceId = t || null;
  }

  return {
    ok: true,
    value: {
      executionId,
      language: language as AllowedLanguage,
      source,
      permissionProfile,
      traceId,
    },
  };
}
