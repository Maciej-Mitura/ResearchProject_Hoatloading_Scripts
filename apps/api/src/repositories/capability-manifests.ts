import type { PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import {
  type CapabilityManifest,
  type CapabilityRequest,
  type ExecutionAuthority,
  isCapability,
  prepareRequests,
  sourceHash,
} from "../../../../packages/contracts/src/capabilities.ts";
export async function createManifest(
  client: PoolClient,
  versionId: string,
  source: string,
  raw?: unknown,
  detectionSource = source,
): Promise<void> {
  const { requested, warnings } = prepareRequests(detectionSource, raw);
  const hash = await sourceHash(source);
  await client
    .queryObject`INSERT INTO script_capability_manifests(script_version_id, source_sha256, requested, warnings) VALUES(${versionId}, ${hash}, ${
    JSON.stringify(requested)
  }::jsonb, ${JSON.stringify(warnings)}::jsonb)`;
}
export async function getManifest(
  client: PoolClient,
  scriptId: string,
  versionId: string,
): Promise<CapabilityManifest | null> {
  const res = await client.queryObject<
    Record<string, unknown>
  >`SELECT m.*, v.script_id FROM script_capability_manifests m JOIN script_versions v ON v.id=m.script_version_id WHERE v.id=${versionId} AND v.script_id=${scriptId}`;
  const r = res.rows[0];
  if (!r) return null;
  const reviews = await client.queryObject<
    Record<string, unknown>
  >`SELECT * FROM script_capability_reviews WHERE manifest_id=${r.id} ORDER BY review_order DESC LIMIT 1`;
  const review = reviews.rows[0];
  return {
    schemaVersion: 1,
    id: String(r.id),
    scriptId,
    scriptVersionId: versionId,
    sourceSha256: String(r.source_sha256),
    requested: r.requested as CapabilityRequest[],
    warnings: r.warnings as string[],
    review: review
      ? {
        id: String(review.id),
        approvedAt: new Date(review.approved_at as string).toISOString(),
        approved: review.approved as CapabilityRequest[],
        denied: review.denied as CapabilityRequest[],
      }
      : null,
  };
}
export async function reviewManifest(
  client: PoolClient,
  scriptId: string,
  versionId: string,
  manifestId: string,
  selected: unknown,
): Promise<CapabilityManifest> {
  if (
    !Array.isArray(selected) || selected.length > 16 ||
    selected.some((x) => typeof x !== "string") ||
    new Set(selected).size !== selected.length
  ) throw new Error("Select registered requested capability IDs only");
  const m = await getManifest(client, scriptId, versionId);
  if (!m || m.id !== manifestId) throw new Error("Stale or missing manifest");
  if (
    selected.some((id) =>
      !isCapability(id) || !m.requested.some((r) => r.capability === id)
    )
  ) throw new Error("Unsupported or unrequested capability");
  const approved = m.requested.filter((r) => selected.includes(r.capability));
  const denied = m.requested.filter((r) => !selected.includes(r.capability));
  await client
    .queryObject`INSERT INTO script_capability_reviews(manifest_id, approved, denied) VALUES(${m.id}, ${
    JSON.stringify(approved)
  }::jsonb, ${JSON.stringify(denied)}::jsonb)`;
  return (await getManifest(client, scriptId, versionId))!;
}
export async function authorityFor(
  client: PoolClient,
  executionId: string,
): Promise<ExecutionAuthority | null> {
  const r = await client.queryObject<
    { snapshot: ExecutionAuthority }
  >`SELECT snapshot FROM execution_capability_authorities a JOIN executions e ON e.id=a.execution_id WHERE e.id=${executionId} AND e.status='running' AND a.snapshot->>'scriptVersionId'=e.script_version_id::text`;
  return r.rows[0]?.snapshot ?? null;
}
