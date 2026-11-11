import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { withClient } from "../src/db/client.ts";
import * as scripts from "../src/repositories/scripts.ts";
import * as manifests from "../src/repositories/capability-manifests.ts";
import {
  executionPeriod,
  periodQuery,
} from "../src/repositories/execution-period.ts";
import { bindingSource } from "../../../packages/contracts/src/script-project.ts";
import { sourceHash } from "../../../packages/contracts/src/capabilities.ts";
Deno.test({
  name:
    "PostgreSQL project snapshots bind helper edits and date query includes all pages beyond100",
  ignore: Deno.env.get("CAPABILITY_DB_TEST") !== "1",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    await withClient(async (c) => {
      await c.queryArray("BEGIN");
      try {
        const project = {
          entrypoint: "main.ts",
          files: [{ path: "main.ts", content: 'import "./helper.ts"' }, {
            path: "helper.ts",
            content: 'host.world.setWeather("CLEAR")',
          }],
        };
        const { script, version } = await scripts.createScript(c, {
          name: "advanced transactional test",
          source: project.files[0].content,
          language: "typescript",
          project,
        });
        assertEquals(version.project?.files.length, 2);
        const m = (await manifests.getManifest(c, script.id, version.id))!;
        assertEquals(
          m.sourceSha256,
          await sourceHash(bindingSource(version.source, project)),
        );
        assertEquals(m.requested[0].capability, "world.setWeather");
        await manifests.reviewManifest(c, script.id, version.id, m.id, [
          "world.setWeather",
        ]);
        const next = (await scripts.addScriptVersion(
          c,
          script.id,
          version.source,
          "typescript",
          null,
          undefined,
          {
            ...project,
            files: project.files.map((f) =>
              f.path === "helper.ts"
                ? { ...f, content: 'host.world.setTime("DAY")' }
                : f
            ),
          },
        ))!;
        const fresh = (await manifests.getManifest(c, script.id, next.id))!;
        assertEquals(fresh.review, null);
        assertEquals(fresh.sourceSha256 === m.sourceSha256, false);
        await c.queryArray("SAVEPOINT immutable_probe");
        await assertRejects(() =>
          c.queryArray`UPDATE script_versions SET project='{}'::jsonb WHERE id=${version.id}`
        );
        await c.queryArray("ROLLBACK TO SAVEPOINT immutable_probe");
        await c
          .queryArray`INSERT INTO executions(script_id,script_version_id,status,created_at,updated_at) SELECT ${script.id},${version.id},'completed','2099-06-01T00:00:00Z'::timestamptz + n*interval '1 minute',now() FROM generate_series(0,124) n`;
        await c.queryArray`UPDATE executions SET result=${
          JSON.stringify({ provider: "docker", durationMs: 1234 })
        }::jsonb WHERE script_id=${script.id} AND created_at>='2099-06-01T00:00:00Z'::timestamptz`;
        const q = periodQuery({
          start: "2099-06-01T00:00:00Z",
          end: "2099-06-02T00:00:00Z",
          limit: "50",
        });
        const a = await executionPeriod(c, q),
          b = await executionPeriod(c, { ...q, offset: 50 }),
          d = await executionPeriod(c, { ...q, offset: 100 });
        assertEquals(a.total, 125);
        assertEquals(a.items[0].durationMs, 1234);
        assertEquals(a.summary.averageDurationMs, 1234);
        assertEquals(a.summary?.completed, 125);
        assertEquals(
          new Set([...a.items, ...b.items, ...d.items].map((r) => r.id)).size,
          125,
        );
        assertEquals(d.items.length, 25);
        const one = await executionPeriod(c, {
          ...q,
          end: "2099-06-01T00:01:00.000Z",
        });
        assertEquals(one.total, 1);
        assertEquals(
          (await executionPeriod(c, {
            ...q,
            start: "2099-06-02T00:00:00Z",
            end: "2099-06-03T00:00:00Z",
          })).total,
          0,
        );
      } finally {
        await c.queryArray("ROLLBACK");
      }
    });
  },
});
