/**
 * Trace context must not authorize host capabilities.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ADMIN_TOKEN } from "../src/config.ts";
import { app } from "../src/main.ts";
import { clearAllSessions } from "../src/sessions.ts";

const FORGED_TRACEPARENT =
  "00-ffffffffffffffffffffffffffffffff-ffffffffffffffff-01";

Deno.test("forged traceparent without token does not grant chat.broadcast", async () => {
  clearAllSessions();
  const res = await app.request(
    "http://localhost/v1/capabilities/chat.broadcast",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        traceparent: FORGED_TRACEPARENT,
      },
      body: JSON.stringify({ message: "should fail" }),
    },
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.accepted, false);
});

Deno.test("forged traceparent cannot impersonate another execution for auth", async () => {
  clearAllSessions();
  const create = await app.request("http://localhost/internal/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_TOKEN}`,
    },
    body: JSON.stringify({
      executionId: "exec-real-a",
      capabilities: ["chat.broadcast"],
      ttlMs: 30_000,
      traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }),
  });
  assertEquals(create.status, 201);
  const { token } = await create.json();

  // Valid token for exec-real-a + forged trace claiming a different execution.
  // Authorization must still be session-scoped to exec-real-a only.
  const res = await app.request(
    "http://localhost/v1/capabilities/chat.broadcast",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        traceparent: FORGED_TRACEPARENT,
        "X-Execution-Id": "exec-victim-b",
      },
      body: JSON.stringify({ message: "telemetry forgery probe" }),
    },
  );
  // May be 200 (queued) or 502 (API enqueue unavailable in unit test) —
  // but must NOT be 401/403 due to forged trace, and response executionId
  // must remain the session's execution.
  assertEquals([200, 502].includes(res.status), true);
  const body = await res.json();
  if (res.status === 200) {
    assertEquals(body.accepted, true);
    assertEquals(body.executionId, "exec-real-a");
  }
});

Deno.test("invalid token + forged traceparent still denied", async () => {
  clearAllSessions();
  const res = await app.request(
    "http://localhost/v1/capabilities/chat.broadcast",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer forged-capability-looking-token",
        traceparent: FORGED_TRACEPARENT,
      },
      body: JSON.stringify({ message: "nope" }),
    },
  );
  assertEquals(res.status, 401);
});
