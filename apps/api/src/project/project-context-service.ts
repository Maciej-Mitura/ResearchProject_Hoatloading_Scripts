/**
 * ProjectContextService — provider-independent project grounding.
 *
 * Loads base YAML (cacheable), refreshes DB overrides on each settings read,
 * and builds assistant context for every chat turn.
 */

import { parse as parseYaml } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import type { PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { withClient } from "../db/client.ts";
import * as settingsRepo from "../repositories/project-settings.ts";
import * as hostRepo from "../repositories/host.ts";
import { collectPaths, deepMerge } from "./deep-merge.ts";
import { configFile } from "./paths.ts";
import {
  applyOverridePatch,
  assertValidBaseSpec,
  FIELD_META,
  type ProjectSpec,
  type ValidationIssue,
  ProjectSettingsValidationError,
  sourceForPath,
  validateCompatibility,
  validateOverridesPatch,
  validateSettingsShape,
} from "./schema.ts";
import {
  loadHostCapabilities,
  type CapabilityCatalogue,
  type HostCapability,
} from "./capabilities.ts";
import {
  buildAssistantContext,
  type BuiltAssistantContext,
  type ContextPreview,
} from "./assistant-context-builder.ts";
import type { DynamicHostState } from "./types.ts";

export type { DynamicHostState };

const HEARTBEAT_STALE_MS = 30_000;

export interface ProjectSettingsResponse {
  base: ProjectSpec;
  overrides: Record<string, unknown>;
  effective: ProjectSpec;
  fields: Array<{
    path: string;
    category: string;
    type: string;
    label: string;
    description?: string;
    editable: boolean;
    values?: string[];
    value: unknown;
    source: "base" | "override";
    risky?: boolean;
  }>;
  issues: ValidationIssue[];
  hostState: DynamicHostState;
  preview: ContextPreview;
}

export class ProjectContextService {
  #base: ProjectSpec | null = null;
  #policy: string | null = null;
  #capabilities: CapabilityCatalogue | null = null;
  #basePath: string;
  #policyPath: string;
  #capabilitiesPath: string;

  constructor(opts?: {
    basePath?: string;
    policyPath?: string;
    capabilitiesPath?: string;
  }) {
    this.#basePath = opts?.basePath ?? configFile("project-spec.yaml");
    this.#policyPath = opts?.policyPath ?? configFile("assistant-policy.md");
    this.#capabilitiesPath = opts?.capabilitiesPath ??
      configFile("host-capabilities.yaml");
  }

  /** Clear file caches (tests / hot reload). Overrides are never long-cached. */
  clearFileCaches(): void {
    this.#base = null;
    this.#policy = null;
    this.#capabilities = null;
  }

  async loadBaseSpec(): Promise<ProjectSpec> {
    if (this.#base) return this.#base;
    const text = await Deno.readTextFile(this.#basePath);
    let raw: unknown;
    try {
      raw = parseYaml(text);
    } catch (err) {
      throw new ProjectSettingsValidationError([{
        code: "invalid_yaml",
        message: `Invalid project-spec.yaml: ${
          err instanceof Error ? err.message : String(err)
        }`,
        severity: "error",
      }]);
    }
    this.#base = assertValidBaseSpec(raw);
    return this.#base;
  }

  async loadAssistantPolicy(): Promise<string> {
    if (this.#policy) return this.#policy;
    this.#policy = await Deno.readTextFile(this.#policyPath);
    return this.#policy;
  }

  async loadCapabilities(): Promise<CapabilityCatalogue> {
    if (this.#capabilities) return this.#capabilities;
    this.#capabilities = await loadHostCapabilities(this.#capabilitiesPath);
    return this.#capabilities;
  }

  /** Always re-read overrides from DB — never serve stale settings to chat. */
  async getOverrides(client?: PoolClient): Promise<Record<string, unknown>> {
    if (client) return settingsRepo.getOverrides(client);
    return withClient((c) => settingsRepo.getOverrides(c));
  }

  async getEffective(
    client?: PoolClient,
  ): Promise<{
    base: ProjectSpec;
    overrides: Record<string, unknown>;
    effective: ProjectSpec;
    issues: ValidationIssue[];
  }> {
    const base = await this.loadBaseSpec();
    const overrides = await this.getOverrides(client);
    const effective = deepMerge(
      base as unknown as Record<string, unknown>,
      overrides,
    ) as unknown as ProjectSpec;

    const shapeIssues = validateSettingsShape(effective, { partial: false });
    const compatIssues = validateCompatibility(
      effective as unknown as Record<string, unknown>,
    );
    return {
      base,
      overrides,
      effective,
      issues: [...shapeIssues, ...compatIssues],
    };
  }

  async getDynamicHostState(client?: PoolClient): Promise<DynamicHostState> {
    const read = async (c: PoolClient): Promise<DynamicHostState> => {
      const connection = await hostRepo.getLatestConnection(c);
      const pendingCommands = await hostRepo.countPendingCommands(c);
      const connected = !!(
        connection &&
        Date.now() - new Date(connection.lastHeartbeatAt).getTime() <
          HEARTBEAT_STALE_MS
      );
      const meta = connection?.metadata ?? {};
      return {
        connected,
        bridgeConnected: connected,
        pluginVersion: connection?.pluginVersion ?? null,
        reportedServerVersion: connection?.serverVersion ?? null,
        onlinePlayers: connection?.onlinePlayers ?? null,
        maxPlayers: typeof meta.maxPlayers === "number"
          ? meta.maxPlayers
          : null,
        lastHeartbeatAt: connection?.lastHeartbeatAt ?? null,
        pendingCommands,
      };
    };
    if (client) return read(client);
    return withClient(read);
  }

  /**
   * Build fresh assistant context for the next chat turn.
   * Re-reads overrides every call so UI saves apply immediately.
   */
  async buildChatContext(
    client?: PoolClient,
  ): Promise<BuiltAssistantContext> {
    const { effective, issues } = await this.getEffective(client);
    const policy = await this.loadAssistantPolicy();
    const caps = await this.loadCapabilities();
    const hostState = await this.getDynamicHostState(client);
    const warnings = issues
      .filter((i) => i.severity === "warning" || i.severity === "error")
      .map((i) => i.message);

    return buildAssistantContext({
      assistantPolicy: policy,
      effectiveSettings: effective,
      implementedCapabilities: caps.implemented,
      roadmapCapabilities: caps.roadmap,
      hostState,
      validationWarnings: warnings,
    });
  }

  async getSettingsResponse(
    client?: PoolClient,
  ): Promise<ProjectSettingsResponse> {
    const { base, overrides, effective, issues } = await this.getEffective(
      client,
    );
    const hostState = await this.getDynamicHostState(client);
    const caps = await this.loadCapabilities();
    const built = buildAssistantContext({
      assistantPolicy: await this.loadAssistantPolicy(),
      effectiveSettings: effective,
      implementedCapabilities: caps.implemented,
      roadmapCapabilities: caps.roadmap,
      hostState,
      validationWarnings: issues.map((i) => i.message),
    });

    const overridePaths = collectPaths(overrides);
    const fields = FIELD_META.map((meta) => {
      const parts = meta.path.split(".");
      let value: unknown = effective;
      for (const p of parts) {
        value = value && typeof value === "object"
          ? (value as Record<string, unknown>)[p]
          : undefined;
      }
      return {
        path: meta.path,
        category: meta.category,
        type: meta.type,
        label: meta.label,
        description: meta.description,
        editable: meta.editable,
        values: meta.values,
        value,
        source: sourceForPath(meta.path, overridePaths),
        risky: meta.risky,
      };
    });

    return {
      base,
      overrides,
      effective,
      fields,
      issues,
      hostState,
      preview: built.preview,
    };
  }

  async patchSettings(
    patch: unknown,
    client?: PoolClient,
  ): Promise<ProjectSettingsResponse> {
    const { overrides: patchObj, issues: patchIssues } = validateOverridesPatch(
      patch,
    );
    const errors = patchIssues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      throw new ProjectSettingsValidationError(errors);
    }

    const apply = async (c: PoolClient) => {
      const existing = await settingsRepo.getOverrides(c);
      const mergedOverrides = applyOverridePatch(existing, patchObj);

      // Validate resulting effective config (errors block save)
      const base = await this.loadBaseSpec();
      const effective = deepMerge(
        base as unknown as Record<string, unknown>,
        mergedOverrides,
      );
      const shapeIssues = validateSettingsShape(effective, { partial: false });
      const compatIssues = validateCompatibility(effective);
      const blocking = [...shapeIssues, ...compatIssues].filter((i) =>
        i.severity === "error"
      );
      if (blocking.length > 0) {
        throw new ProjectSettingsValidationError(blocking);
      }

      await settingsRepo.setOverrides(c, mergedOverrides);
      return this.getSettingsResponse(c);
    };

    if (client) return apply(client);
    return withClient(apply);
  }

  async resetSettings(client?: PoolClient): Promise<ProjectSettingsResponse> {
    const run = async (c: PoolClient) => {
      await settingsRepo.resetOverrides(c);
      return this.getSettingsResponse(c);
    };
    if (client) return run(client);
    return withClient(run);
  }

  /** Implemented capability ids only (for tests / preview). */
  async listImplementedCapabilityIds(): Promise<string[]> {
    const caps = await this.loadCapabilities();
    return caps.implemented.map((c: HostCapability) => c.id);
  }
}

/** Process-wide singleton used by routes and chat. */
let singleton: ProjectContextService | null = null;

export function getProjectContextService(): ProjectContextService {
  if (!singleton) singleton = new ProjectContextService();
  return singleton;
}

export function setProjectContextServiceForTests(
  svc: ProjectContextService | null,
): void {
  singleton = svc;
}
