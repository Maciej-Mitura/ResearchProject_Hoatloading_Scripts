import type { PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import type { RiskAssessment, SecurityEvent } from "../domain/types.ts";
import type { RiskAnalyzeResult } from "../providers/risk.ts";

function mapRisk(r: Record<string, unknown>): RiskAssessment {
  return {
    id: String(r.id),
    scriptVersionId: String(r.script_version_id),
    executionId: r.execution_id == null ? null : String(r.execution_id),
    classification: r.classification as RiskAssessment["classification"],
    score: Number(r.score),
    confidence: Number(r.confidence),
    reasons: (r.reasons as string[]) ?? [],
    provider: String(r.provider),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

function mapSecurity(r: Record<string, unknown>): SecurityEvent {
  return {
    id: String(r.id),
    executionId: r.execution_id == null ? null : String(r.execution_id),
    eventType: String(r.event_type),
    severity: r.severity as SecurityEvent["severity"],
    message: String(r.message),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function saveRiskAssessment(
  client: PoolClient,
  scriptVersionId: string,
  executionId: string | null,
  result: RiskAnalyzeResult,
): Promise<RiskAssessment> {
  const reasonsJson = JSON.stringify(result.reasons);
  const res = await client.queryObject`
    INSERT INTO risk_assessments (
      script_version_id, execution_id, classification, score, confidence, reasons, provider
    ) VALUES (
      ${scriptVersionId},
      ${executionId},
      ${result.classification},
      ${result.score},
      ${result.confidence},
      ${reasonsJson}::jsonb,
      ${result.provider}
    )
    RETURNING *
  `;
  return mapRisk(res.rows[0] as Record<string, unknown>);
}

export async function listRiskAssessments(client: PoolClient): Promise<RiskAssessment[]> {
  const res = await client.queryObject`
    SELECT * FROM risk_assessments ORDER BY created_at DESC LIMIT 100
  `;
  return res.rows.map((r) => mapRisk(r as Record<string, unknown>));
}

export async function addSecurityEvent(
  client: PoolClient,
  input: {
    executionId?: string | null;
    eventType: string;
    severity: SecurityEvent["severity"];
    message: string;
    metadata?: Record<string, unknown>;
  },
): Promise<SecurityEvent> {
  const metadataJson = JSON.stringify(input.metadata ?? {});
  const res = await client.queryObject`
    INSERT INTO security_events (execution_id, event_type, severity, message, metadata)
    VALUES (
      ${input.executionId ?? null},
      ${input.eventType},
      ${input.severity},
      ${input.message},
      ${metadataJson}::jsonb
    )
    RETURNING *
  `;
  return mapSecurity(res.rows[0] as Record<string, unknown>);
}

export async function listSecurityEvents(client: PoolClient): Promise<SecurityEvent[]> {
  const res = await client.queryObject`
    SELECT * FROM security_events ORDER BY created_at DESC LIMIT 100
  `;
  return res.rows.map((r) => mapSecurity(r as Record<string, unknown>));
}
