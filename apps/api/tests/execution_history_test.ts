import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executionRoutes } from "../src/routes/executions.ts";
import type { ExecutionService } from "../src/services/mock-execution.ts";
const app=executionRoutes({} as ExecutionService);
for(const query of ["", "?scriptId=bad", "?scriptId=00000000-0000-0000-0000-000000000000&limit=0", "?scriptId=00000000-0000-0000-0000-000000000000&limit=201", "?scriptId=00000000-0000-0000-0000-000000000000&limit=1.5"]){
 Deno.test("history rejects invalid query without querying DB: "+query,async()=>{const response=await app.request("http://test/history"+query);assertEquals(response.status,400);await response.text();});
}
