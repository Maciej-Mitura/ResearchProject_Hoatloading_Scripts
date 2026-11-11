import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { advisoryOutcome } from "../src/services/advisory.ts";
Deno.test("advisory throw or stall becomes analysis failure independently of execution outcome", async () => {
  for (const op of [async () => { throw new Error("injected"); }, () => new Promise<never>(() => {})]) {
    const result = await advisoryOutcome("deterministic", op, 5);
    assertEquals(result.status, "failed"); assertEquals(result.classification, null);
  }
});
