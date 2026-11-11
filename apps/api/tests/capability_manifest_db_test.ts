import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { withClient } from "../src/db/client.ts";
import * as scripts from "../src/repositories/scripts.ts";
import * as manifests from "../src/repositories/capability-manifests.ts";
import * as executions from "../src/repositories/executions.ts";
Deno.test({
  name:
    "PostgreSQL capability versions reviews snapshots and immutable history",
  ignore: Deno.env.get("CAPABILITY_DB_TEST") !== "1",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    await withClient(async (client) => {
      await client.queryArray("BEGIN");
      try {
        const { script, version } = await scripts.createScript(client, {
          name: "capability transaction validation",
          source: 'host.chat.broadcast("hello");',
          language: "typescript",
        });
        const first =
          (await manifests.getManifest(client, script.id, version.id))!;
        assertEquals(first.requested[0].capability, "chat.broadcast");
        assertEquals(first.review, null);
        const approved = await manifests.reviewManifest(
          client,
          script.id,
          version.id,
          first.id,
          ["chat.broadcast"],
        );
        assertEquals(approved.review!.approved.length, 1);
        const next = (await scripts.addScriptVersion(
          client,
          script.id,
          "host.world.spawnEntity({});",
          "typescript",
        ))!;
        const fresh =
          (await manifests.getManifest(client, script.id, next.id))!;
        assertEquals(fresh.review, null);
        assertEquals(fresh.requested[0].capability, "world.spawnEntity");
        await assertRejects(
          () =>
            manifests.reviewManifest(client, script.id, next.id, first.id, [
              "chat.broadcast",
            ]),
          Error,
          "Stale",
        );
        await assertRejects(
          () =>
            manifests.reviewManifest(client, script.id, next.id, fresh.id, [
              "paper.executeCommand",
            ]),
          Error,
          "Unsupported",
        );
        assertEquals(
          await manifests.getManifest(client, crypto.randomUUID(), version.id),
          null,
        );
        const exec = await executions.createExecution(
          client,
          script.id,
          version.id,
        );
        const snapshot = { ...approved, executionId: exec.id };
        await client
          .queryObject`UPDATE executions SET status='running' WHERE id=${exec.id}`;
        await client
          .queryObject`INSERT INTO execution_capability_authorities(execution_id,snapshot) VALUES(${exec.id},${
          JSON.stringify(snapshot)
        }::jsonb)`;
        await manifests.reviewManifest(
          client,
          script.id,
          version.id,
          first.id,
          [],
        );
        const authority = (await manifests.authorityFor(client, exec.id))!;
        assertEquals(authority.review!.approved.length, 1);
        assertEquals(
          (await manifests.getManifest(client, script.id, version.id))!.review!
            .denied.length,
          1,
        );
        const reviews = await client.queryObject<
          { n: number }
        >`SELECT count(*)::int n FROM script_capability_reviews WHERE manifest_id=${first.id}`;
        assertEquals(reviews.rows[0].n, 2);
        await client.queryArray("SAVEPOINT immutable_check");
        await assertRejects(() =>
          client
            .queryObject`UPDATE script_capability_reviews SET approved='[]' WHERE manifest_id=${first.id}`
        );
        await client.queryArray("ROLLBACK TO SAVEPOINT immutable_check");
        await client
          .queryObject`UPDATE executions SET status='completed' WHERE id=${exec.id}`;
        assertEquals(await manifests.authorityFor(client, exec.id), null);
      } finally {
        await client.queryArray("ROLLBACK");
      }
    });
  },
});
