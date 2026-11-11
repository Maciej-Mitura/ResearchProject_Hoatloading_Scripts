import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createInternalRoutes } from "../src/routes/internal.ts";
import { hostRoutes } from "../src/routes/host.ts";
import { createGatewayApps } from "../../../services/host-gateway/src/main.ts";
import {
  clearAllSessions,
  createSession,
} from "../../../services/host-gateway/src/sessions.ts";
import {
  parseGatewayCommand,
  trustedCommandCorrelation,
} from "../src/host/provenance.ts";
import { buildCollectedExecutionEvidence } from "../src/risk/collected-evidence.ts";

const serviceToken = crypto.randomUUID().replaceAll("-", "") +
  crypto.randomUUID().replaceAll("-", "");
const executionId = "12345678-1234-1234-1234-123456789abc";
const traceId = "a".repeat(32);
const correlation = {
  executionId,
  traceId,
  callId: crypto.randomUUID(),
  capability: "chat.broadcast" as const,
};
Deno.test("public command path cannot submit forged execution/call/trace metadata", async () => {
  const response = await hostRoutes.request("/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commandType: "broadcast_message",
      payload: { message: "x", _meta: correlation },
    }),
  });
  assertEquals(response.status, 403);
  assertEquals(
    trustedCommandCorrelation({
      origin: "unknown",
      correlation: null,
      ...{ payload: { _meta: correlation } },
    }),
    null,
  );
  assertEquals(
    parseGatewayCommand({ message: "x", ...correlation, _meta: correlation }),
    null,
  );
});
Deno.test("internal enqueue requires valid service identity; metadata namespaces cannot be smuggled", async () => {
  let called = false;
  const routes = createInternalRoutes({
    serviceToken,
    enqueue: async () => {
      called = true;
      return null;
    },
  });
  const req = (body: unknown, token?: string) =>
    routes.request("/host-commands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": token ?? "",
      },
      body: JSON.stringify(body),
    });
  assertEquals((await req({ message: "x", ...correlation })).status, 401);
  assertEquals(
    (await req({ message: "x", ...correlation }, "wrong")).status,
    401,
  );
  assertEquals(called, false);
  assertEquals(
    (await req(
      { message: "x", ...correlation, _meta: correlation },
      serviceToken,
    )).status,
    400,
  );
  assertEquals(called, false);
});
Deno.test("genuine gateway call generates identity and retains session correlation while ignoring forged headers", async () => {
  clearAllSessions();
  let queued: unknown = null;
  const { app } = createGatewayApps({
    postEvents: async () => {},
    enqueue: async (message, c) => {
      const parsed = parseGatewayCommand({
        message,
        executionId: c?.executionId,
        traceId: c?.traceId,
        callId: c?.callId,
      });
      assertEquals(parsed !== null, true);
      queued = {
        origin: "sandbox_capability",
        correlation: parsed!.correlation,
      };
      return { ok: true, commandId: "queue-owned-id" };
    },
  });
  const session = createSession({
    executionId,
    traceId,
    capabilities: ["chat.broadcast"],
  });
  const response = await app.request("/v1/capabilities/chat.broadcast", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
      traceparent: `00-${"f".repeat(32)}-${"f".repeat(16)}-01`,
      "X-Execution-Id": "forged",
    },
    body: JSON.stringify({
      message: "real request",
      _meta: {
        executionId: "forged",
        traceId: "f".repeat(32),
        callId: "forged",
      },
      executionId: "forged",
      traceId: "f".repeat(32),
      callId: "forged",
    }),
  });
  assertEquals(response.status, 200);
  const result = await response.json();
  const trusted = trustedCommandCorrelation(
    queued as { origin: string; correlation: unknown },
  );
  assertEquals(trusted?.executionId, executionId);
  assertEquals(trusted?.traceId, traceId);
  assertEquals(trusted?.callId, result.callId);
  clearAllSessions();
});
Deno.test("new evidence exposes completeness; absent historic metadata remains legacy unknown", () => {
  const input = {
    executionId,
    status: "completed",
    language: "javascript",
    permissionProfile: "none",
    result: { exitCode: 0, permissionEvents: [] },
  };
  assertEquals(
    buildCollectedExecutionEvidence(input).auditCollection.status,
    "legacy_unknown",
  );
  const current = buildCollectedExecutionEvidence({
    ...input,
    result: {
      ...input.result,
      auditCollection: { version: 1, status: "complete", reasons: [] },
    },
  });
  assertEquals(current.auditCollection.status, "complete");
  assertEquals(current.evidenceExtensionVersion, 1);
});
