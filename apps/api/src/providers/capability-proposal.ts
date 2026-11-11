import {
  parseProject,
  PLATFORM_LIMITATIONS,
  projectSource,
  projectText,
} from "../../../../packages/contracts/src/script-project.ts";

import { CAPABILITY_EXAMPLES } from "../../../../packages/contracts/src/capabilities.ts";

import {
  CAPABILITIES,
  object,
  onlyKeys,
  prepareRequests,
} from "../../../../packages/contracts/src/capabilities.ts";

import type { ChatTurnResult } from "./chat.ts";

export const CAPABILITY_ASSISTANT_CONTRACT = `

POST-RESEARCH CAPABILITY EXTENSION: this current registry supersedes older statements that only chat is available.

${JSON.stringify(CAPABILITIES)}

Exact SDK examples: ${JSON.stringify(CAPABILITY_EXAMPLES)}

Platform limitations: ${PLATFORM_LIMITATIONS.join(" ")}

Return JSON {message:string,proposal:null|{name,description,language,source,project?:{entrypoint,files:[{path,content}]},requestedCapabilities:[{capability,required,reason,constraints:{maxCalls,entityTypes?,playerNames?,materials?,weather?,times?,sounds?}}]}}.

Simple scripts stay one file. If helpers/config improve clarity or the user requests multi-file, return project with 2–20 relative .ts/.js/.json files (256KiB/file,512KiB total), entrypoint names an existing .ts/.js file; source MUST equal entrypoint content. Local imports use relative paths including extensions; JSON imports use with {type:"json"}. No npm/jsr/http imports or dependencies. All files are one version and one approval boundary.

No approved/granted permissions fields. You propose; the user approves each saved version. All new permissions start unchecked.

Use only import { host } from "host". For host calls select the UI mode named Per-script permissions after saving/reviewing. The internal profile identifier is not a user-facing instruction; never tell users to select host-capabilities. Review can happen directly in chat or in Workbench. No commands, NBT, reflection, arbitrary Paper calls or subscriptions.

host.server.status() returns {onlinePlayers,maxPlayers,version,demoLocation:{x,y,z}}; use demoLocation for nearby spawns (within 32 blocks horizontally, y -8..+16; loaded chunks only).

host.world.spawnEntity({type,x,y,z}) supports ZOMBIE/SKELETON/COW/PIG, max3. Demo entities are stationary and removed after60seconds.

host.player.sendMessage(playerName,message) online only, max256 chars; default demo target GoldennBullet. Ask for missing requirements where needed.

Effect calls return {accepted,success?,commandId?,error?}; accepted alone means queued. status throws on unconfirmed/failure.

Await calls; use Promise.all for multiple spawns to fit the10second execution limit. Pure calculations request [].

Persistent click/join/event listeners are unavailable. For mixed requests explain the unsupported listener and offer/generate the supported one-shot actions. Do not refuse supported synchronous actions merely because they are not chat. Never invent APIs. Unsupported IDs may be reported in a manifest but cannot be approved.

Capability impact is registry metadata, not the frozen deterministic risk classifier. No advisory approval authority.

`;

// Keep the provider grammar small. The strict application parser below remains
// authoritative for every capability, field, constraint and quota.
const requestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["capability", "required", "reason", "constraints"],
  properties: {
    capability: { type: "string" },
    required: { type: "boolean" },
    reason: { type: "string" },
    constraints: { type: "object", additionalProperties: true },
  },
};
export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",

  required: ["message", "proposal"],

  additionalProperties: false,

  properties: {
    message: { type: "string" },

    proposal: {
      anyOf: [{ type: "null" }, {
        type: "object",

        additionalProperties: false,

        required: [
          "name",

          "description",

          "language",

          "source",

          "requestedCapabilities",
        ],

        properties: {
          name: { type: "string" },

          description: { type: "string" },

          language: { type: "string", enum: ["typescript", "javascript"] },

          source: { type: "string" },

          project: {
            type: "object",
            additionalProperties: false,
            required: ["entrypoint", "files"],
            properties: {
              entrypoint: { type: "string" },
              files: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["path", "content"],
                  properties: {
                    path: { type: "string" },
                    content: { type: "string" },
                  },
                },
              },
            },
          },

          requestedCapabilities: {
            type: "array",

            items: requestSchema,
          },
        },
      }],
    },
  },
};

export function parseCapabilityProposal(text: string): ChatTurnResult {
  const b = object(JSON.parse(text));

  onlyKeys(b, ["message", "proposal"]);

  if (
    typeof b.message !== "string" || !b.message.trim() ||
    b.message.length > 50000
  ) throw new Error("Invalid assistant message");

  if (b.proposal === null) return { content: b.message };

  const p = object(b.proposal);

  onlyKeys(p, [
    "name",

    "description",

    "language",

    "source",

    "project",

    "requestedCapabilities",
  ]);

  if (
    typeof p.name !== "string" || !p.name.trim() || p.name.length > 200 ||
    typeof p.description !== "string" || p.description.length > 2000 ||
    !["typescript", "javascript"].includes(String(p.language)) ||
    typeof p.source !== "string" || !p.source.trim() ||
    new TextEncoder().encode(p.source).length > 256 * 1024 ||
    p.requestedCapabilities === undefined
  ) throw new Error("Invalid script proposal");

  const project = p.project === undefined ? undefined : parseProject(p.project);

  if (project && projectSource(project) !== p.source) {
    throw new Error("Project entrypoint/source mismatch");
  }

  const { requested, warnings } = prepareRequests(
    project ? projectText(project) : p.source,
    p.requestedCapabilities,
  );

  return {
    content: b.message + (warnings.length ? "\n\n" + warnings.join("\n") : ""),

    proposal: {
      name: p.name,

      description: p.description,

      language: String(p.language),

      source: p.source,

      ...(project ? { project } : {}),

      requestedCapabilities: requested,
    },

    metadata: { capabilityWarnings: warnings, capabilityContractVersion: 1 },
  };
}
