import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getPool, withClient } from "../src/db/client.ts";
import { listScriptExecutionHistory } from "../src/repositories/execution-history.ts";
Deno.test({name:"history PostgreSQL projection scopes, orders, bounds, preserves missing metadata and joins advisory result",ignore:Deno.env.get("EXECUTION_HISTORY_DB_TEST")!=="1",async fn(){
 try{await withClient(async client=>{await client.queryArray("BEGIN");try{
 const script=(await client.queryObject<{id:string}>`INSERT INTO scripts(name) VALUES ('Phase7.5 rollback history') RETURNING id`).rows[0]!;
 const version=(await client.queryObject<{id:string}>`INSERT INTO script_versions(script_id,version_number,source,language) VALUES (${script.id},1,'SOURCE_MUST_NOT_LEAK','javascript') RETURNING id`).rows[0]!;
 const older=(await client.queryObject<{id:string}>`INSERT INTO executions(script_id,script_version_id,status,created_at,result) VALUES (${script.id},${version.id},'completed',now()-interval '2 seconds','{"stdout":"OUTPUT_MUST_NOT_LEAK","durationMs":12,"provider":"docker","manifest":{"dockerRuntime":"runc","permissionProfile":"none"},"auditCollection":{"status":"complete"}}'::jsonb) RETURNING id`).rows[0]!;
 const risk=(await client.queryObject<{id:string}>`INSERT INTO risk_assessments(script_version_id,execution_id,classification,score,confidence,assessment_status) VALUES (${version.id},${older.id},'review',0,0,'ok') RETURNING id`).rows[0]!;
 await client.queryArray`UPDATE executions SET risk_assessment_id=${risk.id} WHERE id=${older.id}`;
 const newer=(await client.queryObject<{id:string}>`INSERT INTO executions(script_id,script_version_id,status,created_at,result) VALUES (${script.id},${version.id},'failed',now()-interval '1 second','{"durationMs":-1,"stdout":"OUTPUT_MUST_NOT_LEAK"}'::jsonb) RETURNING id`).rows[0]!;
 const failed=(await client.queryObject<{id:string}>`INSERT INTO risk_assessments(script_version_id,execution_id,classification,score,confidence,assessment_status) VALUES (${version.id},${newer.id},null,0,null,'failed') RETURNING id`).rows[0]!;
 await client.queryArray`UPDATE executions SET risk_assessment_id=${failed.id} WHERE id=${newer.id}`;
 await client.queryArray`INSERT INTO executions(script_id,script_version_id,status) VALUES (${script.id},${version.id},'queued')`;
 const all=await listScriptExecutionHistory(client,script.id,100);assertEquals(all.total,3);assertEquals(all.items.length,3);assertEquals(all.items[0].auditStatus,"not_recorded");assertEquals(all.items[1].id,newer.id);assertEquals(all.items[1].durationMs,null);assertEquals(all.items[1].auditStatus,"legacy_unknown");assertEquals(all.items[1].assessmentStatus,"failed");assertEquals(all.items[2].classification,"review");assertEquals(all.items[2].durationMs,12);assertEquals(all.items[2].profile,"none");assert(!JSON.stringify(all).includes("MUST_NOT_LEAK"));assertEquals(Object.keys(all.items[0]).length,13);
 const bounded=await listScriptExecutionHistory(client,script.id,1);assertEquals(bounded.items.length,1);assertEquals(bounded.total,3);
 const empty=await listScriptExecutionHistory(client,crypto.randomUUID(),100);assertEquals(empty.items,[]);assertEquals(empty.total,0);
 }finally{await client.queryArray("ROLLBACK");}});}finally{await getPool().end();}
}});
