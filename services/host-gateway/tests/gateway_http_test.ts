import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ADMIN_TOKEN } from "../src/config.ts";
import { app } from "../src/main.ts";
import { clearAllSessions } from "../src/sessions.ts";

async function createToken(): Promise<string> {
  const res = await app.request("http://localhost/internal/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_TOKEN}`,
    },
    body: JSON.stringify({
      executionId: "exec-http-1",
      capabilities: ["chat.broadcast"],
      ttlMs: 30_000,
    }),
  });
  assertEquals(res.status, 201);
  const body = await res.json();
  return body.token as string;
}

Deno.test("admin session create requires token", async () => {
  clearAllSessions();
  const res = await app.request("http://localhost/internal/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      executionId: "x",
      capabilities: ["chat.broadcast"],
    }),
  });
  assertEquals(res.status, 401);
});

Deno.test("invalid capability token rejected", async () => {
  clearAllSessions();
  const res = await app.request(
    "http://localhost/v1/capabilities/chat.broadcast",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer totally-invalid",
      },
      body: JSON.stringify({ message: "hi" }),
    },
  );
  assertEquals(res.status, 401);
});

Deno.test("unknown capability path is 404", async () => {
  clearAllSessions();
  const token = await createToken();
  const res = await app.request(
    "http://localhost/v1/capabilities/console.execute",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ command: "op" }),
    },
  );
  assertEquals(res.status, 404);
});

Deno.test("empty message rejected without enqueue", async () => {
  clearAllSessions();
  const token = await createToken();
  const res = await app.request(
    "http://localhost/v1/capabilities/chat.broadcast",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: "" }),
    },
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.accepted, false);
});
