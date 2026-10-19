/**
 * Simple SQL migration runner.
 * Applies *.sql files in order; tracks applied ids in schema_migrations.
 */

import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url);

export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = new Client(databaseUrl);
  await client.connect();

  try {
    await client.queryObject`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const applied = await client.queryObject<{ id: string }>`
      SELECT id FROM schema_migrations ORDER BY id
    `;
    const appliedSet = new Set(applied.rows.map((r) => r.id));

    const entries: string[] = [];
    for await (const entry of Deno.readDir(MIGRATIONS_DIR)) {
      if (entry.isFile && entry.name.endsWith(".sql")) {
        entries.push(entry.name);
      }
    }
    entries.sort();

    for (const name of entries) {
      if (appliedSet.has(name)) {
        console.log(`[migrate] skip ${name}`);
        continue;
      }
      const sql = await Deno.readTextFile(new URL(name, MIGRATIONS_DIR));
      console.log(`[migrate] apply ${name}`);
      await client.queryArray("BEGIN");
      try {
        await client.queryArray(sql);
        await client.queryObject`
          INSERT INTO schema_migrations (id) VALUES (${name})
        `;
        await client.queryArray("COMMIT");
      } catch (err) {
        await client.queryArray("ROLLBACK");
        throw err;
      }
    }
    console.log("[migrate] done");
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  const url = Deno.env.get("DATABASE_URL");
  if (!url) {
    console.error("DATABASE_URL is required");
    Deno.exit(1);
  }
  await runMigrations(url);
}
