/** Test-only embedded PostgreSQL. Pass a locally installed PGlite dist/index.js path.
 * node --experimental-strip-types scripts/test-phase1-db.mjs /absolute/path/to/pglite/dist/index.js
 * No app database, network, Docker or provider calls are used.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  claimPendingCommands,
  completeHostCommand,
  enqueueSandboxBroadcast,
} from "../apps/api/src/repositories/host.ts";
import { trustedCommandCorrelation } from "../apps/api/src/host/provenance.ts";

if (!process.argv[2]) {
  throw new Error("Pass the local PGlite module path (test dependency only)");
}
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
try {
  // PGlite has gen_random_uuid built in, but does not ship the optional pgcrypto extension.
  await db.exec(
    readFileSync(
      new URL("../apps/api/src/db/migrations/001_init.sql", import.meta.url),
      "utf8",
    ).replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', ""),
  );
  const legacyId = crypto.randomUUID();
  const executionId = crypto.randomUUID();
  const scriptId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const traceId = "a".repeat(32);
  const correlation = {
    executionId,
    traceId,
    callId: crypto.randomUUID(),
    capability: "chat.broadcast",
  };
  await db.query(
    "INSERT INTO host_commands(id, command_type, payload) VALUES($1,'broadcast_message',$2::jsonb)",
    [legacyId, JSON.stringify({ message: "legacy", _meta: correlation })],
  );
  await db.exec(
    readFileSync(
      new URL(
        "../apps/api/src/db/migrations/009_host_command_provenance.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const legacy =
    (await db.query("SELECT * FROM host_commands WHERE id=$1", [legacyId]))
      .rows[0];
  assert.equal(legacy.origin, "unknown");
  assert.equal(legacy.correlation, null);
  assert.equal(trustedCommandCorrelation(legacy), null);
  await db.query("INSERT INTO scripts(id,name) VALUES($1,'test')", [scriptId]);
  await db.query(
    "INSERT INTO script_versions(id,script_id,version_number,source,language) VALUES($1,$2,1,'','javascript')",
    [versionId, scriptId],
  );
  await db.query(
    "INSERT INTO executions(id,script_id,script_version_id) VALUES($1,$2,$3)",
    [executionId, scriptId, versionId],
  );
  await db.query(
    "INSERT INTO security_events(execution_id,event_type,message,metadata) VALUES($1,'execution.created','test root',$2::jsonb)",
    [executionId, JSON.stringify({ source: "application", traceId })],
  );
  const client = {
    async queryObject(strings, ...values) {
      const sql = typeof strings === "string"
        ? strings
        : strings.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, "");
      return db.query(sql, values);
    },
  };
  assert.equal(
    await enqueueSandboxBroadcast(client, "forged execution", {
      ...correlation,
      executionId: crypto.randomUUID(),
    }),
    null,
  );
  assert.equal(
    await enqueueSandboxBroadcast(client, "forged trace", {
      ...correlation,
      traceId: "f".repeat(32),
    }),
    null,
  );
  const command = await enqueueSandboxBroadcast(client, "genuine", correlation);
  assert.ok(command);
  assert.deepEqual(command.payload, { message: "genuine" });
  assert.deepEqual(trustedCommandCorrelation(command), correlation);
  await assert.rejects(
    () => enqueueSandboxBroadcast(client, "replay call", correlation),
    /unique|duplicate/i,
  );
  assert.equal(
    await completeHostCommand(client, command.id, true, "premature"),
    null,
  );
  await claimPendingCommands(client);
  const confirmed = await completeHostCommand(
    client,
    command.id,
    true,
    "broadcasted",
  );
  assert.deepEqual(trustedCommandCorrelation(confirmed), correlation);
  assert.equal(
    await completeHostCommand(client, command.id, false, "replay result"),
    null,
  );
  const historical = await completeHostCommand(
    client,
    legacyId,
    true,
    "broadcasted",
  );
  assert.equal(trustedCommandCorrelation(historical), null);
  console.log(
    "PASS: migration preserves unknown history; forged execution/trace rejected; real queue mapping retained; duplicate call/result rejected; legacy _meta never promoted",
  );
  console.log((await db.query("SELECT version() AS version")).rows[0].version);
} finally {
  await db.close();
}
