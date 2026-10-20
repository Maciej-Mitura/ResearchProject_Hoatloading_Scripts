import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  clearAllSessions,
  createSession,
  hasCapability,
  incrementCallCount,
  lookupSession,
  revokeSession,
} from "../src/sessions.ts";

Deno.test("createSession issues opaque token with trusted capabilities", () => {
  clearAllSessions();
  const s = createSession({
    executionId: "exec-1",
    capabilities: ["chat.broadcast"],
    ttlMs: 5000,
  });
  assertEquals(typeof s.token, "string");
  assertEquals(s.token.length >= 32, true);
  assertEquals(s.capabilities, ["chat.broadcast"]);
  const looked = lookupSession(s.token);
  assertEquals(looked.session?.executionId, "exec-1");
  assertEquals(hasCapability(looked.session!, "chat.broadcast"), true);
});

Deno.test("createSession rejects unknown capabilities", () => {
  clearAllSessions();
  let threw = false;
  try {
    createSession({
      executionId: "exec-1",
      capabilities: ["console.execute"],
    });
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("revokeSession invalidates token", () => {
  clearAllSessions();
  const s = createSession({
    executionId: "exec-2",
    capabilities: ["chat.broadcast"],
  });
  revokeSession(s.token);
  const looked = lookupSession(s.token);
  assertEquals(looked.session, null);
  assertEquals(looked.denial, "invalid_token");
});

Deno.test("expired token is rejected", async () => {
  clearAllSessions();
  const s = createSession({
    executionId: "exec-3",
    capabilities: ["chat.broadcast"],
    ttlMs: 1,
  });
  await new Promise((r) => setTimeout(r, 5));
  const looked = lookupSession(s.token);
  assertEquals(looked.session, null);
  assertEquals(looked.denial, "expired_token");
});

Deno.test("missing and invalid tokens denied", () => {
  clearAllSessions();
  assertEquals(lookupSession(null).denial, "missing_token");
  assertEquals(lookupSession("nope").denial, "invalid_token");
});

Deno.test("call budget counter increments", () => {
  clearAllSessions();
  const s = createSession({
    executionId: "exec-4",
    capabilities: ["chat.broadcast"],
  });
  const session = lookupSession(s.token).session!;
  assertEquals(incrementCallCount(session, "chat.broadcast"), 1);
  assertEquals(incrementCallCount(session, "chat.broadcast"), 2);
});
