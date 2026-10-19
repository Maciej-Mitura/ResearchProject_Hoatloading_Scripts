import type { PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import type { Execution, ExecutionEvent, ExecutionStatus } from "../domain/types.ts";

function mapExecution(r: Record<string, unknown>): Execution {
  return {
    id: String(r.id),
    scriptId: String(r.script_id),
    scriptVersionId: String(r.script_version_id),
    status: r.status as ExecutionStatus,
    riskAssessmentId: r.risk_assessment_id == null ? null : String(r.risk_assessment_id),
    errorMessage: r.error_message == null ? null : String(r.error_message),
    startedAt: r.started_at == null ? null : new Date(r.started_at as string).toISOString(),
    finishedAt: r.finished_at == null ? null : new Date(r.finished_at as string).toISOString(),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

function mapEvent(r: Record<string, unknown>): ExecutionEvent {
  return {
    id: String(r.id),
    executionId: String(r.execution_id),
    status: r.status as ExecutionStatus,
    message: r.message == null ? null : String(r.message),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listExecutions(client: PoolClient): Promise<Execution[]> {
  const res = await client.queryObject`
    SELECT * FROM executions ORDER BY created_at DESC LIMIT 100
  `;
  return res.rows.map((r) => mapExecution(r as Record<string, unknown>));
}

export async function getExecution(client: PoolClient, id: string): Promise<Execution | null> {
  const res = await client.queryObject`SELECT * FROM executions WHERE id = ${id}`;
  if (!res.rows[0]) return null;
  return mapExecution(res.rows[0] as Record<string, unknown>);
}

export async function createExecution(
  client: PoolClient,
  scriptId: string,
  scriptVersionId: string,
): Promise<Execution> {
  const res = await client.queryObject`
    INSERT INTO executions (script_id, script_version_id, status)
    VALUES (${scriptId}, ${scriptVersionId}, 'queued')
    RETURNING *
  `;
  const execution = mapExecution(res.rows[0] as Record<string, unknown>);
  await addExecutionEvent(client, execution.id, "queued", "Execution queued (mock pipeline)");
  return execution;
}

export async function updateExecutionStatus(
  client: PoolClient,
  id: string,
  status: ExecutionStatus,
  extra: {
    errorMessage?: string | null;
    riskAssessmentId?: string | null;
    startedAt?: boolean;
    finishedAt?: boolean;
  } = {},
): Promise<Execution | null> {
  const res = await client.queryObject`
    UPDATE executions SET
      status = ${status},
      error_message = COALESCE(${extra.errorMessage ?? null}, error_message),
      risk_assessment_id = COALESCE(${extra.riskAssessmentId ?? null}, risk_assessment_id),
      started_at = CASE WHEN ${extra.startedAt ?? false} THEN now() ELSE started_at END,
      finished_at = CASE WHEN ${extra.finishedAt ?? false} THEN now() ELSE finished_at END,
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!res.rows[0]) return null;
  return mapExecution(res.rows[0] as Record<string, unknown>);
}

export async function addExecutionEvent(
  client: PoolClient,
  executionId: string,
  status: ExecutionStatus,
  message: string | null,
): Promise<ExecutionEvent> {
  const res = await client.queryObject`
    INSERT INTO execution_events (execution_id, status, message)
    VALUES (${executionId}, ${status}, ${message})
    RETURNING *
  `;
  return mapEvent(res.rows[0] as Record<string, unknown>);
}

export async function listExecutionEvents(
  client: PoolClient,
  executionId: string,
): Promise<ExecutionEvent[]> {
  const res = await client.queryObject`
    SELECT * FROM execution_events WHERE execution_id = ${executionId}
    ORDER BY created_at ASC
  `;
  return res.rows.map((r) => mapEvent(r as Record<string, unknown>));
}
