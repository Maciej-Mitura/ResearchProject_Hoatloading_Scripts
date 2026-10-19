/**
 * MockExecutionService — deterministic state machine for the UI workflow.
 *
 * RESEARCH TODO: replace with real sandbox orchestration (Deno permissions,
 * gVisor, resource limits, watchdogs). This service does NOT execute
 * uploaded script source code.
 *
 * Risk assessment is advisory only and does not grant permissions.
 */

import { withClient } from "../db/client.ts";
import * as execRepo from "../repositories/executions.ts";
import * as scriptRepo from "../repositories/scripts.ts";
import * as riskRepo from "../repositories/risk.ts";
import type { RiskAnalyzer } from "../providers/risk.ts";
import type { Execution, ExecutionStatus } from "../domain/types.ts";
import { startExecutionSpan, endSpanOk, endSpanError } from "../telemetry/otel.ts";

type Listener = (execution: Execution) => void;

const STEP_DELAY_MS = 800;

export class MockExecutionService {
  private listeners = new Map<string, Set<Listener>>();
  private running = new Set<string>();

  constructor(private riskAnalyzer: RiskAnalyzer) {}

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
        console.error("[mock-exec] listener error", err);
      }
    }
  }

  async start(scriptId: string, scriptVersionId?: string): Promise<Execution> {
    const execution = await withClient(async (client) => {
      const script = await scriptRepo.getScript(client, scriptId);
      if (!script) throw new Error("Script not found");

      const version = scriptVersionId
        ? await scriptRepo.getScriptVersion(client, scriptVersionId)
        : await scriptRepo.getCurrentVersion(client, scriptId);

      if (!version) throw new Error("Script version not found");

      return execRepo.createExecution(client, scriptId, version.id);
    });

    // Fire-and-forget mock pipeline
    this.runPipeline(execution.id).catch((err) => {
      console.error(`[mock-exec] pipeline failed for ${execution.id}`, err);
    });

    return execution;
  }

  private async runPipeline(executionId: string): Promise<void> {
    if (this.running.has(executionId)) return;
    this.running.add(executionId);

    const span = startExecutionSpan(executionId);

    try {
      const version = await withClient(async (client) => {
        const exec = await execRepo.getExecution(client, executionId);
        if (!exec) throw new Error("missing execution");
        return scriptRepo.getScriptVersion(client, exec.scriptVersionId);
      });
      if (!version) throw new Error("missing version");

      // Deterministic demo failure
      const forceFail = version.source.includes("FAIL_DEMO");

      await this.transition(executionId, "validating", "Validating script metadata (mock)");
      await sleep(STEP_DELAY_MS);

      await this.transition(executionId, "analysing", "Running advisory risk analysis (mock)", {
        startedAt: true,
      });

      const assessment = await this.riskAnalyzer.analyze({
        scriptVersionId: version.id,
        language: version.language,
        source: version.source,
        executionId,
      });

      // Advisory only — never grants permissions.
      // For demo: high + BLOCK_DEMO blocks; otherwise continues.
      const shouldBlock =
        version.source.includes("BLOCK_DEMO") ||
        (assessment.classification === "high" && version.source.includes("DENY_DEMO"));

      const saved = await withClient(async (client) => {
        const risk = await riskRepo.saveRiskAssessment(
          client,
          version.id,
          executionId,
          assessment,
        );
        await riskRepo.addSecurityEvent(client, {
          executionId,
          eventType: "risk.assessment.mock",
          severity: assessment.classification === "high" ? "warning" : "info",
          message: `Mock risk: ${assessment.classification} (score=${assessment.score})`,
          metadata: { provider: assessment.provider, reasons: assessment.reasons },
        });
        await execRepo.updateExecutionStatus(client, executionId, "analysing", {
          riskAssessmentId: risk.id,
        });
        return risk;
      });

      const afterRisk = await withClient((c) => execRepo.getExecution(c, executionId));
      if (afterRisk) this.emit(afterRisk);

      await sleep(STEP_DELAY_MS);

      if (shouldBlock) {
        await this.transition(
          executionId,
          "blocked",
          `Blocked by deterministic demo policy (advisory risk=${saved.classification}). RESEARCH TODO: real policy engine.`,
          { finishedAt: true },
        );
        endSpanOk(span);
        return;
      }

      await this.transition(
        executionId,
        "running",
        "Simulating run (mock — source code is NOT executed)",
      );
      await sleep(STEP_DELAY_MS);

      if (forceFail) {
        await this.transition(executionId, "failed", "Deterministic FAIL_DEMO marker", {
          finishedAt: true,
          errorMessage: "Mock failure: FAIL_DEMO",
        });
        endSpanOk(span);
        return;
      }

      await this.transition(
        executionId,
        "completed",
        "Mock execution completed successfully",
        { finishedAt: true },
      );
      endSpanOk(span);
    } catch (err) {
      endSpanError(span, err);
      await this.transition(executionId, "failed", String(err), {
        finishedAt: true,
        errorMessage: String(err),
      });
    } finally {
      this.running.delete(executionId);
    }
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
