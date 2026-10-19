/**
 * Authoritative project-settings schema: validation, field metadata, compatibility.
 * Shared by base YAML load, override persistence, and PATCH API.
 */

import { getAtPath, isPlainObject, setAtPath } from "./deep-merge.ts";

export type FieldType = "string" | "boolean" | "enum" | "string[]" | "object";

export interface FieldMeta {
  path: string;
  category: "host" | "bridge" | "scripting" | "security" | "project";
  type: FieldType;
  label: string;
  description?: string;
  editable: boolean;
  values?: string[];
  sourceHint?: "base" | "override" | "runtime";
  risky?: boolean;
}

export interface ProjectSpec {
  host: {
    type: string;
    game: string;
    edition: "java" | "bedrock";
    gameVersion: string | null;
    serverSoftware: string;
    serverVersion: string | null;
    api: string;
  };
  bridge: {
    name: string;
    protocolVersion: string;
    pluginVersion?: string | null;
  };
  scripting: {
    supportedLanguages: string[];
    preferredLanguage: string;
    runtime: string;
    executionMode: string;
    directHostAccess: boolean;
  };
  security: {
    defaultNetworkAccess: boolean;
    filesystemAccess: boolean;
    subprocessAccess: boolean;
    ffiAccess: boolean;
    hostAccess: { mode: string };
  };
  project: {
    environment: string;
    arbitraryConsoleCommands: boolean;
    directMinecraftPluginGeneration: boolean;
    executionEnforcement?: string;
  };
}

export interface ValidationIssue {
  path?: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

export const FIELD_META: FieldMeta[] = [
  {
    path: "host.game",
    category: "host",
    type: "enum",
    label: "Game",
    editable: false,
    values: ["minecraft"],
    description: "Host game for this research PoC.",
  },
  {
    path: "host.edition",
    category: "host",
    type: "enum",
    label: "Edition",
    editable: true,
    values: ["java", "bedrock"],
    description: "Minecraft edition. Paper currently targets Java Edition.",
  },
  {
    path: "host.gameVersion",
    category: "host",
    type: "string",
    label: "Minecraft version",
    editable: true,
    description: "Configured Minecraft version the assistant should target.",
  },
  {
    path: "host.serverSoftware",
    category: "host",
    type: "enum",
    label: "Server software",
    editable: true,
    values: ["paper"],
    description: "Host server implementation.",
  },
  {
    path: "host.serverVersion",
    category: "host",
    type: "string",
    label: "Server software version",
    editable: true,
    description: "Paper/build version if known; may be null.",
  },
  {
    path: "host.api",
    category: "host",
    type: "enum",
    label: "Host API",
    editable: false,
    values: ["paper-api"],
  },
  {
    path: "host.type",
    category: "host",
    type: "string",
    label: "Host type",
    editable: false,
  },
  {
    path: "bridge.name",
    category: "bridge",
    type: "string",
    label: "Bridge name",
    editable: false,
  },
  {
    path: "bridge.protocolVersion",
    category: "bridge",
    type: "string",
    label: "Bridge protocol version",
    editable: false,
  },
  {
    path: "bridge.pluginVersion",
    category: "bridge",
    type: "string",
    label: "Bridge plugin version",
    editable: false,
  },
  {
    path: "scripting.supportedLanguages",
    category: "scripting",
    type: "string[]",
    label: "Supported languages",
    editable: false,
    values: ["javascript", "typescript"],
  },
  {
    path: "scripting.preferredLanguage",
    category: "scripting",
    type: "enum",
    label: "Preferred language",
    editable: true,
    values: ["javascript", "typescript"],
  },
  {
    path: "scripting.runtime",
    category: "scripting",
    type: "enum",
    label: "Runtime",
    editable: false,
    values: ["deno"],
  },
  {
    path: "scripting.executionMode",
    category: "scripting",
    type: "enum",
    label: "Execution mode",
    editable: false,
    values: ["sandboxed"],
  },
  {
    path: "scripting.directHostAccess",
    category: "scripting",
    type: "boolean",
    label: "Direct host access",
    editable: false,
    description: "Scripts cannot call Paper/Bukkit APIs directly.",
  },
  {
    path: "security.defaultNetworkAccess",
    category: "security",
    type: "boolean",
    label: "Default network access",
    editable: true,
    risky: true,
  },
  {
    path: "security.filesystemAccess",
    category: "security",
    type: "boolean",
    label: "Filesystem access",
    editable: true,
    risky: true,
  },
  {
    path: "security.subprocessAccess",
    category: "security",
    type: "boolean",
    label: "Subprocess access",
    editable: true,
    risky: true,
  },
  {
    path: "security.ffiAccess",
    category: "security",
    type: "boolean",
    label: "FFI access",
    editable: true,
    risky: true,
  },
  {
    path: "security.hostAccess.mode",
    category: "security",
    type: "enum",
    label: "Host access mode",
    editable: false,
    values: ["capability-based"],
  },
  {
    path: "project.environment",
    category: "project",
    type: "enum",
    label: "Environment",
    editable: true,
    values: ["local-poc", "research", "demo"],
  },
  {
    path: "project.arbitraryConsoleCommands",
    category: "project",
    type: "boolean",
    label: "Arbitrary console commands",
    editable: true,
    risky: true,
  },
  {
    path: "project.directMinecraftPluginGeneration",
    category: "project",
    type: "boolean",
    label: "Direct Minecraft plugin generation",
    editable: true,
  },
  {
    path: "project.executionEnforcement",
    category: "project",
    type: "enum",
    label: "Execution enforcement",
    editable: false,
    values: ["mocked", "partial", "enforced"],
    description:
      "Whether sandbox policy is actually enforced (mocked in this PoC).",
  },
];

const EDITABLE_PATHS = new Set(
  FIELD_META.filter((f) => f.editable).map((f) => f.path),
);

const KNOWN_TOP_KEYS = new Set([
  "host",
  "bridge",
  "scripting",
  "security",
  "project",
]);

const HOST_KEYS = new Set([
  "type",
  "game",
  "edition",
  "gameVersion",
  "serverSoftware",
  "serverVersion",
  "api",
]);
const BRIDGE_KEYS = new Set(["name", "protocolVersion", "pluginVersion"]);
const SCRIPTING_KEYS = new Set([
  "supportedLanguages",
  "preferredLanguage",
  "runtime",
  "executionMode",
  "directHostAccess",
]);
const SECURITY_KEYS = new Set([
  "defaultNetworkAccess",
  "filesystemAccess",
  "subprocessAccess",
  "ffiAccess",
  "hostAccess",
]);
const PROJECT_KEYS = new Set([
  "environment",
  "arbitraryConsoleCommands",
  "directMinecraftPluginGeneration",
  "executionEnforcement",
]);

export class ProjectSettingsValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(issues.map((i) => i.message).join("; "));
    this.name = "ProjectSettingsValidationError";
  }
}

/** Reject unknown keys; validate types for a full or partial settings object. */
export function validateSettingsShape(
  input: unknown,
  opts: { partial: boolean; onlyEditable?: boolean },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return [{
      code: "invalid_type",
      message: "Settings must be a JSON object",
      severity: "error",
    }];
  }

  for (const key of Object.keys(input)) {
    if (!KNOWN_TOP_KEYS.has(key)) {
      issues.push({
        path: key,
        code: "unknown_field",
        message: `Unknown field: ${key}`,
        severity: "error",
      });
    }
  }

  checkSection(input.host, "host", HOST_KEYS, issues);
  checkSection(input.bridge, "bridge", BRIDGE_KEYS, issues);
  checkSection(input.scripting, "scripting", SCRIPTING_KEYS, issues);
  checkSection(input.security, "security", SECURITY_KEYS, issues);
  checkSection(input.project, "project", PROJECT_KEYS, issues);

  if (isPlainObject(input.security) && input.security.hostAccess !== undefined) {
    if (!isPlainObject(input.security.hostAccess)) {
      issues.push({
        path: "security.hostAccess",
        code: "invalid_type",
        message: "security.hostAccess must be an object",
        severity: "error",
      });
    } else {
      for (const k of Object.keys(input.security.hostAccess)) {
        if (k !== "mode") {
          issues.push({
            path: `security.hostAccess.${k}`,
            code: "unknown_field",
            message: `Unknown field: security.hostAccess.${k}`,
            severity: "error",
          });
        }
      }
    }
  }

  // Typed field checks via metadata
  for (const field of FIELD_META) {
    const value = getAtPath(input, field.path);
    if (value === undefined) {
      if (!opts.partial) {
        // allow null for nullable version fields
        if (
          field.path === "host.gameVersion" ||
          field.path === "host.serverVersion" ||
          field.path === "bridge.pluginVersion" ||
          field.path === "project.executionEnforcement"
        ) {
          continue;
        }
        issues.push({
          path: field.path,
          code: "required",
          message: `Missing required field: ${field.path}`,
          severity: "error",
        });
      }
      continue;
    }

    if (opts.onlyEditable && !EDITABLE_PATHS.has(field.path)) {
      issues.push({
        path: field.path,
        code: "not_editable",
        message: `Field is not editable: ${field.path}`,
        severity: "error",
      });
      continue;
    }

    issues.push(...validateFieldValue(field, value));
  }

  return issues;
}

function checkSection(
  section: unknown,
  name: string,
  allowed: Set<string>,
  issues: ValidationIssue[],
): void {
  if (section === undefined) return;
  if (!isPlainObject(section)) {
    issues.push({
      path: name,
      code: "invalid_type",
      message: `${name} must be an object`,
      severity: "error",
    });
    return;
  }
  for (const key of Object.keys(section)) {
    if (!allowed.has(key)) {
      issues.push({
        path: `${name}.${key}`,
        code: "unknown_field",
        message: `Unknown field: ${name}.${key}`,
        severity: "error",
      });
    }
  }
}

function validateFieldValue(field: FieldMeta, value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const path = field.path;

  if (field.type === "boolean") {
    if (typeof value !== "boolean") {
      issues.push({
        path,
        code: "invalid_type",
        message: `${path} must be a boolean`,
        severity: "error",
      });
    }
    return issues;
  }

  if (field.type === "string" || field.type === "enum") {
    if (value !== null && typeof value !== "string") {
      issues.push({
        path,
        code: "invalid_type",
        message: `${path} must be a string or null`,
        severity: "error",
      });
      return issues;
    }
    if (
      typeof value === "string" &&
      field.values &&
      field.values.length > 0 &&
      !field.values.includes(value)
    ) {
      issues.push({
        path,
        code: "invalid_value",
        message: `${path} must be one of: ${field.values.join(", ")}`,
        severity: "error",
      });
    }
    if (
      typeof value === "string" &&
      (path === "host.gameVersion" || path === "host.serverVersion") &&
      value.trim() === ""
    ) {
      issues.push({
        path,
        code: "invalid_value",
        message: `${path} cannot be empty`,
        severity: "error",
      });
    }
    return issues;
  }

  if (field.type === "string[]") {
    if (
      !Array.isArray(value) ||
      !value.every((v) => typeof v === "string")
    ) {
      issues.push({
        path,
        code: "invalid_type",
        message: `${path} must be an array of strings`,
        severity: "error",
      });
    }
  }

  return issues;
}

/** Compatibility / policy warnings for an effective settings object. */
export function validateCompatibility(
  effective: Record<string, unknown>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const edition = getAtPath(effective, "host.edition");
  const software = getAtPath(effective, "host.serverSoftware");
  const game = getAtPath(effective, "host.game");

  if (game !== "minecraft") {
    issues.push({
      path: "host.game",
      code: "unsupported_host",
      message:
        "Only Minecraft is supported by the current SecureBridge environment.",
      severity: "error",
    });
  }

  if (edition === "bedrock" && software === "paper") {
    issues.push({
      path: "host.edition",
      code: "incompatible_combination",
      message:
        "Paper currently targets Minecraft Java Edition. The selected host configuration is not compatible with the current SecureBridge environment.",
      severity: "error",
    });
  }

  if (software && software !== "paper") {
    issues.push({
      path: "host.serverSoftware",
      code: "unsupported_software",
      message:
        `Server software "${String(software)}" is not supported by this SecureBridge PoC (Paper only).`,
      severity: "error",
    });
  }

  const preferred = getAtPath(effective, "scripting.preferredLanguage");
  const supported = getAtPath(effective, "scripting.supportedLanguages");
  if (
    typeof preferred === "string" &&
    Array.isArray(supported) &&
    !supported.includes(preferred)
  ) {
    issues.push({
      path: "scripting.preferredLanguage",
      code: "unsupported_language",
      message: `Preferred language "${preferred}" is not in supportedLanguages.`,
      severity: "error",
    });
  }

  // Risky policy warnings (non-blocking)
  const riskyFlags: Array<[string, string]> = [
    ["security.defaultNetworkAccess", "network access"],
    ["security.filesystemAccess", "filesystem access"],
    ["security.subprocessAccess", "subprocess access"],
    ["security.ffiAccess", "FFI access"],
    ["project.arbitraryConsoleCommands", "arbitrary console commands"],
  ];
  for (const [path, label] of riskyFlags) {
    if (getAtPath(effective, path) === true) {
      issues.push({
        path,
        code: "risky_policy",
        message:
          `This setting expands the authority available to generated scripts (${label}). The current prototype may not yet implement the corresponding enforcement.`,
        severity: "warning",
      });
    }
  }

  const enforcement = getAtPath(effective, "project.executionEnforcement");
  if (enforcement === "mocked") {
    issues.push({
      path: "project.executionEnforcement",
      code: "enforcement_mocked",
      message:
        "Configured security policy is research intent; execution enforcement is currently mocked / not yet implemented.",
      severity: "warning",
    });
  }

  return issues;
}

/** Validate a full base spec (must pass with no errors). */
export function assertValidBaseSpec(raw: unknown): ProjectSpec {
  const shapeIssues = validateSettingsShape(raw, { partial: false });
  const errors = shapeIssues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new ProjectSettingsValidationError(errors);
  }
  const compat = validateCompatibility(raw as Record<string, unknown>);
  const compatErrors = compat.filter((i) => i.severity === "error");
  if (compatErrors.length > 0) {
    throw new ProjectSettingsValidationError(compatErrors);
  }
  return raw as ProjectSpec;
}

/** Validate PATCH body: only editable fields, known keys. */
export function validateOverridesPatch(
  patch: unknown,
): { overrides: Record<string, unknown>; issues: ValidationIssue[] } {
  const shapeIssues = validateSettingsShape(patch, {
    partial: true,
    onlyEditable: true,
  });
  return {
    overrides: isPlainObject(patch) ? patch as Record<string, unknown> : {},
    issues: shapeIssues,
  };
}

/** Merge patch into existing overrides (deep). */
export function applyOverridePatch(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next = structuredClone(existing);
  for (const field of FIELD_META) {
    if (!field.editable) continue;
    const value = getAtPath(patch, field.path);
    if (value === undefined) continue;
    setAtPath(next, field.path, value);
  }
  return next;
}

export function sourceForPath(
  path: string,
  overridePaths: Set<string>,
): "base" | "override" {
  return overridePaths.has(path) ? "override" : "base";
}
