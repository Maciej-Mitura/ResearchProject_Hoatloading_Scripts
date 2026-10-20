/**
 * Trusted execution-trace / reconstruction tests.
 * These do not require a live OTel Collector.
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  addTraceEvent,
  endSpanOk,
  formatTraceparent,
  getCounters,
  isTelemetryEnabled,
  parseTraceparent,
  sanitizeAttrs,
  startChildSpan,
  startExecutionTrace,
  telemetryBlobLooksSafe,
} from "../src/telemetry/otel.ts";
import { buildExecutionTimeline } from "../src/telemetry/timeline.ts";
import type {
  Execution,
  ExecutionEvent,
  SecurityEvent,
} from "../src/domain/types.ts";

Deno.test("trusted execution trace creates executionId/traceId pair", () => {
  const before = getCounters().execution_count;
  const trace = startExecutionTrace("exec-abc", "docker");
  assertEquals(trace.executionId, "exec-abc");
  assertEquals(trace.traceId.length, 32);
  assertEquals(/^[0-9a-f]{32}$/.test(trace.traceId), true);
  assertEquals(trace.attributes["execution.id"], "exec-abc");
  assertEquals(getCounters().execution_count, before + 1);
  const tp = formatTraceparent(trace);
  assertExists(tp);
  const parsed = parseTraceparent(tp);
  assertEquals(parsed?.traceId, trace.traceId);
});

Deno.test("sanitizeAttrs strips secrets and script source keys", () => {
  const cleaned = sanitizeAttrs({
    "execution.id": "e1",
    HOST_CAPABILITY_TOKEN: "secret-token-value",
    BRIDGE_TOKEN: "bridge-secret",
    "script.source": "console.log(1)",
    source: "evil",
    capability: "chat.broadcast",
    "permission.type": "read",
  });
  assertEquals(cleaned["execution.id"], "e1");
  assertEquals(cleaned.capability, "chat.broadcast");
  assertEquals(cleaned["permission.type"], "read");
  assertEquals("HOST_CAPABILITY_TOKEN" in cleaned, false);
  assertEquals("BRIDGE_TOKEN" in cleaned, false);
  assertEquals("script.source" in cleaned, false);
  assertEquals("source" in cleaned, false);
});

Deno.test("telemetryBlobLooksSafe rejects token leakage", () => {
  assertEquals(
    telemetryBlobLooksSafe('{"attrs":{"capability":"chat.broadcast"}}'),
    true,
  );
  assertEquals(
    telemetryBlobLooksSafe("HOST_CAPABILITY_TOKEN=abc123"),
    false,
  );
  assertEquals(telemetryBlobLooksSafe('"script.source":"x"'), false);
});

Deno.test("collector disabled does not throw on export", () => {
  // Without OTEL_EXPORTER_OTLP_ENDPOINT, export is a no-op.
  assertEquals(isTelemetryEnabled(), false);
  const trace = startExecutionTrace("exec-offline", "mock");
  addTraceEvent(trace, "execution.started", { "evidence.source": "application" });
  const child = startChildSpan(trace, "sandbox.run", {});
  assertExists(child);
  // Must not throw / must not depend on Collector.
  endSpanOk(trace, { "execution.duration_ms": 12 });
});

Deno.test("permission and host_api events correlate on same trace", () => {
  const trace = startExecutionTrace("exec-corr", "docker");
  addTraceEvent(trace, "permission.accessed", {
    "permission.type": "read",
    "permission.target": "/etc/hosts",
    "evidence.source": "deno_permission_audit",
  });
  addTraceEvent(trace, "host_api.requested", {
    capability: "chat.broadcast",
    callId: "call-1",
    "evidence.source": "host_gateway",
  });
  addTraceEvent(trace, "host_api.allowed", {
    capability: "chat.broadcast",
    callId: "call-1",
    "evidence.source": "host_gateway",
  });
  addTraceEvent(trace, "host_api.denied", {
    capability: "chat.broadcast",
    callId: "call-2",
    "evidence.source": "host_gateway",
  });
  const names = trace.events.map((e) => e.name);
  assertEquals(names.includes("permission.accessed"), true);
  assertEquals(names.includes("host_api.allowed"), true);
  assertEquals(names.includes("host_api.denied"), true);
  for (const ev of trace.events) {
    assertEquals(ev.attributes["evidence.source"] !== undefined, true);
  }
});

Deno.test("caught-permission timeline shows access + completed + untrusted output", () => {
  const execution: Execution = {
    id: "exec-caught",
    scriptId: "s1",
    scriptVersionId: "v1",
    status: "completed",
    riskAssessmentId: null,
    errorMessage: null,
    result: {
      provider: "docker",
      exitCode: 0,
      stdout: "handled\n",
      stderr: "",
      durationMs: 40,
      timedOut: false,
      outputTruncated: false,
      traceId: "a".repeat(32),
    },
    startedAt: "2026-10-19T12:00:00.050Z",
    finishedAt: "2026-10-19T12:00:00.200Z",
    createdAt: "2026-10-19T12:00:00.000Z",
    updatedAt: "2026-10-19T12:00:00.200Z",
  };
  const executionEvents: ExecutionEvent[] = [
    {
      id: "ee1",
      executionId: "exec-caught",
      status: "running",
      message: "Running",
      createdAt: "2026-10-19T12:00:00.050Z",
    },
    {
      id: "ee2",
      executionId: "exec-caught",
      status: "completed",
      message: "done",
      createdAt: "2026-10-19T12:00:00.200Z",
    },
  ];
  const securityEvents: SecurityEvent[] = [
    {
      id: "se1",
      executionId: "exec-caught",
      eventType: "execution.started",
      severity: "info",
      message: "started",
      metadata: { source: "application", traceId: "a".repeat(32) },
      createdAt: "2026-10-19T12:00:00.050Z",
    },
    {
      id: "se2",
      executionId: "exec-caught",
      eventType: "permission.accessed",
      severity: "info",
      message: "Permission accessed: read /etc/hosts",
      metadata: {
        source: "deno_permission_audit",
        permission: "read",
        target: "/etc/hosts",
        traceId: "a".repeat(32),
      },
      createdAt: "2026-10-19T12:00:00.100Z",
    },
    {
      id: "se3",
      executionId: "exec-caught",
      eventType: "execution.completed",
      severity: "info",
      message: "completed",
      metadata: { source: "application", traceId: "a".repeat(32) },
      createdAt: "2026-10-19T12:00:00.200Z",
    },
  ];

  const timeline = buildExecutionTimeline({
    execution,
    executionEvents,
    securityEvents,
  });
  const kinds = timeline.map((t) => t.kind);
  assertEquals(kinds.includes("CREATED"), true);
  assertEquals(kinds.includes("PERMISSION"), true);
  assertEquals(kinds.includes("COMPLETED"), true);
  assertEquals(kinds.includes("SCRIPT_OUTPUT"), true);
  const output = timeline.find((t) => t.kind === "SCRIPT_OUTPUT");
  assertEquals(output?.source, "script_output");
  assertStringIncludes(output?.detail ?? "", "handled");
  const perm = timeline.find((t) => t.kind === "PERMISSION");
  assertEquals(perm?.source, "deno_permission_audit");
});

Deno.test("host_api allowed/denied and commandId appear in timeline", () => {
  const execution: Execution = {
    id: "exec-host",
    scriptId: "s1",
    scriptVersionId: "v1",
    status: "completed",
    riskAssessmentId: null,
    errorMessage: null,
    result: {
      provider: "docker",
      exitCode: 0,
      stdout: "",
      stderr: "",
      durationMs: 100,
      timedOut: false,
      outputTruncated: false,
      traceId: "b".repeat(32),
    },
    startedAt: "2026-10-19T12:00:00.000Z",
    finishedAt: "2026-10-19T12:00:01.000Z",
    createdAt: "2026-10-19T12:00:00.000Z",
    updatedAt: "2026-10-19T12:00:01.000Z",
  };
  const securityEvents: SecurityEvent[] = [
    {
      id: "1",
      executionId: "exec-host",
      eventType: "host_api.requested",
      severity: "info",
      message: "requested",
      metadata: {
        source: "host_gateway",
        capability: "chat.broadcast",
        callId: "call-xyz",
        traceId: "b".repeat(32),
      },
      createdAt: "2026-10-19T12:00:00.100Z",
    },
    {
      id: "2",
      executionId: "exec-host",
      eventType: "host_api.allowed",
      severity: "info",
      message: "allowed",
      metadata: {
        source: "host_gateway",
        capability: "chat.broadcast",
        callId: "call-xyz",
      },
      createdAt: "2026-10-19T12:00:00.110Z",
    },
    {
      id: "3",
      executionId: "exec-host",
      eventType: "host_api.queued",
      severity: "info",
      message: "queued",
      metadata: {
        source: "host_gateway",
        capability: "chat.broadcast",
        callId: "call-xyz",
        commandId: "cmd-12345678-aaaa",
      },
      createdAt: "2026-10-19T12:00:00.120Z",
    },
    {
      id: "4",
      executionId: "exec-host",
      eventType: "host.command.result",
      severity: "info",
      message: "result",
      metadata: {
        source: "secure_bridge",
        commandId: "cmd-12345678-aaaa",
        callId: "call-xyz",
        success: true,
      },
      createdAt: "2026-10-19T12:00:00.400Z",
    },
    {
      id: "5",
      executionId: "exec-host",
      eventType: "host_api.denied",
      severity: "warning",
      message: "denied",
      metadata: {
        source: "host_gateway",
        capability: "chat.broadcast",
        callId: "call-deny",
        reason: "invalid_token",
      },
      createdAt: "2026-10-19T12:00:00.500Z",
    },
  ];

  const timeline = buildExecutionTimeline({
    execution,
    executionEvents: [],
    securityEvents,
  });
  const labels = timeline.map((t) => t.label);
  assertEquals(labels.includes("HOST API ALLOWED"), true);
  assertEquals(labels.includes("HOST API DENIED"), true);
  assertEquals(labels.includes("HOST command result"), true);
  const queued = timeline.find((t) => t.label === "HOST API QUEUED");
  assertStringIncludes(queued?.detail ?? "", "cmd-1234");
});

Deno.test("mock risk evidence remains marked mock", () => {
  const execution: Execution = {
    id: "exec-mock",
    scriptId: "s1",
    scriptVersionId: "v1",
    status: "completed",
    riskAssessmentId: null,
    errorMessage: null,
    result: null,
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-10-19T12:00:00.000Z",
    updatedAt: "2026-10-19T12:00:00.000Z",
  };
  const timeline = buildExecutionTimeline({
    execution,
    executionEvents: [],
    securityEvents: [
      {
        id: "r1",
        executionId: "exec-mock",
        eventType: "risk.assessment.mock",
        severity: "info",
        message: "Mock risk: low",
        metadata: { source: "mock", provider: "mock" },
        createdAt: "2026-10-19T12:00:00.010Z",
      },
    ],
  });
  const risk = timeline.find((t) => t.kind === "RISK");
  assertEquals(risk?.source, "mock");
});
