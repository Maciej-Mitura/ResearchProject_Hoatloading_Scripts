import {
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createExecutionProvider,
  mapResultToStatus,
  MockExecutionProvider,
} from "../src/providers/execution.ts";

Deno.test("createExecutionProvider defaults to mock", () => {
  const p = createExecutionProvider("mock");
  assertEquals(p.name, "mock");
  assertEquals(createExecutionProvider("").name, "mock");
});

Deno.test("createExecutionProvider docker uses supervisor URL env", () => {
  const prev = Deno.env.get("EXECUTION_SUPERVISOR_URL");
  Deno.env.set("EXECUTION_SUPERVISOR_URL", "http://supervisor-test:3100");
  try {
    const p = createExecutionProvider("docker");
    assertEquals(p.name, "docker");
  } finally {
    if (prev === undefined) Deno.env.delete("EXECUTION_SUPERVISOR_URL");
    else Deno.env.set("EXECUTION_SUPERVISOR_URL", prev);
  }
});

Deno.test("createExecutionProvider rejects unknown kinds", () => {
  assertThrows(
    () => createExecutionProvider("kubernetes"),
    Error,
    "Unknown EXECUTION_PROVIDER",
  );
});

Deno.test("mapResultToStatus mapping", () => {
  assertEquals(
    mapResultToStatus({
      provider: "docker",
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      durationMs: 10,
      timedOut: false,
      outputTruncated: false,
    }),
    "completed",
  );
  assertEquals(
    mapResultToStatus({
      provider: "docker",
      exitCode: 1,
      stdout: "",
      stderr: "err",
      durationMs: 10,
      timedOut: false,
      outputTruncated: false,
    }),
    "failed",
  );
  assertEquals(
    mapResultToStatus({
      provider: "docker",
      exitCode: null,
      stdout: "",
      stderr: "",
      durationMs: 10000,
      timedOut: true,
      outputTruncated: false,
    }),
    "terminated",
  );
});

Deno.test("MockExecutionProvider does not claim real execution", async () => {
  const p = new MockExecutionProvider();
  const result = await p.run({
    executionId: "test-1",
    language: "javascript",
    source: 'console.log("hi")',
  });
  assertEquals(result.provider, "mock");
  assertEquals(result.exitCode, 0);
  assertStringIncludes(result.stdout, "not executed");
});

Deno.test("MockExecutionProvider FAIL_DEMO", async () => {
  const p = new MockExecutionProvider();
  const result = await p.run({
    executionId: "test-2",
    language: "javascript",
    source: "// FAIL_DEMO",
  });
  assertEquals(result.exitCode, 1);
  assertEquals(mapResultToStatus(result), "failed");
});
