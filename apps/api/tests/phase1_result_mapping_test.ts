import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapResult } from "../src/repositories/executions.ts";
Deno.test("stored result preserves collection and normalizes legacy without fabricating completeness",()=>{
const auditCollection={version:1 as const,status:"complete" as const,reasons:[]};
assertEquals(mapResult({provider:"docker",auditCollection})?.auditCollection,auditCollection);
assertEquals(mapResult({provider:"docker"})?.auditCollection?.status,"legacy_unknown");
});

