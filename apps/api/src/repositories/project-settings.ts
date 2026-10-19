import type { PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const DEFAULT_ID = "default";

export async function getOverrides(
  client: PoolClient,
  id = DEFAULT_ID,
): Promise<Record<string, unknown>> {
  const res = await client.queryObject`
    SELECT overrides FROM project_settings WHERE id = ${id}
  `;
  if (!res.rows[0]) return {};
  const row = res.rows[0] as { overrides: unknown };
  const overrides = row.overrides;
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    return overrides as Record<string, unknown>;
  }
  return {};
}

export async function setOverrides(
  client: PoolClient,
  overrides: Record<string, unknown>,
  id = DEFAULT_ID,
): Promise<Record<string, unknown>> {
  const json = JSON.stringify(overrides ?? {});
  const res = await client.queryObject`
    INSERT INTO project_settings (id, overrides, updated_at)
    VALUES (${id}, ${json}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET
      overrides = EXCLUDED.overrides,
      updated_at = now()
    RETURNING overrides
  `;
  const row = res.rows[0] as { overrides: unknown };
  return (row.overrides as Record<string, unknown>) ?? {};
}

export async function resetOverrides(
  client: PoolClient,
  id = DEFAULT_ID,
): Promise<void> {
  await client.queryObject`
    INSERT INTO project_settings (id, overrides, updated_at)
    VALUES (${id}, '{}'::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET
      overrides = '{}'::jsonb,
      updated_at = now()
  `;
}
