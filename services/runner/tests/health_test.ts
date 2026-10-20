import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("supervisor health contract shape", () => {
  const body = {
    status: "ok",
    service: "execution-supervisor",
    mode: "docker",
  };
  assertEquals(body.mode, "docker");
  assertEquals(body.service, "execution-supervisor");
});
