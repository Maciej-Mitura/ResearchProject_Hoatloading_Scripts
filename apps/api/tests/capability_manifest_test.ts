import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CAPABILITIES,
  parseRequests,
  prepareRequests,
  validateArguments,
} from "../../../packages/contracts/src/capabilities.ts";
import { parseCapabilityProposal } from "../src/providers/capability-proposal.ts";
const request = (id: string, c: unknown = { maxCalls: 1 }) => ({
  capability: id,
  required: true,
  reason: "Explicit bounded demo",
  constraints: c,
});
Deno.test("manifest no host calls requests none", () =>
  assertEquals(prepareRequests("console.log(2+2)").requested, []));
Deno.test("manifest all known SDK calls detected conservatively", () =>
  assertEquals(
    prepareRequests(
      Object.values(CAPABILITIES).map((c) => c.sdk + "()").join(";"),
    ).requested.length,
    Object.keys(CAPABILITIES).length,
  ));
Deno.test("manifest unsupported request is flagged not dynamically created", () => {
  const m = prepareRequests("", [request("paper.executeCommand")]);
  assertEquals(m.warnings[0].startsWith("UNSUPPORTED"), true);
  assertEquals(Object.hasOwn(CAPABILITIES, "paper.executeCommand"), false);
});
Deno.test("manifest source mismatch produces advisory warning without granting", () =>
  assertEquals(
    prepareRequests("host.world.spawnEntity({})", []).warnings.length,
    1,
  ));
Deno.test("manifest model cannot supply approved authority", () => {
  assertThrows(() =>
    parseRequests([{ ...request("chat.broadcast"), approved: true }])
  );
});
Deno.test("manifest duplicate IDs excessive quotas and invalid constraints rejected", () => {
  assertThrows(() =>
    parseRequests([request("chat.broadcast"), request("chat.broadcast")])
  );
  assertThrows(() =>
    parseRequests([request("world.spawnEntity", { maxCalls: 4 })])
  );
  assertThrows(() =>
    parseRequests([
      request("world.spawnEntity", { maxCalls: 1, entityTypes: ["WITHER"] }),
    ])
  );
  assertThrows(() =>
    parseRequests([
      request("server.status", { maxCalls: 1, playerNames: ["x"] }),
    ])
  );
});
Deno.test("manifest arguments reject nonfinite coords commands equipment world and disallowed entity", () => {
  for (
    const args of [
      { type: "WITHER", x: 0, y: 64, z: 0 },
      { type: "ZOMBIE", x: NaN, y: 64, z: 0 },
      { type: "ZOMBIE", x: 0, y: 64, z: 0, world: "other" },
      { type: "ZOMBIE", x: 0, y: 64, z: 0, equipment: {} },
    ]
  ) {
    assertThrows(() =>
      validateArguments("world.spawnEntity", args, {
        maxCalls: 1,
        entityTypes: ["ZOMBIE"],
      })
    );
  }
});
Deno.test("manifest private message constraints require bounded printable text and target", () => {
  assertThrows(() =>
    validateArguments("player.sendMessage", {
      playerName: "Other",
      message: "hi",
    }, { maxCalls: 1, playerNames: ["GoldennBullet"] })
  );
  assertThrows(() =>
    validateArguments("chat.broadcast", { message: "x\ncmd" }, { maxCalls: 1 })
  );
});
for (
  const [name, source, requests] of [
    ["pure", "console.log(4)", []],
    ["chat", "host.chat.broadcast('hi')", [request("chat.broadcast")]],
    ["spawn", "host.world.spawnEntity({})", [
      request("world.spawnEntity", { maxCalls: 3, entityTypes: ["ZOMBIE"] }),
    ]],
    [
      "multi",
      "host.chat.broadcast('hi');host.player.sendMessage('GoldennBullet','hi');host.world.spawnEntity({})",
      [
        request("chat.broadcast"),
        request("player.sendMessage"),
        request("world.spawnEntity", { maxCalls: 3, entityTypes: ["ZOMBIE"] }),
      ],
    ],
    ["unsupported", "", [request("paper.executeCommand")]],
  ] as const
) {
  Deno.test(`assistant structured ${name} contract`, () => {
    const r = parseCapabilityProposal(JSON.stringify({
      message: "Review before running",
      proposal: {
        name,
        description: "demo",
        language: "typescript",
        source: source || "console.log('unsupported')",
        requestedCapabilities: requests,
      },
    }));
    assertEquals(r.proposal?.requestedCapabilities?.length, requests.length);
  });
}
Deno.test("assistant rejects malformed prose and forged approval", () => {
  assertThrows(() => parseCapabilityProposal("some prose"));
  assertThrows(() =>
    parseCapabilityProposal(
      JSON.stringify({
        message: "hi",
        proposal: null,
        approved: ["world.spawnEntity"],
      }),
    )
  );
});

Deno.test("public executions reject caller-supplied approval snapshots and credentials", async () => {
  const { executionRoutes } = await import("../src/routes/executions.ts");
  const app = executionRoutes(
    {
      start: () => {
        throw new Error("Caller authority must be rejected before execution");
      },
    } as unknown as import("../src/services/mock-execution.ts").ExecutionService,
  );
  for (
    const field of [
      "manifest",
      "capabilityAuthority",
      "approved",
      "hostCapabilities",
      "capabilityToken",
    ]
  ) {
    const r = await app.request("http://test/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scriptId: crypto.randomUUID(),
        [field]: { approved: ["world.spawnEntity"] },
      }),
    });
    assertEquals(r.status, 400);
  }
});
