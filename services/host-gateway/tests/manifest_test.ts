import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createGatewayApps } from "../src/main.ts";
import {
  clearAllSessions,
  lookupSession,
  revokeSession,
} from "../src/sessions.ts";
import type { ExecutionAuthority } from "../../../packages/contracts/src/capabilities.ts";
const admin = "a".repeat(64),
  exec = "11111111-1111-4111-8111-111111111111",
  hash = "b".repeat(64);
function authority(): ExecutionAuthority {
  return {
    schemaVersion: 1,
    id: "m",
    scriptId: "s",
    scriptVersionId: "v",
    executionId: exec,
    sourceSha256: hash,
    warnings: [],
    requested: [],
    review: {
      id: "r",
      approvedAt: new Date().toISOString(),
      approved: [{
        capability: "chat.broadcast",
        required: true,
        reason: "announce",
        constraints: { maxCalls: 1 },
      }, {
        capability: "world.spawnEntity",
        required: true,
        reason: "demo",
        constraints: { maxCalls: 1, entityTypes: ["ZOMBIE"] },
      }],
      denied: [],
    },
  };
}
async function fixture(a = authority()) {
  clearAllSessions();
  const events: unknown[] = [];
  const calls: unknown[] = [];
  const apps = createGatewayApps({
    adminToken: admin,
    authority: async () => a,
    postEvents: async (es) => {
      events.push(...es);
    },
    command: async (input) => {
      calls.push(input);
      return {
        accepted: true,
        success: true,
        commandId: crypto.randomUUID(),
        data: {},
      };
    },
  });
  const create = (body: Record<string, unknown> = {}) =>
    apps.adminApp.request("http://test/internal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        executionId: exec,
        manifestMode: true,
        sourceSha256: hash,
        ...body,
      }),
    });
  const res = await create();
  assertEquals(res.status, 201);
  const { token } = await res.json();
  lookupSession(token).session!.peerIp = "172.20.0.10";
  const call = (id: string, args: unknown, executionId = exec) =>
    apps.app.request(`http://test/v1/capabilities/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Execution-Id": executionId,
      },
      body: JSON.stringify(args),
    }, { peerIp: "172.20.0.10" });
  return { call, create, token, events, calls };
}
Deno.test("manifest approved chat respects narrower quota and legacy endpoint cannot bypass", async () => {
  const f = await fixture();
  assertEquals(
    (await f.call("chat.broadcast", { message: "hello" })).status,
    200,
  );
  assertEquals(
    (await f.call("chat.broadcast", { message: "again" })).status,
    429,
  );
  assertEquals(f.calls.length, 1);
});
Deno.test("manifest partial denial and unsupported IDs never queue", async () => {
  const f = await fixture();
  assertEquals(
    (await f.call("player.sendMessage", {
      playerName: "GoldennBullet",
      message: "hello",
    })).status,
    403,
  );
  assertEquals(
    (await f.call("paper.executeCommand", { command: "op" })).status,
    404,
  );
  assertEquals(f.calls.length, 0);
});
Deno.test("manifest entity allowlist rejects constraint escape and extra NBT", async () => {
  const f = await fixture();
  assertEquals(
    (await f.call("world.spawnEntity", { type: "SKELETON", x: 0, y: 64, z: 0 }))
      .status,
    400,
  );
  assertEquals(
    (await f.call("world.spawnEntity", {
      type: "ZOMBIE",
      x: 0,
      y: 64,
      z: 0,
      nbt: {},
    })).status,
    400,
  );
  assertEquals(f.calls.length, 0);
  assertEquals(
    (await f.call("world.spawnEntity", { type: "ZOMBIE", x: 0, y: 64, z: 0 }))
      .status,
    200,
  );
});
Deno.test("manifest cross execution header rejected and no callId chosen by sandbox", async () => {
  const f = await fixture();
  assertEquals(
    (await f.call("chat.broadcast", { message: "hello" }, "other-execution"))
      .status,
    403,
  );
  assertEquals(
    (await f.call("chat.broadcast", {
      message: "hello",
      callId: crypto.randomUUID(),
    })).status,
    400,
  );
  assertEquals(f.calls.length, 0);
});
Deno.test("manifest expired and revoked tokens rejected", async () => {
  const f = await fixture();
  lookupSession(f.token).session!.expiresAt = Date.now() - 1;
  assertEquals(
    (await f.call("chat.broadcast", { message: "hello" })).status,
    401,
  );
  const g = await fixture();
  revokeSession(g.token);
  assertEquals(
    (await g.call("chat.broadcast", { message: "hello" })).status,
    401,
  );
});
Deno.test("manifest source mismatch and duplicate session issuance fail closed", async () => {
  const f = await fixture();
  assertEquals((await f.create({ sourceSha256: "c".repeat(64) })).status, 400);
  assertEquals((await f.create()).status, 400);
});
Deno.test("manifest ignores caller-supplied grants in favor of database authority", async () => {
  const a = authority();
  a.review!.approved = [];
  const f = await fixture(a);
  assertEquals(
    (await f.call("world.spawnEntity", { type: "ZOMBIE", x: 0, y: 64, z: 0 }))
      .status,
    403,
  );
  assertEquals(f.calls.length, 0);
});
Deno.test("manifest audit has version constraints arguments and correlation without credentials", async () => {
  const f = await fixture();
  await f.call("world.spawnEntity", { type: "ZOMBIE", x: 0, y: 64, z: 0 });
  const text = JSON.stringify(f.events);
  assertEquals(text.includes(f.token), false);
  assertEquals(text.includes('"scriptVersionId":"v"'), true);
  assertEquals(text.includes('"entityTypes":["ZOMBIE"]'), true);
  assertEquals(text.includes('"arguments":{"type":"ZOMBIE"'), true);
});

Deno.test("manifest copied A credential and forged A header from sandbox B are rejected", async () => {
  const f = await fixture();
  const apps = createGatewayApps({ postEvents: async () => {} });
  const res = await apps.app.request(
    "http://test/v1/capabilities/world.spawnEntity",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${f.token}`,
        "X-Execution-Id": exec,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "ZOMBIE", x: 0, y: 64, z: 0 }),
    },
    { peerIp: "172.20.0.11" },
  );
  assertEquals(res.status, 403);
  assertEquals((await res.json()).error.code, "CAPABILITY_EXECUTION_MISMATCH");
});

Deno.test("manifest revoked credentials on new registered endpoint return unauthorized", async () => {
  const f = await fixture();
  revokeSession(f.token);
  assertEquals(
    (await f.call("world.spawnEntity", { type: "ZOMBIE", x: 0, y: 64, z: 0 }))
      .status,
    401,
  );
});

Deno.test("manifest cannot persist its own cleartext credential as a message argument", async () => {
  const f = await fixture();
  assertEquals(
    (await f.call("chat.broadcast", { message: f.token })).status,
    400,
  );
  assertEquals(f.calls.length, 0);
  assertEquals(JSON.stringify(f.events).includes(f.token), false);
});

Deno.test("manifest total execution budget applies across independently approved capabilities", async () => {
  const a = authority();
  a.review!.approved = [
    {
      capability: "chat.broadcast",
      required: true,
      reason: "test",
      constraints: { maxCalls: 5 },
    },
    {
      capability: "server.status",
      required: true,
      reason: "test",
      constraints: { maxCalls: 3 },
    },
    {
      capability: "player.sendMessage",
      required: true,
      reason: "test",
      constraints: { maxCalls: 5 },
    },
  ];
  const f = await fixture(a);
  for (let i = 0; i < 5; i++) {
    assertEquals(
      (await f.call("chat.broadcast", { message: "bounded" })).status,
      200,
    );
  }
  for (let i = 0; i < 3; i++) {
    assertEquals((await f.call("server.status", {})).status, 200);
  }
  for (let i = 0; i < 4; i++) {
    assertEquals(
      (await f.call("player.sendMessage", {
        playerName: "GoldennBullet",
        message: "bounded",
      })).status,
      200,
    );
  }
  assertEquals(
    (await f.call("player.sendMessage", {
      playerName: "GoldennBullet",
      message: "over total budget",
    })).status,
    429,
  );
  assertEquals(f.calls.length, 12);
});

Deno.test("expanded capability constraints quotas and denial stay fail-closed", async () => {
  const a = authority();
  a.review!.approved = [{
    capability: "world.setBlock",
    required: true,
    reason: "bounded block",
    constraints: { maxCalls: 1, materials: ["DIAMOND_ORE"] },
  }, {
    capability: "world.setWeather",
    required: true,
    reason: "weather",
    constraints: { maxCalls: 1, weather: ["CLEAR"] },
  }];
  const f = await fixture(a);
  assertEquals(
    (await f.call("world.setBlock", {
      x: 0,
      y: 64,
      z: 0,
      type: "COMMAND_BLOCK",
    })).status,
    400,
  );
  assertEquals(
    (await f.call("world.setBlock", { x: 0, y: 64, z: 0, type: "STONE" }))
      .status,
    400,
  );
  assertEquals(
    (await f.call("world.setWeather", { weather: "THUNDER" })).status,
    400,
  );
  assertEquals(
    (await f.call("world.playSound", {
      sound: "BLOCK_NOTE_BLOCK_PLING",
      x: 0,
      y: 64,
      z: 0,
    })).status,
    403,
  );
  assertEquals(f.calls.length, 0);
  assertEquals(
    (await f.call("world.setBlock", { x: 0, y: 64, z: 0, type: "DIAMOND_ORE" }))
      .status,
    200,
  );
  assertEquals(
    (await f.call("world.setBlock", { x: 0, y: 64, z: 0, type: "DIAMOND_ORE" }))
      .status,
    429,
  );
  assertEquals(f.calls.length, 1);
});
