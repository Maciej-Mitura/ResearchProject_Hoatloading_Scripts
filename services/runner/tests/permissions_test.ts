import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyExecutionFailure,
  denoCliArgsForProfile,
  FIXTURE_READ_ROOT,
  parsePermissionAuditJsonl,
  PERMISSION_PROFILE_DEFINITIONS,
  resolvePermissionProfile,
  SANDBOX_DEMO_ENV_KEY,
  SANDBOX_DEMO_ENV_VALUE,
} from "../src/permissions.ts";
import { buildExecutionManifest, parseMemoryLimitMb } from "../src/manifest.ts";
import { SANDBOX_DENO_VERSION } from "../src/config.ts";
import { validateExecuteRequest } from "../src/validate.ts";

Deno.test("pinned runtime version is explicit semver", () => {
  assertEquals(/^\d+\.\d+\.\d+$/.test(SANDBOX_DENO_VERSION), true);
  assertEquals(SANDBOX_DENO_VERSION, "2.9.7");
});

Deno.test("trusted profiles define structured denoArgs", () => {
  assertEquals(PERMISSION_PROFILE_DEFINITIONS.none.denoArgs, []);
  assertEquals(PERMISSION_PROFILE_DEFINITIONS["read-fixture"].denoArgs, [
    `--allow-read=${FIXTURE_READ_ROOT}`,
  ]);
  assertEquals(PERMISSION_PROFILE_DEFINITIONS["env-demo"].denoArgs, [
    `--allow-env=${SANDBOX_DEMO_ENV_KEY}`,
  ]);
  assertEquals(
    PERMISSION_PROFILE_DEFINITIONS["env-demo"].envVars[SANDBOX_DEMO_ENV_KEY],
    SANDBOX_DEMO_ENV_VALUE,
  );
  const hc = PERMISSION_PROFILE_DEFINITIONS["host-chat"];
  assertEquals(hc.dockerNetwork, "sandbox-host");
  assertEquals(hc.hostCapabilities, ["chat.broadcast"]);
  assertEquals(hc.denoPermissions.net.includes("host-gateway:3200"), true);
  assertEquals(hc.denoArgs.some((a) => a.startsWith("--allow-net=")), true);
  assertEquals(hc.denoArgs.includes("--allow-read=/trusted/host"), true);
});

Deno.test("denoCliArgsForProfile matches trusted definitions", () => {
  assertEquals(denoCliArgsForProfile("none", "/workspace/main.js"), [
    "run",
    "--no-prompt",
    "/workspace/main.js",
  ]);
  assertEquals(denoCliArgsForProfile("read-fixture", "/workspace/main.js"), [
    "run",
    "--no-prompt",
    "--allow-read=/fixtures",
    "/workspace/main.js",
  ]);
  assertEquals(denoCliArgsForProfile("env-demo", "/workspace/main.ts"), [
    "run",
    "--no-prompt",
    "--allow-env=SANDBOX_DEMO_VALUE",
    "/workspace/main.ts",
  ]);
});

Deno.test("resolvePermissionProfile rejects unknown IDs", () => {
  assertEquals(resolvePermissionProfile("none")?.id, "none");
  assertEquals(resolvePermissionProfile(undefined)?.id, "none");
  assertEquals(resolvePermissionProfile("allow-all"), null);
  assertEquals(resolvePermissionProfile("--allow-read=/etc"), null);
});

Deno.test("manifest denoPermissions derives from profile definition", () => {
  const none = buildExecutionManifest({ permissionProfile: "none" });
  assertEquals(none.permissionProfile, "none");
  assertEquals(none.denoPermissions.read, []);
  assertEquals(none.denoPermissions.env, []);

  const rf = buildExecutionManifest({ permissionProfile: "read-fixture" });
  assertEquals(rf.permissionProfile, "read-fixture");
  assertEquals(rf.denoPermissions, {
    read: ["/fixtures"],
    env: [],
    net: [],
    run: [],
    write: [],
    ffi: [],
  });

  const env = buildExecutionManifest({ permissionProfile: "env-demo" });
  assertEquals(env.denoPermissions.env, ["SANDBOX_DEMO_VALUE"]);
});

Deno.test("manifest derives limits from supervisor config", () => {
  const m = buildExecutionManifest({
    observedRuntimeVersion: "deno 2.9.7 (stable, release)",
  });
  assertEquals(m.runtime, "deno");
  assertEquals(m.runtimeVersion, "2.9.7");
  assertEquals(m.executionProvider, "docker");
  assertEquals(m.permissionProfile, "none");
  assertEquals(m.networkMode, "none");
  assertEquals(m.rootFilesystemReadOnly, true);
  assertEquals(m.permissionAuditEnabled, true);
  assertEquals(m.cpuLimit, 0.5);
  assertEquals(m.memoryLimitMb, 256);
  assertEquals(m.pidsLimit, 64);
  assertEquals(m.timeoutMs, 10000);
});

Deno.test("parseMemoryLimitMb", () => {
  assertEquals(parseMemoryLimitMb("256m"), 256);
  assertEquals(parseMemoryLimitMb("1g"), 1024);
});

Deno.test("validateExecuteRequest accepts known permissionProfile", () => {
  const r = validateExecuteRequest({
    executionId: "abc-123",
    language: "javascript",
    source: "console.log(1)",
    permissionProfile: "read-fixture",
  });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.value.permissionProfile, "read-fixture");
});

Deno.test("validateExecuteRequest defaults permissionProfile to none", () => {
  const r = validateExecuteRequest({
    executionId: "abc-123",
    language: "javascript",
    source: "console.log(1)",
  });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.value.permissionProfile, "none");
});

Deno.test("validateExecuteRequest rejects unknown permissionProfile", () => {
  const r = validateExecuteRequest({
    executionId: "abc-123",
    language: "javascript",
    source: "console.log(1)",
    permissionProfile: "allow-all",
  });
  assertEquals(r.ok, false);
});

Deno.test("validateExecuteRequest accepts host-chat", () => {
  const r = validateExecuteRequest({
    executionId: "abc-123",
    language: "javascript",
    source: 'import { host } from "host";',
    permissionProfile: "host-chat",
  });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.value.permissionProfile, "host-chat");
});

Deno.test("manifest for host-chat records transport vs host capability", () => {
  const m = buildExecutionManifest({ permissionProfile: "host-chat" });
  assertEquals(m.permissionProfile, "host-chat");
  assertEquals(m.hostCapabilities, ["chat.broadcast"]);
  assertEquals(m.dockerNetwork, "sandbox-host");
  assertEquals(m.denoPermissions.net, ["host-gateway:3200"]);
  // Deno net grant is not the same as unrestricted host authority
  assertEquals(m.hostCapabilities.includes("console.execute"), false);
});

Deno.test("validateExecuteRequest rejects raw Deno flag fields", () => {
  const r = validateExecuteRequest({
    executionId: "abc-123",
    language: "javascript",
    source: "console.log(1)",
    denoArgs: ["--allow-read=/"],
    allowRead: "/etc",
  });
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.rejectedFields?.includes("denoArgs"), true);
    assertEquals(r.rejectedFields?.includes("allowRead"), true);
  }
});

Deno.test("parsePermissionAuditJsonl accepts Deno v1 format", () => {
  const jsonl = [
    JSON.stringify({
      v: 1,
      datetime: "2026-10-19T12:00:00Z",
      permission: "read",
      value: "/etc/hosts",
    }),
    JSON.stringify({
      v: 1,
      datetime: "2026-10-19T12:00:01Z",
      permission: "net",
      value: "example.com:443",
    }),
  ].join("\n");

  const parsed = parsePermissionAuditJsonl(jsonl);
  assertEquals(parsed.acceptedCount, 2);
  assertEquals(parsed.events[0].event, "permission.accessed");
  assertEquals(parsed.events[0].source, "deno_permission_audit");
  assertEquals("outcome" in parsed.events[0], false);
});

Deno.test("parsePermissionAuditJsonl ignores malformed lines", () => {
  const jsonl = [
    "not-json",
    JSON.stringify({ permission: "read", value: "/tmp/x" }),
    JSON.stringify({ v: 1, permission: "read", value: "/ok" }),
  ].join("\n");
  const parsed = parsePermissionAuditJsonl(jsonl);
  assertEquals(parsed.acceptedCount, 2);
  assertEquals(parsed.malformedCount >= 1, true);
});

Deno.test("parsePermissionAuditJsonl truncates by max events", () => {
  const lines = [];
  for (let i = 0; i < 10; i++) {
    lines.push(JSON.stringify({ v: 1, permission: "read", value: `/f${i}` }));
  }
  const parsed = parsePermissionAuditJsonl(lines.join("\n"), {
    maxEvents: 3,
    maxBytes: 1024 * 1024,
  });
  assertEquals(parsed.acceptedCount, 3);
  assertEquals(parsed.truncated, true);
});

Deno.test("classifyExecutionFailure detects NotCapable", () => {
  const stderr =
    'error: Uncaught (in promise) NotCapable: Requires read access to "/etc/hosts", run again with the --allow-read flag';
  assertEquals(
    classifyExecutionFailure({ timedOut: false, exitCode: 1, stderr }),
    "deno_permission",
  );
});

Deno.test("permission events never embed script source", () => {
  const source = 'await Deno.readTextFile("/etc/hosts"); // SECRET_KEY=abc';
  const jsonl = JSON.stringify({
    v: 1,
    permission: "read",
    value: "/etc/hosts",
  });
  const parsed = parsePermissionAuditJsonl(jsonl);
  const blob = JSON.stringify(parsed.events);
  assertEquals(blob.includes(source), false);
  assertEquals(blob.includes("SECRET_KEY"), false);
  assertStringIncludes(blob, "/etc/hosts");
});

Deno.test("env-demo profile env vars contain no application secrets", () => {
  const env = PERMISSION_PROFILE_DEFINITIONS["env-demo"].envVars;
  const blob = JSON.stringify(env);
  for (const secret of [
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "BRIDGE_TOKEN",
    "DATABASE_URL",
  ]) {
    assertEquals(secret in env, false);
    assertEquals(blob.includes(secret), false);
  }
  assertEquals(env.SANDBOX_DEMO_VALUE, "hello-from-supervisor");
});
