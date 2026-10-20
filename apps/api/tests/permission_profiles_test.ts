import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DEFAULT_PERMISSION_PROFILE,
  isPermissionProfileId,
  PERMISSION_PROFILE_IDS,
} from "../src/domain/types.ts";
import { MockExecutionProvider } from "../src/providers/execution.ts";

Deno.test("known permission profile IDs", () => {
  assertEquals([...PERMISSION_PROFILE_IDS], [
    "none",
    "read-fixture",
    "env-demo",
    "host-chat",
  ]);
  assertEquals(DEFAULT_PERMISSION_PROFILE, "none");
  assertEquals(isPermissionProfileId("none"), true);
  assertEquals(isPermissionProfileId("read-fixture"), true);
  assertEquals(isPermissionProfileId("env-demo"), true);
  assertEquals(isPermissionProfileId("host-chat"), true);
  assertEquals(isPermissionProfileId("allow-all"), false);
  assertEquals(isPermissionProfileId("--allow-read=/etc"), false);
});

Deno.test("mock provider records requested profile in manifest", async () => {
  const p = new MockExecutionProvider();
  const result = await p.run({
    executionId: "t1",
    language: "javascript",
    source: "console.log(1)",
    permissionProfile: "read-fixture",
  });
  assertEquals(result.manifest?.permissionProfile, "read-fixture");
  assertEquals(result.manifest?.denoPermissions?.read, ["/fixtures"]);
});

Deno.test("mock provider defaults to none", async () => {
  const p = new MockExecutionProvider();
  const result = await p.run({
    executionId: "t2",
    language: "javascript",
    source: "console.log(1)",
  });
  assertEquals(result.manifest?.permissionProfile, "none");
  assertEquals(result.manifest?.denoPermissions?.read, []);
});
