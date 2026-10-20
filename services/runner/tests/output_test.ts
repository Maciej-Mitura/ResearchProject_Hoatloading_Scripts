import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  boundCombinedOutput,
  mapToExecutionStatus,
  truncateUtf8,
} from "../src/output.ts";

Deno.test("truncateUtf8 within budget", () => {
  const r = truncateUtf8("hello", 100);
  assertEquals(r.truncated, false);
  assertEquals(r.text, "hello");
});

Deno.test("truncateUtf8 caps bytes", () => {
  const r = truncateUtf8("abcdefghij", 4);
  assertEquals(r.truncated, true);
  assertEquals(r.text.length <= 4, true);
});

Deno.test("boundCombinedOutput marks truncation", () => {
  const big = "x".repeat(1000);
  const r = boundCombinedOutput(big, "err", 100);
  assertEquals(r.outputTruncated, true);
  assertEquals(
    new TextEncoder().encode(r.stdout).byteLength +
      new TextEncoder().encode(r.stderr).byteLength <= 100,
    true,
  );
});

Deno.test("timeout maps to terminated", () => {
  assertEquals(
    mapToExecutionStatus({ timedOut: true, exitCode: null }),
    "terminated",
  );
  assertEquals(
    mapToExecutionStatus({ timedOut: false, exitCode: 0 }),
    "completed",
  );
  assertEquals(
    mapToExecutionStatus({ timedOut: false, exitCode: 2 }),
    "failed",
  );
  assertEquals(
    mapToExecutionStatus({
      timedOut: false,
      exitCode: null,
      supervisorError: true,
    }),
    "failed",
  );
});
