/**
 * ExecutionService — execution pipeline orchestrator.
 *
 * The "running" step delegates to an ExecutionProvider (mock or docker).
 * Source is executed for real only when EXECUTION_PROVIDER=docker.
 *
 * Behavioral risk assessment runs AFTER execution evidence exists (advisory only).
 */

import type { PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { withClient } from "../db/client.ts";
import * as execRepo from "../repositories/executions.ts";
import * as scriptRepo from "../repositories/scripts.ts";
import * as riskRepo from "../repositories/risk.ts";
import type { RiskAnalyzer } from "../providers/risk.ts";
import {
  createExecutionProvider,
  mapResultToStatus,
  type ExecutionProvider,
} from "../providers/execution.ts";
import type {
  Execution,
  ExecutionResult,
  ExecutionStatus,
  PermissionProfileId,
} from "../domain/types.ts";
import { DEFAULT_PERMISSION_PROFILE } from "../domain/types.ts";
import {
  addTraceEvent,
  endChildSpan,
  endSpanError,
  endSpanOk,
  formatTraceparent,
  setTraceAttributes,
  startChildSpan,
  startExecutionTrace,
  type ExecutionTrace,
} from "../telemetry/otel.ts";
import { buildExecutionEvidenceRecord } from "../risk/evidence.ts";

type Listener = (execution: Execution) => void;

const STEP_DELAY_MS = 400;

/** Neutral orchestrator name. */
export class ExecutionService {
  private listeners = new Map<string, Set<Listener>>();
  private running = new Set<string>();
  /** Requested profile for in-flight pipelines (executionId → profile). */
  private pendingProfiles = new Map<string, PermissionProfileId>();
  /** Trusted OTel traces keyed by executionId. */
  private pendingTraces = new Map<string, ExecutionTrace>();
  private provider: ExecutionProvider;

  constructor(
    private riskAnalyzer: RiskAnalyzer,
    provider?: ExecutionProvider,
  ) {
    this.provider = provider ?? createExecutionProvider("mock");
  }

  get providerName(): string {
    return this.provider.name;
  }

  subscribe(executionId: string, fn: Listener): () => void {
    if (!this.listeners.has(executionId)) {
      this.listeners.set(executionId, new Set());
    }
    this.listeners.get(executionId)!.add(fn);
    return () => this.listeners.get(executionId)?.delete(fn);
  }

  private emit(execution: Execution) {
    for (const fn of this.listeners.get(execution.id) ?? []) {
      try {
        fn(execution);
      } catch (err) {
        console.error("[exec] listener error", err);
      }
    }
  }

  async start(
    scriptId: string,
    scriptVersionId?: string,
    permissionProfile: PermissionProfileId = DEFAULT_PERMISSION_PROFILE,
  ): Promise<Execution> {
    const execution = await withClient(async (client) => {
      const script = await scriptRepo.getScript(client, scriptId);
      if (!script) throw new Error("Script not found");

      const version = scriptVersionId
        ? await scriptRepo.getScriptVersion(client, scriptVersionId)
        : await scriptRepo.getCurrentVersion(client, scriptId);

      if (!version) throw new Error("Script version not found");

      return execRepo.createExecution(client, scriptId, version.id);
    });

    this.pendingProfiles.set(execution.id, permissionProfile);

    // Trusted root trace — created by API infrastructure, not by scripts.
    const trace = startExecutionTrace(execution.id, this.provider.name);
    this.pendingTraces.set(execution.id, trace);

    await withClient((client) =>
      riskRepo.addSecurityEvent(client, {
        executionId: execution.id,
        eventType: "execution.created",
        severity: "info",
        message: "Execution created",
        metadata: {
          source: "application",
          traceId: trace.traceId,
          permissionProfile,
        },
      })
    );

    this.runPipeline(execution.id).catch((err) => {
      console.error(`[exec] pipeline failed for ${execution.id}`, err);
    });

    return execution;
  }

  private async runPipeline(executionId: string): Promise<void> {
    if (this.running.has(executionId)) return;
    this.running.add(executionId);

    const span = this.pendingTraces.get(executionId) ??
      startExecutionTrace(executionId, this.provider.name);

    try {
      const version = await withClient(async (client) => {
        const exec = await execRepo.getExecution(client, executionId);
        if (!exec) throw new Error("missing execution");
        return scriptRepo.getScriptVersion(client, exec.scriptVersionId);
      });
      if (!version) throw new Error("missing version");

      setTraceAttributes(span, {
        "execution.language": version.language,
        "execution.permission_profile":
          this.pendingProfiles.get(executionId) ?? DEFAULT_PERMISSION_PROFILE,
      });

      await this.transition(
        executionId,
        "validating",
        "Validating script metadata",
        { startedAt: true },
      );
      await sleep(STEP_DELAY_MS);

      // Content marker only — NOT risk-classification enforcement.
      if (version.source.includes("BLOCK_DEMO")) {
        await this.transition(
          executionId,
          "blocked",
          "Blocked by explicit BLOCK_DEMO marker (demo policy, not risk analyzer).",
          { finishedAt: true },
        );
        endSpanOk(span, { provider: this.provider.name });
        return;
      }

      const runningMsg = this.provider.name === "docker"
        ? "Running script in fresh Docker/Deno sandbox"
        : "Simulating run (mock — source code is NOT executed)";

      await this.transition(executionId, "running", runningMsg);

      await withClient((client) =>
        riskRepo.addSecurityEvent(client, {
          executionId,
          eventType: "execution.started",
          severity: "info",
          message: "Sandbox execution started",
          metadata: {
            source: "application",
            traceId: span.traceId,
            provider: this.provider.name,
          },
        })
      );
      addTraceEvent(span, "execution.started", {
        "execution.provider": this.provider.name,
      });

      const permissionProfile =
        this.pendingProfiles.get(executionId) ?? DEFAULT_PERMISSION_PROFILE;

      const sandboxSpan = startChildSpan(span, "sandbox.run", {
        "execution.permission_profile": permissionProfile,
      });

      const result = await this.provider.run({
        executionId,
        language: version.language,
        source: version.source,
        permissionProfile,
        traceparent: formatTraceparent(span),
        traceId: span.traceId,
      });

      result.traceId = span.traceId;

      endChildSpan(sandboxSpan, result.exitCode === 0 && !result.timedOut, {
        "execution.duration_ms": result.durationMs,
        "execution.exit_code": result.exitCode ?? -1,
        "execution.timed_out": result.timedOut,
      });

      for (const pe of result.permissionEvents ?? []) {
        addTraceEvent(span, "permission.accessed", {
          "permission.type": pe.permission,
          "permission.target": pe.target ?? "",
          "evidence.source": "deno_permission_audit",
        });
      }
      for (const he of result.hostApiEvents ?? []) {
        addTraceEvent(span, he.eventType, {
          capability: he.capability,
          callId: he.callId,
          commandId: he.commandId ?? "",
          "evidence.source": "host_gateway",
        });
      }

      const status = mapResultToStatus(result);
      const message = statusMessage(status, result);
      const errorMessage = status === "completed"
        ? null
        : result.timedOut
        ? "Execution timed out"
        : result.failureCategory === "deno_permission"
        ? "Deno permission failure (NotCapable / missing allow flag)"
        : (result.stderr?.slice(0, 500) || `Exit code ${result.exitCode}`);

      // Persist trusted observations before advisory analysis.
      await withClient(async (client) => {
        await persistPermissionObservations(
          client,
          executionId,
          result,
          span.traceId,
        );
        await execRepo.updateExecutionStatus(client, executionId, "running", {
          result,
        });
      });

      await this.transition(
        executionId,
        "analysing",
        `Advisory risk analysis (${this.riskAnalyzer.name})`,
      );

      const securityEvents = await withClient((client) =>
        riskRepo.listSecurityEvents(client, { executionId, limit: 500 })
      );
      const evidence = buildExecutionEvidenceRecord({
        executionId,
        status,
        errorMessage,
        language: version.language,
        permissionProfile,
        result,
        securityEvents,
      });

      const assessment = await this.riskAnalyzer.analyze({
        scriptVersionId: version.id,
        language: version.language,
        source: version.source,
        executionId,
        evidence,
      });

      await withClient(async (client) => {
        const risk = await riskRepo.saveRiskAssessment(
          client,
          version.id,
          executionId,
          assessment,
        );
        const failed =
          assessment.status === "failed" ||
          assessment.status === "unavailable" ||
          assessment.classification == null;
        await riskRepo.addSecurityEvent(client, {
          executionId,
          eventType: failed
            ? "risk.classification_failed"
            : `risk.assessment.${assessment.provider}`,
          severity: assessment.classification === "high" ? "warning" : "info",
          message: failed
            ? `Advisory risk (${assessment.provider}) unavailable/failed` +
              (assessment.failureKind ? `: ${assessment.failureKind}` : "")
            : `Advisory risk (${assessment.provider}): ${assessment.classification} (score=${assessment.score})`,
          metadata: {
            source: assessment.provider === "mock" ? "mock" : "application",
            provider: assessment.provider,
            classification: assessment.classification,
            status: assessment.status ?? "ok",
            failureKind: assessment.failureKind ?? null,
            reasons: assessment.reasons,
            evidenceSchemaVersion: evidence.evidenceSchemaVersion,
            traceId: evidence.traceId,
            latencyMs: assessment.latencyMs ?? null,
            // Never include API keys or full evidence payload.
          },
        });
        await execRepo.updateExecutionStatus(client, executionId, "analysing", {
          riskAssessmentId: risk.id,
          result,
        });
      });

      if (
        assessment.status === "failed" ||
        assessment.status === "unavailable" ||
        assessment.classification == null
      ) {
        addTraceEvent(span, "risk.classification_failed", {
          "risk.analyzer": assessment.provider,
          "risk.failure_kind": assessment.failureKind ?? "unknown",
          "risk.latency_ms": assessment.latencyMs ?? 0,
        });
      } else {
        const classifiedAttrs: Record<string, string | number | boolean> = {
          "risk.analyzer": assessment.provider,
          "risk.classification": assessment.classification,
          "risk.latency_ms": assessment.latencyMs ?? 0,
          "risk.rule_count": assessment.reasons.length,
        };
        // Confidence only when present — UI/docs must not treat as malice probability.
        if (
          typeof assessment.confidence === "number" &&
          Number.isFinite(assessment.confidence)
        ) {
          classifiedAttrs["risk.confidence"] = assessment.confidence;
        }
        addTraceEvent(span, "risk.classified", classifiedAttrs);
      }

      await this.finish(executionId, status, message, result, errorMessage, span);
      const attrs = spanAttrs(result, version.language, span.traceId);
      if (assessment.classification != null) {
        attrs["risk.classification"] = assessment.classification;
      }
      attrs["risk.analyzer"] = assessment.provider;
      if (status === "failed" && result.exitCode === null && !result.timedOut) {
        endSpanError(span, result.stderr || "execution failed", attrs);
      } else if (status === "failed" || status === "terminated") {
        endSpanError(span, errorMessage || status, attrs);
      } else {
        endSpanOk(span, attrs);
      }
    } catch (err) {
      endSpanError(span, err, { provider: this.provider.name });
      await this.transition(executionId, "failed", String(err), {
        finishedAt: true,
        errorMessage: String(err),
      });
    } finally {
      this.running.delete(executionId);
      this.pendingProfiles.delete(executionId);
      this.pendingTraces.delete(executionId);
    }
  }

  private async finish(
    executionId: string,
    status: ExecutionStatus,
    message: string,
    result: ExecutionResult,
    errorMessage: string | null,
    trace?: ExecutionTrace | null,
  ): Promise<void> {
    const finishType = status === "completed"
      ? "execution.completed"
      : status === "terminated"
      ? "execution.terminated"
      : "execution.failed";

    const execution = await withClient(async (client) => {
      await execRepo.addExecutionEvent(client, executionId, status, message);
      // Permission/host observations are persisted before advisory analysis.
      await riskRepo.addSecurityEvent(client, {
        executionId,
        eventType: finishType,
        severity: status === "completed" ? "info" : "warning",
        message,
        metadata: {
          source: "application",
          traceId: result.traceId ?? trace?.traceId ?? null,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          timedOut: result.timedOut,
          failureCategory: result.failureCategory ?? null,
        },
      });
      return execRepo.updateExecutionStatus(client, executionId, status, {
        finishedAt: true,
        errorMessage,
        result,
      });
    });
    if (execution) this.emit(execution);
  }

  private async transition(
    executionId: string,
    status: ExecutionStatus,
    message: string,
    extra: {
      startedAt?: boolean;
      finishedAt?: boolean;
      errorMessage?: string | null;
    } = {},
  ): Promise<void> {
    const execution = await withClient(async (client) => {
      await execRepo.addExecutionEvent(client, executionId, status, message);
      return execRepo.updateExecutionStatus(client, executionId, status, {
        startedAt: extra.startedAt,
        finishedAt: extra.finishedAt,
        errorMessage: extra.errorMessage,
      });
    });
    if (execution) this.emit(execution);
  }
}

function statusMessage(
  status: ExecutionStatus,
  result: ExecutionResult,
): string {
  if (status === "terminated") {
    return `Terminated after wall-clock timeout (${result.durationMs}ms)`;
  }
  if (status === "completed") {
    const trunc = result.outputTruncated
      ? " (output truncated at configured limit)"
      : "";
    return `Execution completed (exit=${result.exitCode}, ${result.durationMs}ms, provider=${result.provider})${trunc}`;
  }
  return `Execution failed (exit=${result.exitCode}, ${result.durationMs}ms, provider=${result.provider})`;
}

function spanAttrs(
  result: ExecutionResult,
  language: string,
  traceId: string,
): Record<string, string | number | boolean> {
  return {
    "execution.provider": result.provider,
    "execution.language": language,
    "execution.duration_ms": result.durationMs,
    "execution.exit_code": result.exitCode ?? -1,
    "execution.timed_out": result.timedOut,
    "execution.output_truncated": result.outputTruncated,
    "execution.permission_access.count": result.permissionEvents?.length ?? 0,
    "execution.permission_audit_truncated": Boolean(result.permissionAuditTruncated),
    "execution.host_api_event_count": result.hostApiEvents?.length ?? 0,
    "execution.runtime": "deno",
    "execution.runtime_version": result.runtimeVersion ?? "",
    "execution.container_runtime": result.manifest?.dockerRuntime ?? "runc",
    "execution.failure_category": result.failureCategory ?? "",
    "execution.permission_profile": result.manifest?.permissionProfile ?? "",
    "trace.id": traceId,
    // legacy flat keys still used by older exporter helpers
    provider: result.provider,
    language,
    duration_ms: result.durationMs,
    exit_code: result.exitCode ?? -1,
    timed_out: result.timedOut,
    output_truncated: result.outputTruncated,
    permission_access_count: result.permissionEvents?.length ?? 0,
    permission_audit_truncated: Boolean(result.permissionAuditTruncated),
    host_api_event_count: result.hostApiEvents?.length ?? 0,
    runtime_version: result.runtimeVersion ?? "",
    failure_category: result.failureCategory ?? "",
    permission_profile: result.manifest?.permissionProfile ?? "",
  };
}

async function persistPermissionObservations(
  client: PoolClient,
  executionId: string,
  result: ExecutionResult,
  traceId?: string,
): Promise<void> {
  const events = result.permissionEvents ?? [];
  for (const ev of events) {
    const target = typeof ev.target === "string"
      ? ev.target.slice(0, 512)
      : null;
    await riskRepo.addSecurityEvent(client, {
      executionId,
      eventType: "permission.accessed",
      severity: "info",
      message: target
        ? `Permission accessed: ${ev.permission} ${target}`
        : `Permission accessed: ${ev.permission}`,
      metadata: {
        source: "deno_permission_audit",
        permission: ev.permission,
        target,
        auditVersion: ev.auditVersion ?? 1,
        datetime: ev.datetime ?? null,
        traceId: traceId ?? result.traceId ?? null,
      },
    });
  }

  if (result.permissionAuditTruncated) {
    await riskRepo.addSecurityEvent(client, {
      executionId,
      eventType: "permission.audit_truncated",
      severity: "warning",
      message: "Permission audit truncated at configured limit",
      metadata: {
        source: "supervisor",
        acceptedCount: events.length,
        traceId: traceId ?? result.traceId ?? null,
      },
    });
  }

  if (result.failureCategory === "deno_permission") {
    await riskRepo.addSecurityEvent(client, {
      executionId,
      eventType: "execution.failure.deno_permission",
      severity: "warning",
      message:
        "Execution failed with a Deno permission error (separate from audit access events)",
      metadata: {
        source: "supervisor",
        failureCategory: "deno_permission",
        stderrPreview: (result.stderr || "").slice(0, 400),
        traceId: traceId ?? result.traceId ?? null,
      },
    });
  }

  // Host Gateway usually posts host_api.* live; only backfill missing callIds.
  const existingHost = await riskRepo.listSecurityEvents(client, {
    executionId,
    limit: 500,
  });
  const seenHostKeys = new Set(
    existingHost
      .filter((e) => e.eventType.startsWith("host_api."))
      .map((e) => `${e.eventType}:${String(e.metadata?.callId ?? "")}`),
  );
  for (const ev of result.hostApiEvents ?? []) {
    const key = `${ev.eventType}:${ev.callId}`;
    if (seenHostKeys.has(key)) continue;
    seenHostKeys.add(key);
    await riskRepo.addSecurityEvent(client, {
      executionId,
      eventType: ev.eventType,
      severity: ev.eventType === "host_api.denied" ? "warning" : "info",
      message: ev.reason
        ? `${ev.eventType}: ${ev.capability} (${ev.reason})`
        : `${ev.eventType}: ${ev.capability}`,
      metadata: {
        source: "host_gateway",
        capability: ev.capability,
        callId: ev.callId,
        commandId: ev.commandId ?? null,
        reason: ev.reason ?? null,
        messagePreview: ev.messagePreview ?? null,
        timestamp: ev.timestamp,
        traceId: traceId ?? result.traceId ?? null,
      },
    });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** @deprecated alias — use ExecutionService */
export type MockExecutionService = ExecutionService;

/** Factory used by main.ts — single place for EXECUTION_PROVIDER selection. */
export function createExecutionService(
  riskAnalyzer: RiskAnalyzer,
  providerKind: string = Deno.env.get("EXECUTION_PROVIDER") ?? "mock",
): ExecutionService {
  const provider = createExecutionProvider(providerKind);
  console.log(`[api] execution provider: ${provider.name}`);
  console.log(`[api] risk analyzer: ${riskAnalyzer.name}`);
  return new ExecutionService(riskAnalyzer, provider);
}
