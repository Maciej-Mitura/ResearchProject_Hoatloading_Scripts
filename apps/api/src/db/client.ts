import { Client, Pool, PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const url = Deno.env.get("DATABASE_URL");
    if (!url) throw new Error("DATABASE_URL is required");
    pool = new Pool(url, 4, true);
  }
  return pool;
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function waitForDb(maxAttempts = 30): Promise<void> {
  const url = Deno.env.get("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is required");

  for (let i = 1; i <= maxAttempts; i++) {
    const client = new Client(url);
    try {
      await client.connect();
      await client.queryArray`SELECT 1`;
      await client.end();
      console.log("[db] connected");
      return;
    } catch (err) {
      console.log(`[db] waiting (${i}/${maxAttempts}): ${(err as Error).message}`);
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Could not connect to PostgreSQL");
}
