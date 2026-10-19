import {
  assertEquals,
  assertExists,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { parse as parseYaml } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { deepMerge } from "../src/project/deep-merge.ts";
import {
  assertValidBaseSpec,
  ProjectSettingsValidationError,
  validateCompatibility,
  validateOverridesPatch,
  validateSettingsShape,
} from "../src/project/schema.ts";
import { ProjectContextService } from "../src/project/project-context-service.ts";
import { buildAssistantContext } from "../src/project/assistant-context-builder.ts";
import { configFile } from "../src/project/paths.ts";
import { GeminiChatProvider } from "../src/providers/gemini.ts";

Deno.test("base project-spec.yaml loads and validates", async () => {
  const text = await Deno.readTextFile(configFile("project-spec.yaml"));
  const raw = parseYaml(text);
  const spec = assertValidBaseSpec(raw);
  assertEquals(spec.host.game, "minecraft");
  assertEquals(spec.host.edition, "java");
  assertEquals(spec.host.gameVersion, "1.21.1");
  assertEquals(spec.host.serverSoftware, "paper");
  assertEquals(spec.scripting.preferredLanguage, "typescript");
  assertEquals(spec.scripting.runtime, "deno");
  assertEquals(spec.security.filesystemAccess, false);
  assertEquals(spec.bridge.protocolVersion, "1");
});

Deno.test("invalid YAML fails clearly", async () => {
  const dir = await Deno.makeTempDir();
  const badPath = join(dir, "project-spec.yaml");
  await Deno.writeTextFile(badPath, "host: [\n  broken");
  const svc = new ProjectContextService({ basePath: badPath });
  await assertRejects(
    () => svc.loadBaseSpec(),
    ProjectSettingsValidationError,
  );
});

Deno.test("settings schema rejects unknown fields", () => {
  const issues = validateSettingsShape(
    { host: { gameVersion: "1.21.5", mystery: true } },
    { partial: true, onlyEditable: true },
  );
  assertEquals(issues.some((i) => i.code === "unknown_field"), true);
});

Deno.test("project overrides merge correctly", () => {
  const base = {
    host: { gameVersion: "1.21.1", edition: "java" },
    scripting: { preferredLanguage: "typescript" },
  };
  const overrides = { host: { gameVersion: "1.21.5" } };
  const effective = deepMerge(base, overrides);
  assertEquals(effective.host.gameVersion, "1.21.5");
  assertEquals(effective.host.edition, "java");
  assertEquals(effective.scripting.preferredLanguage, "typescript");
});

Deno.test("bedrock + paper is incompatible", () => {
  const issues = validateCompatibility({
    host: {
      game: "minecraft",
      edition: "bedrock",
      serverSoftware: "paper",
      gameVersion: "1.21.1",
    },
    scripting: {
      preferredLanguage: "typescript",
      supportedLanguages: ["javascript", "typescript"],
    },
  });
  assertEquals(
    issues.some((i) => i.code === "incompatible_combination"),
    true,
  );
});

Deno.test("PATCH validation rejects non-editable fields", () => {
  const { issues } = validateOverridesPatch({
    scripting: { runtime: "node" },
  });
  assertEquals(issues.some((i) => i.code === "not_editable"), true);
});

Deno.test("assistant context includes policy, settings, capabilities, host state", async () => {
  const svc = new ProjectContextService();
  const policy = await svc.loadAssistantPolicy();
  const caps = await svc.loadCapabilities();
  const base = await svc.loadBaseSpec();

  const built = buildAssistantContext({
    assistantPolicy: policy,
    effectiveSettings: {
      ...base,
      host: { ...base.host, gameVersion: "1.21.5" },
    },
    implementedCapabilities: caps.implemented,
    roadmapCapabilities: caps.roadmap,
    hostState: {
      connected: true,
      bridgeConnected: true,
      pluginVersion: "0.1.0",
      reportedServerVersion: "1.21.1",
      onlinePlayers: 0,
      maxPlayers: 20,
      lastHeartbeatAt: new Date().toISOString(),
      pendingCommands: 0,
    },
  });

  assertStringIncludes(built.systemInstruction, "<assistant_policy>");
  assertStringIncludes(built.systemInstruction, "<project_settings>");
  assertStringIncludes(built.systemInstruction, "gameVersion: 1.21.5");
  assertEquals(built.systemInstruction.includes("1.21.4"), false);
  assertStringIncludes(built.systemInstruction, "<implemented_host_capabilities>");
  assertStringIncludes(built.systemInstruction, "chat.broadcast");
  assertStringIncludes(built.systemInstruction, "server.status");
  assertStringIncludes(built.systemInstruction, "server.player_list");
  assertStringIncludes(built.systemInstruction, "not_available");
  assertStringIncludes(built.systemInstruction, "events.playerJoin");
  assertStringIncludes(built.systemInstruction, "<current_host_state>");
  assertEquals(built.systemInstruction.toLowerCase().includes("api_key"), false);
  assertEquals(built.systemInstruction.includes("AIza"), false);
  assertEquals(built.systemInstruction.includes("sk-"), false);
  assertEquals(built.preview.preferredLanguage, "typescript");
  assertEquals(built.preview.hostCapabilities.includes("chat.broadcast"), true);
  assertEquals(built.preview.versionMismatch, true);
});

Deno.test("latest override wins in next assistant context (no stale base version)", async () => {
  const svc = new ProjectContextService();
  const base = await svc.loadBaseSpec();
  assertEquals(base.host.gameVersion, "1.21.1");

  const caps = await svc.loadCapabilities();
  const policy = await svc.loadAssistantPolicy();

  const next = buildAssistantContext({
    assistantPolicy: policy,
    effectiveSettings: deepMerge(
      base as unknown as Record<string, unknown>,
      { host: { gameVersion: "1.21.5" } },
    ) as unknown as typeof base,
    implementedCapabilities: caps.implemented,
    hostState: {
      connected: false,
      bridgeConnected: false,
      pluginVersion: null,
      reportedServerVersion: null,
      onlinePlayers: null,
      maxPlayers: null,
      lastHeartbeatAt: null,
      pendingCommands: 0,
    },
  });

  assertStringIncludes(next.systemInstruction, "1.21.5");
  const settingsSection = next.systemInstruction.split("<project_settings>")[1]
    ?.split("</project_settings>")[0] ?? "";
  assertStringIncludes(settingsSection, "1.21.5");
  assertEquals(settingsSection.includes("1.21.1"), false);
});

Deno.test("host-capabilities.yaml only lists real implemented bridge commands", async () => {
  const svc = new ProjectContextService();
  const caps = await svc.loadCapabilities();
  const ids = caps.implemented.map((c) => c.id).sort();
  assertEquals(ids, ["chat.broadcast", "server.player_list", "server.status"]);
  const cmds = caps.implemented.map((c) => c.bridgeCommand).sort();
  assertEquals(cmds, [
    "broadcast_message",
    "request_player_list",
    "request_status",
  ]);
  assertExists(caps.roadmap.find((c) => c.id === "events.playerJoin"));
});

Deno.test("GeminiChatProvider uses supplied systemInstruction from context builder", async () => {
  let seen = "";
  const chat = new GeminiChatProvider({
    apiKey: "AIza-test",
    model: "gemini-3.8-flash",
    generate: async (params) => {
      seen = params.systemInstruction;
      return "ok";
    },
  });
  await chat.respond({
    conversationId: "c1",
    userMessage: "What version?",
    history: [],
    systemInstruction:
      '<project_settings>\ngameVersion: "1.21.5"\n</project_settings>',
  });
  assertStringIncludes(seen, "1.21.5");
  assertEquals(seen.includes("1.21.1"), false);
});
