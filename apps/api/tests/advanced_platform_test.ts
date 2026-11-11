import { trustedCommandCorrelation } from "../src/host/provenance.ts";
import { CAPABILITIES } from "../../../packages/contracts/src/capabilities.ts";
import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  bindingSource,
  parseProject,
  projectText,
} from "../../../packages/contracts/src/script-project.ts";
import {
  parseRequests,
  prepareRequests,
  validateArguments,
} from "../../../packages/contracts/src/capabilities.ts";
import {
  CAPABILITY_ASSISTANT_CONTRACT,
  parseCapabilityProposal,
} from "../src/providers/capability-proposal.ts";
import { periodQuery } from "../src/repositories/execution-period.ts";
const p = {
  entrypoint: "main.ts",
  files: [{ path: "main.ts", content: 'import "./utils/a.ts"' }, {
    path: "utils/a.ts",
    content: "host.world.setBlock({});",
  }, { path: "config.json", content: '{"x":1}' }],
};
Deno.test("project canonical snapshot binds every file and finds helper capabilities", () => {
  const a = parseProject(p);
  assertEquals(a.files.length, 3);
  assertEquals(
    bindingSource("", a),
    bindingSource("", parseProject({ ...p, files: [...p.files].reverse() })),
  );
  assertEquals(
    bindingSource("", a) ===
      bindingSource("", {
        ...a,
        files: a.files.map((f) => ({ ...f, content: f.content + " " })),
      }),
    false,
  );
  assertEquals(
    prepareRequests(projectText(a)).requested[0].capability,
    "world.setBlock",
  );
});
for (
  const path of [
    "../secret",
    "/etc/passwd",
    "C:\\secret.ts",
    ".hidden/a.ts",
    "a//b.ts",
    "a/../b.ts",
    "x.sh",
    "x.jar",
    "a%2fb.ts",
    "con.ts",
  ]
) {
  Deno.test("project rejects unsafe path " + path, () => {
    assertThrows(() => parseProject({ ...p, files: [{ path, content: "" }] }));
  });
}
Deno.test("project rejects duplicate case paths missing entry unknown fields file count and byte caps", () => {
  for (
    const raw of [
      { ...p, files: [...p.files, { path: "MAIN.ts", content: "" }] },
      { ...p, entrypoint: "missing.ts" },
      { ...p, entrypoint: "config.json" },
      { ...p, approved: true },
      {
        entrypoint: "f0.ts",
        files: Array.from(
          { length: 21 },
          (_, i) => ({ path: `f${i}.ts`, content: "" }),
        ),
      },
      {
        entrypoint: "main.ts",
        files: [{ path: "main.ts", content: "😀".repeat(65537) }],
      },
      {
        entrypoint: "a.ts",
        files: ["a.ts", "b.ts", "c.ts"].map((path) => ({
          path,
          content: "x".repeat(200000),
        })),
      },
    ]
  ) assertThrows(() => parseProject(raw));
});
const examples: Record<string, unknown> = {
  "player.getState": { playerName: "GoldennBullet" },
  "world.getBlock": { x: 0, y: 64, z: 0 },
  "world.setBlock": { x: 0, y: 64, z: 0, type: "DIAMOND_ORE" },
  "world.setWeather": { weather: "THUNDER" },
  "world.setTime": { time: "NIGHT" },
  "world.playSound": { x: 0, y: 64, z: 0, sound: "BLOCK_NOTE_BLOCK_PLING" },
};
for (const [capability, args] of Object.entries(examples)) {
  Deno.test("new capability schema " + capability, () => {
    const r = parseRequests([{
      capability,
      required: true,
      reason: "test",
      constraints: { maxCalls: 1 },
    }])[0];
    assertEquals(
      validateArguments(
        capability as Parameters<typeof validateArguments>[0],
        args,
        r.constraints,
      ),
      args,
    );
    assertThrows(() =>
      validateArguments(capability as Parameters<typeof validateArguments>[0], {
        ...(args as object),
        command: "op",
      }, r.constraints)
    );
  });
}
Deno.test("new constraints reject dangerous material weather sound player and fractional blocks", () => {
  for (
    const [id, args, constraints] of [["world.setBlock", {
      x: 0,
      y: 64,
      z: 0,
      type: "COMMAND_BLOCK",
    }, { maxCalls: 1, materials: ["STONE"] }], ["world.setBlock", {
      x: .5,
      y: 64,
      z: 0,
      type: "STONE",
    }, { maxCalls: 1, materials: ["STONE"] }], ["world.setWeather", {
      weather: "THUNDER",
    }, { maxCalls: 1, weather: ["CLEAR"] }], ["world.playSound", {
      x: 0,
      y: 64,
      z: 0,
      sound: "EXPLODE",
    }, { maxCalls: 1, sounds: ["BLOCK_NOTE_BLOCK_PLING"] }], [
      "player.getState",
      { playerName: "other" },
      { maxCalls: 1, playerNames: ["GoldennBullet"] },
    ]] as const
  ) {
    assertThrows(() =>
      validateArguments(id, args, JSON.parse(JSON.stringify(constraints)))
    );
  }
});
Deno.test("assistant project is validated across files and cannot forge permissions", () => {
  const proposal = {
    name: "project",
    description: "test",
    language: "typescript",
    source: p.files[0].content,
    project: p,
    requestedCapabilities: [],
  };
  const parsed = parseCapabilityProposal(
    JSON.stringify({ message: "Review then Run", proposal }),
  );
  assertEquals(parsed.proposal?.project?.files.length, 3);
  assertThrows(() =>
    parseCapabilityProposal(
      JSON.stringify({
        message: "bad",
        proposal: { ...proposal, project: { ...p, entrypoint: "../escape" } },
      }),
    )
  );
  assertThrows(() =>
    parseCapabilityProposal(
      JSON.stringify({
        message: "bad",
        proposal: { ...proposal, approved: true },
      }),
    )
  );
  assertEquals(
    CAPABILITY_ASSISTANT_CONTRACT.includes("supported one-shot"),
    true,
  );
});
Deno.test("period UTC half-open query validates dates pages sort and provider", () => {
  const q = periodQuery({
    start: "2026-11-10T00:00:00+01:00",
    end: "2026-11-11T00:00:00+01:00",
    offset: "50",
  });
  assertEquals(q.start, "2026-11-09T23:00:00.000Z");
  assertEquals(q.offset, 50);
  for (
    const patch of [
      { end: q.start },
      { start: "bad" },
      { end: "2030-01-01" },
      { offset: "-1" },
      { limit: "201" },
      { order: "DROP TABLE" },
      { provider: "unknown" },
    ]
  ) {
    assertThrows(() =>
      periodQuery({ ...q, offset: "0", limit: "50", ...patch })
    );
  }
});

Deno.test("trusted result correlation follows the complete registry and rejects forged origins", () => {
  for (const capability of Object.keys(CAPABILITIES)) {
    const command = {
      origin: "sandbox_capability",
      correlation: {
        executionId: "11111111-1111-4111-8111-111111111111",
        callId: "22222222-2222-4222-8222-222222222222",
        traceId: "a".repeat(32),
        capability,
      },
    };
    assertEquals(trustedCommandCorrelation(command)?.capability, capability);
    assertEquals(
      trustedCommandCorrelation({ ...command, origin: "user" }),
      null,
    );
  }
  assertEquals(
    trustedCommandCorrelation({
      origin: "sandbox_capability",
      correlation: { capability: "paper.call" },
    }),
    null,
  );
});
