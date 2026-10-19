import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  sanitizePlayerCommand,
  sanitizeHostEventPayload,
} from "../src/host/command-sanitizer.ts";
import { clampHostEventLimit } from "../src/repositories/host.ts";
import { ALLOWED_HOST_EVENTS } from "../src/domain/types.ts";
import { Hono } from "jsr:@hono/hono@4.6.5";

Deno.test("sanitizePlayerCommand redacts login/register/password args", () => {
  assertEquals(
    sanitizePlayerCommand("/login mySecretPassword"),
    "/login [REDACTED]",
  );
  assertEquals(
    sanitizePlayerCommand("/register user pass"),
    "/register [REDACTED]",
  );
  assertEquals(sanitizePlayerCommand("/passwd old new"), "/passwd [REDACTED]");
});

Deno.test("sanitizePlayerCommand leaves harmless commands intact", () => {
  assertEquals(sanitizePlayerCommand("/help"), "/help");
  assertEquals(
    sanitizePlayerCommand("/gamemode creative"),
    "/gamemode creative",
  );
});

Deno.test("sanitizeHostEventPayload only rewrites player_command", () => {
  const chat = sanitizeHostEventPayload("player_chat", {
    message: "hello",
    playerName: "Steve",
  });
  assertEquals(chat.message, "hello");

  const cmd = sanitizeHostEventPayload("player_command", {
    command: "/login secret",
    playerName: "Steve",
  });
  assertEquals(cmd.command, "/login [REDACTED]");
});

Deno.test("host event allowlist includes chat and command", () => {
  assertEquals(ALLOWED_HOST_EVENTS.includes("player_join"), true);
  assertEquals(ALLOWED_HOST_EVENTS.includes("player_chat"), true);
  assertEquals(ALLOWED_HOST_EVENTS.includes("player_command"), true);
  assertEquals(ALLOWED_HOST_EVENTS.includes("player_leave"), true);
});

Deno.test("clampHostEventLimit caps and defaults", () => {
  assertEquals(clampHostEventLimit(undefined), 100);
  assertEquals(clampHostEventLimit(50), 50);
  assertEquals(clampHostEventLimit(9999), 200);
  assertEquals(clampHostEventLimit(-1), 100);
});

Deno.test("GET /api/host/events accepts limit query shape", async () => {
  // Lightweight route stub mirroring limit parsing (no DB)
  const app = new Hono();
  app.get("/events", (c) => {
    const limit = clampHostEventLimit(c.req.query("limit"));
    return c.json({ items: [], limit });
  });
  const res = await app.request("http://localhost/events?limit=100");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.limit, 100);
  assertEquals(Array.isArray(body.items), true);
});

Deno.test("player_chat / player_command payload shapes are serializable", () => {
  const chat = {
    type: "player_chat",
    playerId: "00000000-0000-0000-0000-000000000001",
    playerName: "Steve",
    message: "hello from minecraft",
    timestamp: new Date().toISOString(),
  };
  const command = {
    type: "player_command",
    playerId: "00000000-0000-0000-0000-000000000001",
    playerName: "Steve",
    command: sanitizePlayerCommand("/login secret"),
    timestamp: new Date().toISOString(),
  };
  assertStringIncludes(JSON.stringify(chat), "player_chat");
  assertEquals(command.command, "/login [REDACTED]");
  assertEquals(JSON.stringify(command).includes("secret"), false);
});
