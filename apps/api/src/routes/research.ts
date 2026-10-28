/**
 * Research-only risk comparison endpoints.
 * Never used for authorization. Labels must not be sent to analyzers.
 */

import { Hono } from "jsr:@hono/hono@4.6.5";
import { withClient } from "../db/client.ts";
import * as execRepo from "../repositories/executions.ts";
import * as riskRepo from "../repositories/risk.ts";
import {
  buildExecutionEvidenceRecord,
  type ExecutionEvidenceRecord,
} from "../risk/evidence.ts";
import { classifyEvidenceComparison } from "../risk/comparison.ts";
import {
  buildJevSystemOneRequest,
  JevRiskAnalyzer,
  preflightJevAuth,
} from "../risk/jev.ts";
import { DeterministicRiskAnalyzer } from "../risk/deterministic.ts";
import type { JevStatePresentation } from "../risk/jev-input.ts";
import type { Execution } from "../domain/types.ts";
import { RULE_VERSION } from "../risk/rules.ts";
import { EVIDENCE_SCHEMA_VERSION } from "../risk/evidence.ts";
import { JEV_POLICY_VERSION } from "../risk/jev-input.ts";

function isEvidenceRecord(v: unknown): v is ExecutionEvidenceRecord {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.evidenceSchemaVersion === 1 && typeof o.executionId === "string";
}

function stripResearchLeakFields(
  evidence: ExecutionEvidenceRecord,
): ExecutionEvidenceRecord {
  const raw = evidence as ExecutionEvidenceRecord & Record<string, unknown>;
  void raw.scenarioId;
  void raw.expectedResearchLabel;
  void raw.referenceLabel;
  void raw.corpusType;
  void raw.holdout;
  return {
    evidenceSchemaVersion: evidence.evidenceSchemaVersion,
    executionId: evidence.executionId,
    traceId: evidence.traceId,
    script: { ...evidence.script },
    runtime: { ...evidence.runtime },
    permissions: {
      accesses: [...evidence.permissions.accesses],
      failureCategory: evidence.permissions.failureCategory,
      auditTruncated: evidence.permissions.auditTruncated,
    },
    hostApi: {
      requested: [...evidence.hostApi.requested],
      allowed: [...evidence.hostApi.allowed],
      denied: [...evidence.hostApi.denied],
      queued: [...evidence.hostApi.queued],
    },
    resources: { ...evidence.resources },
    termination: { ...evidence.termination },
    provenance: [...evidence.provenance],
    untrustedContext: evidence.untrustedContext
      ? { ...evidence.untrustedContext }
      : undefined,
  };
}

async function evidenceFromExecution(
  executionId: string,
): Promise<ExecutionEvidenceRecord | null> {
  const row: Execution | null = await withClient((client) =>
    execRepo.getExecution(client, executionId)
  );
  if (!row) return null;

  const securityEvents = await withClient((client) =>
    riskRepo.listSecurityEvents(client, { executionId, limit: 500 })
  );

  const result = row.result;
  const permissionProfile = String(
    result?.manifest?.permissionProfile ?? row.permissionProfile ?? "none",
  );

  return stripResearchLeakFields(
    buildExecutionEvidenceRecord({
      executionId,
      status: row.status,
      errorMessage: row.errorMessage,
      language: "javascript",
      permissionProfile,
      result,
      securityEvents,
    }),
  );
}

function summarizeDet(r: {
  classification: string | null;
  confidence: number | null;
  score: number;
  reasons: string[];
  analyzerVersion?: string;
  latencyMs?: number;
  ruleMatches?: unknown;
}) {
  return {
    analyzer: "deterministic" as const,
    analyzerVersion: r.analyzerVersion ?? "1",
    classification: r.classification,
    confidence: r.confidence,
    score: r.score,
    reasons: r.reasons,
    latencyMs: r.latencyMs ?? 0,
    ruleMatches: r.ruleMatches ?? [],
    status: "ok" as const,
  };
}

function summarizeJev(r: {
  analyzerVersion: string;
  classification: string | null;
  confidence: number | null;
  score: number;
  reasons: string[];
  latencyMs: number;
  status: string;
  failureKind?: string;
  providerMetadata: Record<string, unknown>;
}) {
  return {
    analyzer: "jev" as const,
    analyzerVersion: r.analyzerVersion,
    classification: r.classification,
    confidence: r.confidence,
    score: r.score,
    reasons: r.reasons,
    latencyMs: r.latencyMs,
    status: r.status,
    failureKind: r.failureKind ?? null,
    providerMetadata: r.providerMetadata,
  };
}

export function researchRoutes() {
  const app = new Hono();

  /** Rebuild canonical evidence from a stored execution (no re-run). */
  app.get("/evidence/:executionId", async (c) => {
    const evidence = await evidenceFromExecution(c.req.param("executionId"));
    if (!evidence) return c.json({ error: "not_found" }, 404);
    return c.json({
      evidence,
      note:
        "Frozen evidence for advisory re-classification. Labels are not included.",
    });
  });

  /**
   * Authenticated connectivity check: GET /v1/models.
   * Never prints the API key. Does not call System One / spend classifications.
   */
  app.get("/jev-preflight", async (c) => {
    const result = await preflightJevAuth();
    // Safe log line — no secrets
    console.info(
      `[research] jev-preflight provider=${result.provider} baseURL=${result.baseURL} ` +
        `auth=${result.authentication} http=${result.httpStatus} ` +
        `source=${result.credentialSource} keyLen=${result.keyLength} ` +
        `requestId=${result.requestId ?? "-"} latencyMs=${result.latencyMs}`,
    );
    return c.json(result, result.ok ? 200 : 503);
  });

  /**
   * Dry-run: build the exact System One request body without calling Jev.
   * Never includes Authorization. Safe for research inspection.
   */
  app.post("/jev-dry-run", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "invalid_body" }, 400);
    }
    let evidence: ExecutionEvidenceRecord | null = null;
    if (isEvidenceRecord(body.evidence)) {
      evidence = stripResearchLeakFields(body.evidence);
    } else if (typeof body.executionId === "string") {
      evidence = await evidenceFromExecution(body.executionId);
      if (!evidence) return c.json({ error: "execution_not_found" }, 404);
    }
    if (!evidence) {
      return c.json({ error: "evidence_required" }, 400);
    }
    const presentation = (body.presentation ??
      "canonical") as JevStatePresentation;
    const built = buildJevSystemOneRequest(evidence, { presentation });
    return c.json({
      sent: false,
      note: "Sanitized dry-run — Authorization header never included. No network call made.",
      endpoint: built.endpoint,
      model: built.model,
      evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
      deterministicRuleVersion: RULE_VERSION,
      jevPolicyVersion: JEV_POLICY_VERSION,
      integrity: built.integrity,
      // Evaluation envelope only (not part of request body).
      evaluation: {
        scenarioId: body.scenarioId ?? null,
        corpusType: body.corpusType ?? null,
        referenceLabel: body.referenceLabel ?? null,
      },
      requestBody: built.body,
      authorization: "REDACTED",
    });
  });

  /**
   * Classify frozen evidence with one or both analyzers.
   * Evaluation fields (scenarioId, referenceLabel, corpusType) stay in the
   * response envelope only — they are never passed into analyzers.
   */
  app.post("/risk-classify", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "invalid_body" }, 400);
    }

    const analyzers: string[] = Array.isArray(body.analyzers)
      ? body.analyzers
      : ["deterministic", "jev"];
    const presentation = (body.presentation ??
      "canonical") as JevStatePresentation;
    const repetitions = Math.min(
      Math.max(Number(body.repetitions ?? 1), 1),
      10,
    );

    let evidence: ExecutionEvidenceRecord | null = null;
    if (isEvidenceRecord(body.evidence)) {
      evidence = stripResearchLeakFields(body.evidence);
    } else if (typeof body.executionId === "string") {
      evidence = await evidenceFromExecution(body.executionId);
      if (!evidence) return c.json({ error: "execution_not_found" }, 404);
    }

    if (!evidence) {
      return c.json({
        error: "evidence_required",
        message: "Provide evidence or executionId",
      }, 400);
    }

    const out: Record<string, unknown> = {
      evidenceId: evidence.executionId,
      evidenceSchemaVersion: evidence.evidenceSchemaVersion,
      presentation,
      evaluation: {
        scenarioId: body.scenarioId ?? null,
        corpusType: body.corpusType ?? null,
        referenceLabel: body.referenceLabel ??
          body.expectedResearchLabel ??
          null,
      },
    };

    const wantDet = analyzers.includes("deterministic");
    const wantJev = analyzers.includes("jev");

    if (wantDet && wantJev) {
      const runs = [];
      for (let i = 0; i < repetitions; i++) {
        const cmp = await classifyEvidenceComparison(evidence, {
          presentation,
        });
        runs.push({
          run: i + 1,
          deterministic: summarizeDet(cmp.deterministic),
          jev: summarizeJev(cmp.jev),
        });
      }
      out.runs = runs;
      out.deterministic = runs[0].deterministic;
      out.jev = runs[0].jev;
      return c.json(out);
    }

    if (wantDet) {
      const det = new DeterministicRiskAnalyzer();
      const r = await det.analyze({
        scriptVersionId: "research",
        language: evidence.script.language,
        evidence,
      });
      out.deterministic = summarizeDet({
        ...r,
        analyzerVersion: r.analyzerVersion,
        latencyMs: r.latencyMs,
      });
    }

    if (wantJev) {
      const jev = new JevRiskAnalyzer();
      const runs = [];
      for (let i = 0; i < repetitions; i++) {
        const r = await jev.classify(evidence, { presentation });
        runs.push({ run: i + 1, ...summarizeJev(r) });
      }
      out.jevRuns = runs;
      out.jev = runs[0];
    }

    return c.json(out);
  });

  return app;
}
