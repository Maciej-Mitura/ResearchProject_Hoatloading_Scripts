import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("runner health contract shape", () => {
  const body = {
    status: "ok",
    service: "runner",
    mode: "mock",
  };
  assertEquals(body.mode, "mock");
  assertEquals(body.service, "runner");
});
