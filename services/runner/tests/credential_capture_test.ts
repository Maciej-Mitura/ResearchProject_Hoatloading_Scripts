import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeSandbox } from "../src/docker.ts";
Deno.test("execution credential echoed by untrusted source is redacted before returning captured output", async () => {
  const token = "transient-test-credential-that-must-not-be-stored";
  const stream = () =>
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(token));
        c.close();
      },
    });
  const result = await executeSandbox({
    executionId: "redaction-test",
    source: "",
    language: "javascript",
    permissionProfile: "host-chat",
  }, {
    createSession: async () => ({
      token,
      expiresAt: "",
      capabilities: ["chat.broadcast"],
    }),
    revokeSession: async () => [],
    command: async () => ({
      success: true,
      code: 0,
      signal: null,
      stdout: new TextEncoder().encode("false"),
      stderr: new Uint8Array(),
    }),
    spawn: () => ({
      stdin: new WritableStream(),
      stdout: stream(),
      stderr: stream(),
      status: Promise.resolve({ success: true, code: 0, signal: null }),
      kill() {},
    } as unknown as Deno.ChildProcess),
  });
  assertEquals(result.stdout.includes(token), false);
  assertEquals(result.stderr.includes(token), false);
  assertEquals(result.stdout.includes("[execution credential redacted]"), true);
});
