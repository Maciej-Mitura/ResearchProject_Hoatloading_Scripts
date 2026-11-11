import type { PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

/** Read-only, bounded UI projection. Never return source/output/tokens in chart data. */
export async function listScriptExecutionHistory(client: PoolClient, scriptId: string, limit = 100) {
  const res = await client.queryObject<Record<string, unknown>>`
    SELECT e.id, e.script_id, e.script_version_id, e.status, e.created_at,
      count(*) OVER()::integer AS total,
      e.result IS NOT NULL AS result_present,
      e.result->>'durationMs' AS duration_ms,
      e.result->>'provider' AS provider,
      e.result->'manifest'->>'dockerRuntime' AS runtime,
      e.result->'manifest'->>'permissionProfile' AS profile,
      e.result->'auditCollection'->>'status' AS audit_status,
      r.id AS assessment_id, r.classification, r.assessment_status
    FROM executions e
    LEFT JOIN risk_assessments r ON r.id=e.risk_assessment_id AND r.execution_id=e.id
    WHERE e.script_id=${scriptId}
    ORDER BY e.created_at DESC, e.id DESC LIMIT ${limit}
  `;
  const items = res.rows.map((r) => {
    const duration = r.duration_ms == null ? null : Number(r.duration_ms);
    const audit = ["complete", "partial", "unavailable", "legacy_unknown"].includes(String(r.audit_status))
      ? String(r.audit_status) : r.result_present ? "legacy_unknown" : "not_recorded";
    return {
      id: String(r.id), scriptId: String(r.script_id), scriptVersionId: String(r.script_version_id),
      status: String(r.status), createdAt: new Date(r.created_at as string).toISOString(),
      durationMs: duration != null && Number.isFinite(duration) && duration >= 0 ? duration : null,
      provider: r.provider == null ? null : String(r.provider), runtime: r.runtime == null ? null : String(r.runtime),
      profile: r.profile == null ? null : String(r.profile), auditStatus: audit,
      assessmentId: r.assessment_id == null ? null : String(r.assessment_id),
      classification: r.classification === "medium" ? "review" : r.classification == null ? null : String(r.classification),
      assessmentStatus: r.assessment_status == null ? "not_recorded" : String(r.assessment_status),
    };
  });
  return { items, total: Number(res.rows[0]?.total ?? 0), limit };
}
