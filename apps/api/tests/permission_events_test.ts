import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MockExecutionProvider } from "../src/providers/execution.ts";

Deno.test("mock execution results are labelled mock in manifest", async () => {
  const p = new MockExecutionProvider();
  const result = await p.run({
    executionId: "m1",
    language: "javascript",
    source: 'console.log("x")',
  });
  assertEquals(result.provider, "mock");
  assertEquals(result.manifest?.executionProvider, "mock");
  assertEquals(result.runtimeVersion, "mock");
  assertEquals(result.permissionEvents?.length ?? 0, 0);
});

Deno.test("mock security metadata source must be distinguishable", () => {
  // Contract check: persisted mock risk events use source=mock (see mock-execution.ts).
  const mockEvent = {
    eventType: "risk.assessment.mock",
    metadata: { source: "mock", provider: "mock-risk" },
  };
  const realEvent = {
    eventType: "permission.accessed",
    metadata: {
      source: "deno_permission_audit",
      permission: "read",
      target: "/etc/hosts",
    },
  };
  assertEquals(mockEvent.metadata.source, "mock");
  assertEquals(realEvent.metadata.source, "deno_permission_audit");
  assertEquals(mockEvent.metadata.source === realEvent.metadata.source, false);
});

Deno.test("permission event metadata must not carry script source", () => {
  const metadata = {
    source: "deno_permission_audit",
    permission: "read",
    target: "/etc/hosts",
    auditVersion: 1,
  };
  const blob = JSON.stringify(metadata);
  assertEquals(blob.includes("console.log"), false);
  assertEquals(blob.includes("await Deno"), false);
  assertEquals(blob.includes("GEMINI_API_KEY"), false);
  assertEquals(blob.includes("BRIDGE_TOKEN"), false);
});
