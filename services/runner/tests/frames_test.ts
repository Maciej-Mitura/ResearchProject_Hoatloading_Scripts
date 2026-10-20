import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { splitFramedStdout } from "../src/frames.ts";

Deno.test("splitFramedStdout separates script stdout from audit frames", () => {
  const marker = "poc-testmarker";
  const stdout = [
    "hello",
    "world",
    `${marker}:AUDIT_BEGIN`,
    `{"v":1,"permission":"read","value":"/etc/hosts"}`,
    `${marker}:AUDIT_END`,
    `${marker}:RUNTIME_BEGIN`,
    "deno 2.9.7 (stable, release)",
    `${marker}:RUNTIME_END`,
    "",
  ].join("\n");

  const split = splitFramedStdout(stdout, marker);
  assertEquals(split.scriptStdout.includes("hello"), true);
  assertEquals(split.scriptStdout.includes("AUDIT_BEGIN"), false);
  assertEquals(split.auditJsonl.includes("/etc/hosts"), true);
  assertEquals(split.runtimeVersionText.includes("2.9.7"), true);
});

Deno.test("splitFramedStdout without frames returns full stdout", () => {
  const split = splitFramedStdout("plain\n", "poc-x");
  assertEquals(split.scriptStdout, "plain\n");
  assertEquals(split.auditJsonl, "");
});
