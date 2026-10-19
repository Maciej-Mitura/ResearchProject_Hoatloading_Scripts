/**
 * Provider-independent assistant context builder.
 * Produces a structured system instruction for any ChatProvider.
 *
 * Future structured AI responses may include:
 * intent, summary, requiredCapabilities, unsupportedCapabilities,
 * compatibility, script, warnings — not required in this version.
 */

import type { ProjectSpec } from "./schema.ts";
import type { HostCapability } from "./capabilities.ts";
import type { DynamicHostState } from "./types.ts";
import { stringify as stringifyYaml } from "https://deno.land/std@0.224.0/yaml/mod.ts";

export interface AssistantContextInput {
  assistantPolicy: string;
  effectiveSettings: ProjectSpec;
  implementedCapabilities: HostCapability[];
  /** Roadmap only — never presented as available. */
  roadmapCapabilities?: HostCapability[];
  hostState: DynamicHostState;
  validationWarnings?: string[];
}

export interface BuiltAssistantContext {
  /** Full system instruction text for LLM providers. */
  systemInstruction: string;
  /** Safe summary for UI Context Preview (no secrets). */
  preview: ContextPreview;
}

export interface ContextPreview {
  game: string;
  server: string;
  runtime: string;
  preferredLanguage: string;
  network: string;
  filesystem: string;
  hostCapabilities: string[];
  hostStatus: string;
  reportedGameVersion: string | null;
  versionMismatch: boolean;
  enforcement: string;
  warnings: string[];
}

export function buildAssistantContext(
  input: AssistantContextInput,
): BuiltAssistantContext {
  const { effectiveSettings: s } = input;
  const settingsYaml = stringifyYaml(s).trim();

  const capsBlock = input.implementedCapabilities.length === 0
    ? "(none implemented)"
    : input.implementedCapabilities
      .map((c) => {
        const lines = [
          `- ${c.id}: ${c.description}`,
        ];
        if (c.bridgeCommand) lines.push(`  bridgeCommand: ${c.bridgeCommand}`);
        if (c.parameters) {
          lines.push(`  parameters: ${JSON.stringify(c.parameters)}`);
        }
        if (c.returns) lines.push(`  returns: ${JSON.stringify(c.returns)}`);
        if (c.constraints?.length) {
          lines.push(`  constraints: ${c.constraints.join("; ")}`);
        }
        return lines.join("\n");
      })
      .join("\n");

  const roadmapNote = input.roadmapCapabilities &&
      input.roadmapCapabilities.length > 0
    ? `\n\n<roadmap_host_capabilities status="not_available">\n` +
      `These are NOT implemented. Do not invent or call them.\n` +
      input.roadmapCapabilities
        .map((c) => `- ${c.id} (${c.status}): ${c.description}`)
        .join("\n") +
      `\n</roadmap_host_capabilities>`
    : "";

  const hostStateYaml = stringifyYaml(input.hostState).trim();
  const warnings = input.validationWarnings ?? [];
  const warnBlock = warnings.length
    ? `\n\n<configuration_warnings>\n${
      warnings.map((w) => `- ${w}`).join("\n")
    }\n</configuration_warnings>`
    : "";

  const systemInstruction = [
    "<assistant_policy>",
    input.assistantPolicy.trim(),
    "</assistant_policy>",
    "",
    "<project_settings>",
    "Effective Project Settings (authoritative for this project). Use these values;",
    "do not invent versions or switch silently.",
    settingsYaml,
    "</project_settings>",
    "",
    "<implemented_host_capabilities>",
    "Only these host capabilities may be used by user scripts via SecureBridge:",
    capsBlock,
    "</implemented_host_capabilities>",
    roadmapNote,
    "",
    "<current_host_state>",
    "Observed runtime state (may differ from configured project settings):",
    hostStateYaml,
    "</current_host_state>",
    warnBlock,
    "",
    "Prefer examples in the configured preferred language:",
    `scripting.preferredLanguage = ${s.scripting.preferredLanguage}`,
  ].filter((line) => line !== undefined).join("\n");

  const edition = s.host.edition;
  const gameLabel = `${capitalize(s.host.game)} ${capitalize(edition)} ${
    s.host.gameVersion ?? "unknown"
  }`;
  const serverLabel = `${capitalize(s.host.serverSoftware)} ${
    s.host.serverVersion ?? s.host.gameVersion ?? ""
  }`.trim();

  const reported = input.hostState.reportedServerVersion;
  const configured = s.host.gameVersion;
  const versionMismatch = !!(
    configured &&
    reported &&
    !String(reported).includes(String(configured))
  );

  const preview: ContextPreview = {
    game: gameLabel,
    server: serverLabel,
    runtime: s.scripting.runtime,
    preferredLanguage: s.scripting.preferredLanguage,
    network: s.security.defaultNetworkAccess ? "Enabled (policy)" : "Disabled (policy)",
    filesystem: s.security.filesystemAccess ? "Enabled (policy)" : "Disabled (policy)",
    hostCapabilities: input.implementedCapabilities.map((c) => c.id),
    hostStatus: input.hostState.connected ? "Connected" : "Disconnected",
    reportedGameVersion: reported,
    versionMismatch,
    enforcement: s.project.executionEnforcement ?? "unknown",
    warnings: [
      ...warnings,
      ...(versionMismatch
        ? [
          "Configured Minecraft version differs from the currently connected server.",
        ]
        : []),
    ],
  };

  return { systemInstruction, preview };
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
