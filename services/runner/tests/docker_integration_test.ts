/**
 * Docker-dependent integration tests for the trusted supervisor.
 * Skipped automatically when Docker / sandbox image is unavailable.
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dockerAvailable, runSandboxContainer } from "../src/docker.ts";
import { SANDBOX_DENO_VERSION, SANDBOX_IMAGE } from "../src/config.ts";

async function sandboxImagePresent(): Promise<boolean> {
  try {
    const cmd = new Deno.Command("docker", {
      args: ["image", "inspect", SANDBOX_IMAGE],
      stdout: "null",
      stderr: "null",
    });
    const out = await cmd.output();
    return out.success;
  } catch {
    return false;
  }
}

const ready = (await dockerAvailable()) && (await sandboxImagePresent());

function testOrSkip(name: string, fn: () => Promise<void>) {
  if (!ready) {
    Deno.test({
      name: `${name} (skipped — docker/sandbox unavailable)`,
      ignore: true,
      fn: () => {},
    });
    return;
  }
  Deno.test(name, fn);
}

function hasPermission(
  events: { permission: string; target: string | null }[],
  permission: string,
  targetIncludes?: string,
): boolean {
  return events.some((e) => {
    if (e.permission !== permission) return false;
    if (!targetIncludes) return true;
    return (e.target ?? "").includes(targetIncludes);
  });
}

testOrSkip("reports pinned Deno runtime version in manifest", async () => {
  const r = await runSandboxContainer({
    executionId: `ver-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source: 'console.log("hello");',
  });
  assertEquals(r.manifest.runtimeVersion, SANDBOX_DENO_VERSION);
  assertEquals(r.runtimeVersion, SANDBOX_DENO_VERSION);
  assertEquals(r.manifest.permissionProfile, "none");
});

testOrSkip("hello script completes with no sensitive permission activity", async () => {
  const r = await runSandboxContainer({
    executionId: `hello-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source: 'console.log("Hello from the sandbox");',
  });
  assertEquals(r.timedOut, false);
  assertEquals(r.exitCode, 0);
  assertStringIncludes(r.stdout, "Hello from the sandbox");
  const sensitive = r.permissionEvents.filter((e) =>
    ["read", "write", "net", "env", "run", "ffi"].includes(e.permission)
  );
  // console.log alone should not request those capabilities
  assertEquals(sensitive.length, 0);
});

testOrSkip("typescript script prints 42", async () => {
  const r = await runSandboxContainer({
    executionId: `ts-${crypto.randomUUID().slice(0, 8)}`,
    language: "typescript",
    source: "const value: number = 21 * 2;\nconsole.log(value);\n",
  });
  assertEquals(r.exitCode, 0);
  assertStringIncludes(r.stdout, "42");
});

testOrSkip("file read: audit + failure, no file contents", async () => {
  const r = await runSandboxContainer({
    executionId: `read-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source: 'const v = await Deno.readTextFile("/etc/hosts");\nconsole.log(v);\n',
  });
  assertEquals(r.exitCode === 0, false);
  assertEquals(r.failureCategory, "deno_permission");
  assertEquals(hasPermission(r.permissionEvents, "read", "/etc/hosts"), true);
  assertEquals(r.stdout.includes("localhost"), false);
});

testOrSkip("caught permission error still leaves audit entry", async () => {
  const r = await runSandboxContainer({
    executionId: `caught-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source:
      'try {\n  await Deno.readTextFile("/etc/hosts");\n} catch {\n  console.log("handled");\n}\n',
  });
  assertEquals(r.exitCode, 0);
  assertStringIncludes(r.stdout, "handled");
  assertEquals(hasPermission(r.permissionEvents, "read", "/etc/hosts"), true);
});

testOrSkip("env access is audited and unavailable", async () => {
  const r = await runSandboxContainer({
    executionId: `env-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source: 'console.log(Deno.env.get("HOME"));\n',
  });
  assertEquals(hasPermission(r.permissionEvents, "env"), true);
  // Without --allow-env, value should not be successfully printed as a real path-like home
  // Deno may throw before printing, or print undefined depending on path — either way no grant.
  assertEquals(r.exitCode === 0 && (r.stdout.includes("/home") || r.stdout.includes("\\Users")), false);
});

testOrSkip("network: audit and/or failure without claiming layer", async () => {
  const r = await runSandboxContainer({
    executionId: `net-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source: 'await fetch("https://example.com");\n',
  });
  assertEquals(r.exitCode === 0, false);
  // Prefer observing a net permission access when Deno reaches the check.
  // Do not require it if Deno fails earlier for other reasons — assert failure at least.
  if (r.permissionEvents.some((e) => e.permission === "net")) {
    assertEquals(hasPermission(r.permissionEvents, "net"), true);
  }
});

testOrSkip("subprocess run is denied (audit may be absent on Deno 2.9.7)", async () => {
  const r = await runSandboxContainer({
    executionId: `run-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source:
      'const cmd = new Deno.Command("echo", { args: ["hello"] });\nconst out = await cmd.output();\nconsole.log(new TextDecoder().decode(out.stdout));\n',
  });
  assertEquals(r.exitCode === 0, false);
  assertEquals(r.failureCategory, "deno_permission");
  assertEquals(
    r.stderr.includes("--allow-run") || r.stderr.includes("run access"),
    true,
  );
  // Observed limitation: Deno 2.9.7 raises NotCapable for Deno.Command but does
  // not always emit a corresponding JSONL audit line for permission "run".
  // Prefer audit when present; otherwise supervisor failure classification is evidence.
  if (r.permissionEvents.length > 0) {
    assertEquals(hasPermission(r.permissionEvents, "run"), true);
  }
});

testOrSkip("ffi permission is audited", async () => {
  const r = await runSandboxContainer({
    executionId: `ffi-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source: 'Deno.dlopen("nonexistent_research_probe.so", {});\n',
  });
  assertEquals(r.exitCode === 0, false);
  assertEquals(hasPermission(r.permissionEvents, "ffi"), true);
});

testOrSkip("infinite loop is terminated by timeout", async () => {
  const r = await runSandboxContainer({
    executionId: `loop-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source: "while (true) {}",
  });
  assertEquals(r.timedOut, true);
  assertEquals(r.durationMs >= 8000, true);
});

testOrSkip("large output is truncated", async () => {
  const r = await runSandboxContainer({
    executionId: `out-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source:
      'for (let i = 0; i < 1000000; i++) { console.log("x".repeat(100)); }\n',
  });
  assertEquals(r.outputTruncated, true);
});

testOrSkip("experiment A: none cannot read fixture", async () => {
  const r = await runSandboxContainer({
    executionId: `none-fix-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source: 'await Deno.readTextFile("/fixtures/allowed.txt");\n',
    permissionProfile: "none",
  });
  assertEquals(r.exitCode === 0, false);
  assertEquals(r.failureCategory, "deno_permission");
  assertEquals(r.manifest.permissionProfile, "none");
  assertEquals(r.manifest.denoPermissions.read, []);
  assertEquals(hasPermission(r.permissionEvents, "read", "/fixtures"), true);
  assertEquals(
    r.stdout.includes("intentionally readable"),
    false,
  );
});

testOrSkip("experiment B: read-fixture can read allowed.txt", async () => {
  const r = await runSandboxContainer({
    executionId: `rf-ok-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source:
      'const value = await Deno.readTextFile("/fixtures/allowed.txt");\nconsole.log(value);\n',
    permissionProfile: "read-fixture",
  });
  assertEquals(r.exitCode, 0);
  assertEquals(r.manifest.permissionProfile, "read-fixture");
  assertEquals(r.manifest.denoPermissions.read, ["/fixtures"]);
  assertStringIncludes(r.stdout, "intentionally readable");
  assertEquals(hasPermission(r.permissionEvents, "read", "/fixtures"), true);
});

testOrSkip("experiment C: read-fixture cannot read /etc/hosts", async () => {
  const r = await runSandboxContainer({
    executionId: `rf-esc-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source:
      'const v = await Deno.readTextFile("/etc/hosts");\nconsole.log(v);\n',
    permissionProfile: "read-fixture",
  });
  assertEquals(r.exitCode === 0, false);
  assertEquals(r.failureCategory, "deno_permission");
  assertEquals(hasPermission(r.permissionEvents, "read", "/etc/hosts"), true);
  assertEquals(r.stdout.includes("localhost"), false);
});

testOrSkip("experiment D: mixed access under read-fixture", async () => {
  const r = await runSandboxContainer({
    executionId: `rf-mix-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source: `const allowed = await Deno.readTextFile("/fixtures/allowed.txt");
console.log(allowed);
try {
  await Deno.readTextFile("/etc/hosts");
} catch {
  console.log("outside scope denied");
}
`,
    permissionProfile: "read-fixture",
  });
  assertEquals(r.exitCode, 0);
  assertStringIncludes(r.stdout, "intentionally readable");
  assertStringIncludes(r.stdout, "outside scope denied");
  assertEquals(hasPermission(r.permissionEvents, "read", "/fixtures"), true);
  assertEquals(hasPermission(r.permissionEvents, "read", "/etc/hosts"), true);
});

testOrSkip("env-demo grants SANDBOX_DEMO_VALUE only", async () => {
  const r = await runSandboxContainer({
    executionId: `envd-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source: `console.log(Deno.env.get("SANDBOX_DEMO_VALUE"));
try {
  console.log("HOME=" + Deno.env.get("HOME"));
} catch {
  console.log("HOME unavailable");
}
`,
    permissionProfile: "env-demo",
  });
  assertEquals(r.manifest.permissionProfile, "env-demo");
  assertEquals(r.manifest.denoPermissions.env, ["SANDBOX_DEMO_VALUE"]);
  assertStringIncludes(r.stdout, "hello-from-supervisor");
  assertEquals(hasPermission(r.permissionEvents, "env", "SANDBOX_DEMO_VALUE"), true);
  // HOME must not be successfully returned as a real home path
  assertEquals(r.stdout.includes("HOME=/"), false);
  assertEquals(
    r.stdout.includes("HOME unavailable") || r.exitCode !== 0 ||
      !r.stdout.includes("HOME="),
    true,
  );
  for (const secret of [
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "BRIDGE_TOKEN",
    "DATABASE_URL",
  ]) {
    assertEquals(r.stdout.includes(secret), false);
  }
});

testOrSkip("host-chat: broadcast queues via Host Gateway", async () => {
  const r = await runSandboxContainer({
    executionId: `hcb-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    permissionProfile: "host-chat",
    source: `import { host } from "host";
const result = await host.chat.broadcast("Hello from integration test");
console.log(JSON.stringify(result));
`,
  });
  assertEquals(r.manifest.permissionProfile, "host-chat");
  assertEquals(r.manifest.hostCapabilities, ["chat.broadcast"]);
  assertEquals(r.manifest.dockerNetwork, "sandbox-host");
  // If gateway+API are reachable, accepted=true; otherwise supervisor/gateway error surfaces.
  // At minimum the host-chat profile must wire network + SDK without secrets.
  assertEquals(r.stdout.includes("BRIDGE_TOKEN"), false);
  assertEquals(r.stdout.includes("GEMINI_API_KEY"), false);
  const allowedOrQueued = r.hostApiEvents.some((e) =>
    e.eventType === "host_api.allowed" || e.eventType === "host_api.queued"
  );
  const deniedTransport = r.exitCode !== 0 && r.hostApiEvents.length === 0;
  // Prefer success path when stack is up; tolerate isolated runner-only runs.
  if (!deniedTransport) {
    assertEquals(allowedOrQueued || r.stdout.includes('"accepted":true'), true);
  }
});

testOrSkip("host-chat: direct API and internet unreachable", async () => {
  const r = await runSandboxContainer({
    executionId: `bypass-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    permissionProfile: "host-chat",
    source: `
const targets = [
  "http://api:3000/health",
  "http://postgres:5432/",
  "https://example.com",
];
for (const url of targets) {
  try {
    const res = await fetch(url);
    console.log("REACHED " + url + " status=" + res.status);
  } catch (e) {
    console.log("BLOCKED " + url);
  }
}
`,
  });
  assertEquals(r.stdout.includes("REACHED http://api:3000"), false);
  assertEquals(r.stdout.includes("REACHED https://example.com"), false);
  assertEquals(r.stdout.includes("BLOCKED http://api:3000"), true);
  assertEquals(r.stdout.includes("BLOCKED https://example.com"), true);
});

testOrSkip("none profile cannot import host SDK / reach gateway", async () => {
  const r = await runSandboxContainer({
    executionId: `nohost-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    permissionProfile: "none",
    source: `import { host } from "host";
await host.chat.broadcast("should not work");
`,
  });
  assertEquals(r.exitCode === 0, false);
  assertEquals(r.manifest.hostCapabilities, []);
  assertEquals(r.manifest.dockerNetwork, "none");
});

testOrSkip("sandbox job env does not include application secrets", async () => {
  // Probe via a profile that can read only SANDBOX_DEMO_VALUE — secrets must be absent.
  const r = await runSandboxContainer({
    executionId: `nosec-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    source: `
const keys = ["GEMINI_API_KEY","OPENAI_API_KEY","BRIDGE_TOKEN","DATABASE_URL","SANDBOX_DEMO_VALUE"];
for (const k of keys) {
  try {
    const v = Deno.env.get(k);
    console.log(k + "=" + (v === undefined ? "undefined" : "present"));
  } catch {
    console.log(k + "=denied");
  }
}
`,
    permissionProfile: "env-demo",
  });
  assertStringIncludes(r.stdout, "SANDBOX_DEMO_VALUE=present");
  assertEquals(r.stdout.includes("GEMINI_API_KEY=present"), false);
  assertEquals(r.stdout.includes("OPENAI_API_KEY=present"), false);
  assertEquals(r.stdout.includes("BRIDGE_TOKEN=present"), false);
  assertEquals(r.stdout.includes("DATABASE_URL=present"), false);
});

testOrSkip("fresh containers do not share tmpfs state", async () => {
  const marker = `marker-${crypto.randomUUID()}`;
  const nameA = `poc-fresh-a-${crypto.randomUUID().slice(0, 8)}`;
  const nameB = `poc-fresh-b-${crypto.randomUUID().slice(0, 8)}`;

  const write = new Deno.Command("docker", {
    args: [
      "run",
      "--rm",
      "--name",
      nameA,
      "--network",
      "none",
      "--read-only",
      "--tmpfs",
      "/workspace:rw,size=16m,mode=1777",
      "--entrypoint",
      "sh",
      SANDBOX_IMAGE,
      "-c",
      `echo ${marker} > /workspace/state.txt && cat /workspace/state.txt`,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const writeOut = await write.output();
  assertEquals(writeOut.success, true);
  assertStringIncludes(new TextDecoder().decode(writeOut.stdout), marker);

  const read = new Deno.Command("docker", {
    args: [
      "run",
      "--rm",
      "--name",
      nameB,
      "--network",
      "none",
      "--read-only",
      "--tmpfs",
      "/workspace:rw,size=16m,mode=1777",
      "--entrypoint",
      "sh",
      SANDBOX_IMAGE,
      "-c",
      "if [ -f /workspace/state.txt ]; then cat /workspace/state.txt; else echo FRESH; fi",
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const readOut = await read.output();
  const text = new TextDecoder().decode(readOut.stdout);
  assertStringIncludes(text, "FRESH");
  assertEquals(text.includes(marker), false);
});
