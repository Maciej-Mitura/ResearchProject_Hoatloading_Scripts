import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ALLOWED_HOST_COMMANDS, CONTRACT_VERSION } from "../src/domain/types.ts";

Deno.test("allowlist rejects unrestricted host control concepts", () => {
  const forbidden = [
    "execute_console",
    "run_shell",
    "eval",
    "filesystem_read",
    "docker_control",
  ];
  for (const f of forbidden) {
    assertEquals(
      (ALLOWED_HOST_COMMANDS as readonly string[]).includes(f),
      false,
      f,
    );
  }
});

Deno.test("contract version is pinned", () => {
  assertEquals(CONTRACT_VERSION, 1);
});
