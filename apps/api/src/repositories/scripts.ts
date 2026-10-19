import type { PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import type { Script, ScriptStatus, ScriptVersion } from "../domain/types.ts";

function mapScript(r: Record<string, unknown>): Script {
  return {
    id: String(r.id),
    name: String(r.name),
    description: r.description == null ? null : String(r.description),
    language: String(r.language),
    status: r.status as ScriptStatus,
    currentVersionId: r.current_version_id == null ? null : String(r.current_version_id),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

function mapVersion(r: Record<string, unknown>): ScriptVersion {
  return {
    id: String(r.id),
    scriptId: String(r.script_id),
    versionNumber: Number(r.version_number),
    source: String(r.source),
    language: String(r.language),
    changelog: r.changelog == null ? null : String(r.changelog),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listScripts(client: PoolClient): Promise<Script[]> {
  const res = await client.queryObject`SELECT * FROM scripts ORDER BY updated_at DESC`;
  return res.rows.map((r) => mapScript(r as Record<string, unknown>));
}

export async function getScript(client: PoolClient, id: string): Promise<Script | null> {
  const res = await client.queryObject`SELECT * FROM scripts WHERE id = ${id}`;
  if (!res.rows[0]) return null;
  return mapScript(res.rows[0] as Record<string, unknown>);
}

export async function createScript(
  client: PoolClient,
  input: {
    name: string;
    description?: string | null;
    language: string;
    source: string;
    status?: ScriptStatus;
  },
): Promise<{ script: Script; version: ScriptVersion }> {
  const scriptRes = await client.queryObject`
    INSERT INTO scripts (name, description, language, status)
    VALUES (
      ${input.name},
      ${input.description ?? null},
      ${input.language},
      ${input.status ?? "draft"}
    )
    RETURNING *
  `;
  const script = mapScript(scriptRes.rows[0] as Record<string, unknown>);

  const verRes = await client.queryObject`
    INSERT INTO script_versions (script_id, version_number, source, language, changelog)
    VALUES (${script.id}, 1, ${input.source}, ${input.language}, ${"Initial version"})
    RETURNING *
  `;
  const version = mapVersion(verRes.rows[0] as Record<string, unknown>);

  await client.queryObject`
    UPDATE scripts SET current_version_id = ${version.id}, updated_at = now()
    WHERE id = ${script.id}
  `;
  script.currentVersionId = version.id;
  return { script, version };
}

export async function updateScript(
  client: PoolClient,
  id: string,
  patch: { name?: string; description?: string | null; status?: ScriptStatus },
): Promise<Script | null> {
  const existing = await getScript(client, id);
  if (!existing) return null;

  const name = patch.name ?? existing.name;
  const description = patch.description === undefined ? existing.description : patch.description;
  const status = patch.status ?? existing.status;

  const res = await client.queryObject`
    UPDATE scripts
    SET name = ${name}, description = ${description}, status = ${status}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return mapScript(res.rows[0] as Record<string, unknown>);
}

export async function addScriptVersion(
  client: PoolClient,
  scriptId: string,
  source: string,
  language: string,
  changelog?: string | null,
): Promise<ScriptVersion | null> {
  const script = await getScript(client, scriptId);
  if (!script) return null;

  const maxRes = await client.queryObject<{ max: number }>`
    SELECT COALESCE(MAX(version_number), 0)::int AS max
    FROM script_versions WHERE script_id = ${scriptId}
  `;
  const next = (maxRes.rows[0]?.max ?? 0) + 1;

  const verRes = await client.queryObject`
    INSERT INTO script_versions (script_id, version_number, source, language, changelog)
    VALUES (${scriptId}, ${next}, ${source}, ${language}, ${changelog ?? null})
    RETURNING *
  `;
  const version = mapVersion(verRes.rows[0] as Record<string, unknown>);

  await client.queryObject`
    UPDATE scripts
    SET current_version_id = ${version.id}, language = ${language}, updated_at = now()
    WHERE id = ${scriptId}
  `;
  return version;
}

export async function getScriptVersion(
  client: PoolClient,
  id: string,
): Promise<ScriptVersion | null> {
  const res = await client.queryObject`SELECT * FROM script_versions WHERE id = ${id}`;
  if (!res.rows[0]) return null;
  return mapVersion(res.rows[0] as Record<string, unknown>);
}

export async function getCurrentVersion(
  client: PoolClient,
  scriptId: string,
): Promise<ScriptVersion | null> {
  const script = await getScript(client, scriptId);
  if (!script?.currentVersionId) return null;
  return getScriptVersion(client, script.currentVersionId);
}

export async function listVersions(
  client: PoolClient,
  scriptId: string,
): Promise<ScriptVersion[]> {
  const res = await client.queryObject`
    SELECT * FROM script_versions WHERE script_id = ${scriptId}
    ORDER BY version_number DESC
  `;
  return res.rows.map((r) => mapVersion(r as Record<string, unknown>));
}
