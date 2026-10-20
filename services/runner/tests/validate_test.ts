import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateExecuteRequest } from "../src/validate.ts";

Deno.test("accepts narrow valid request", () => {
  const r = validateExecuteRequest({
    executionId: "abc-123",
    language: "javascript",
    source: "console.log(1)",
  });
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.value.language, "javascript");
  }
});

Deno.test("accepts typescript", () => {
  const r = validateExecuteRequest({
    executionId: "ts1",
    language: "typescript",
    source: "const x: number = 1;",
  });
  assertEquals(r.ok, true);
});

Deno.test("rejects unsupported language", () => {
  const r = validateExecuteRequest({
    executionId: "x",
    language: "python",
    source: "print(1)",
  });
  assertEquals(r.ok, false);
});

Deno.test("rejects arbitrary Docker options from clients", () => {
  const r = validateExecuteRequest({
    executionId: "x",
    language: "javascript",
    source: "1",
    image: "evil",
    privileged: true,
    network: "host",
    mounts: ["/:/"],
    runtime: "runsc",
    environment: { FOO: "bar" },
  });
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.rejectedFields?.includes("image"), true);
    assertEquals(r.rejectedFields?.includes("privileged"), true);
    assertEquals(r.rejectedFields?.includes("runtime"), true);
  }
});

Deno.test("rejects empty executionId", () => {
  const r = validateExecuteRequest({
    executionId: "",
    language: "javascript",
    source: "1",
  });
  assertEquals(r.ok, false);
});

Deno.test("accepts permissionProfile read-fixture", () => {
  const r = validateExecuteRequest({
    executionId: "p1",
    language: "javascript",
    source: "1",
    permissionProfile: "read-fixture",
  });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.value.permissionProfile, "read-fixture");
});

Deno.test("rejects unknown permissionProfile", () => {
  const r = validateExecuteRequest({
    executionId: "p1",
    language: "javascript",
    source: "1",
    permissionProfile: "--allow-read=/fixtures",
  });
  assertEquals(r.ok, false);
});

Deno.test("rejects raw Deno permission fields from clients", () => {
  const r = validateExecuteRequest({
    executionId: "p1",
    language: "javascript",
    source: "1",
    denoArgs: ["--allow-net"],
  });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.rejectedFields?.includes("denoArgs"), true);
});

Deno.test("accepts optional correlation traceId without treating it as auth", () => {
  const r = validateExecuteRequest({
    executionId: "p1",
    language: "javascript",
    source: "1",
    traceId: "0123456789abcdef0123456789abcdef",
  });
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.value.traceId, "0123456789abcdef0123456789abcdef");
  }
});

Deno.test("rejects malformed traceId", () => {
  const r = validateExecuteRequest({
    executionId: "p1",
    language: "javascript",
    source: "1",
    traceId: "not-a-trace-id",
  });
  assertEquals(r.ok, false);
});
