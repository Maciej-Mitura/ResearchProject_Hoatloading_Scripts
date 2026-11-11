import type { PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
export function periodQuery(q: Record<string, string | undefined>) {
  const start = Date.parse(q.start ?? ""), end = Date.parse(q.end ?? "");
  const offset = Number(q.offset ?? 0), limit = Number(q.limit ?? 50);
  const provider = q.provider ?? "all", order = q.order ?? "newest";
  if (
    !Number.isFinite(start) || !Number.isFinite(end) || start >= end ||
    end - start > 366 * 86400000 || !Number.isInteger(offset) || offset < 0 ||
    offset > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 200 ||
    !["all", "docker", "mock"].includes(provider) ||
    !["newest", "oldest", "longest", "shortest"].includes(order)
  ) {
    throw new Error(
      "Choose a valid date/time range (up to 366 days), provider and page (limit 1–200; offset up to 100000)",
    );
  }
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    offset,
    limit,
    provider,
    order,
  };
}
export async function executionPeriod(
  client: PoolClient,
  q: ReturnType<typeof periodQuery>,
) {
  const where =
    "e.created_at >= $1::timestamptz AND e.created_at < $2::timestamptz AND ($3='all' OR e.result->>'provider'=$3)";
  const args = [q.start, q.end, q.provider];
  // Only allowlisted SQL fragments. Caller strings never become SQL identifiers.
  const order = {
    newest: "e.created_at DESC,e.id DESC",
    oldest: "e.created_at ASC,e.id ASC",
    longest:
      "(e.result->>'durationMs')::numeric DESC NULLS LAST,e.created_at DESC,e.id DESC",
    shortest:
      "(e.result->>'durationMs')::numeric ASC NULLS LAST,e.created_at DESC,e.id DESC",
  }[q.order as "newest"];
  const aggregate = await client.queryObject<
    {
      total: number;
      completed: number;
      failed: number;
      terminated: number;
      low: number;
      review: number;
      high: number;
      completeEvidence: number;
      averageDurationMs: unknown;
    }
  >(
    `SELECT count(*)::integer total,count(*) FILTER(WHERE e.status='completed')::integer completed,count(*) FILTER(WHERE r.classification='low')::integer low,count(*) FILTER(WHERE r.classification IN ('review','medium'))::integer review,count(*) FILTER(WHERE r.classification='high')::integer high,count(*) FILTER(WHERE e.status='failed')::integer failed,count(*) FILTER(WHERE e.status='terminated')::integer terminated,round(avg((e.result->>'durationMs')::numeric))::float8 "averageDurationMs",count(*) FILTER(WHERE e.result->'auditCollection'->>'status'='complete')::integer "completeEvidence" FROM executions e LEFT JOIN risk_assessments r ON r.id=e.risk_assessment_id AND r.execution_id=e.id WHERE ${where}`,
    args,
  );
  const rows = await client.queryObject<Record<string, unknown>>(
    `SELECT e.id,e.script_id "scriptId",s.name "scriptName",e.script_version_id "scriptVersionId",e.status,e.created_at "createdAt",(e.result->>'durationMs')::float8 "durationMs",e.result->>'provider' provider,e.result->'manifest'->>'dockerRuntime' runtime,e.result->'manifest'->>'permissionProfile' profile,COALESCE(e.result->'auditCollection'->>'status',CASE WHEN e.result IS NULL THEN 'not_recorded' ELSE 'legacy_unknown' END) "auditStatus",r.id "assessmentId",CASE WHEN r.classification='medium' THEN 'review' ELSE r.classification END classification,COALESCE(r.assessment_status,'not_recorded') "assessmentStatus" FROM executions e JOIN scripts s ON s.id=e.script_id LEFT JOIN risk_assessments r ON r.id=e.risk_assessment_id AND r.execution_id=e.id WHERE ${where} ORDER BY ${order} LIMIT $4 OFFSET $5`,
    [...args, q.limit, q.offset],
  );
  return {
    items: rows.rows.map((r) => ({
      ...r,
      id: String(r.id),
      durationMs: r.durationMs == null ? null : Number(r.durationMs),
      createdAt: new Date(r.createdAt as string).toISOString(),
    })),
    summary: {
      ...aggregate.rows[0],
      averageDurationMs: aggregate.rows[0]?.averageDurationMs == null
        ? null
        : Number(aggregate.rows[0].averageDurationMs),
    },
    total: Number(aggregate.rows[0]?.total ?? 0),
    limit: q.limit,
    offset: q.offset,
    start: q.start,
    end: q.end,
  };
}
