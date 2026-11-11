import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CAPABILITIES,
  parseRequests,
  validateArguments,
} from "../src/capabilities.ts";
import {
  bindingSource,
  parseProject,
  singleProject,
} from "../src/script-project.ts";
Deno.test("canonical one-file and multi-file snapshot contracts", () => {
  const one = singleProject("console.log(1)", "typescript");
  assertEquals(parseProject(one).entrypoint, "main.ts");
  assertEquals(bindingSource("legacy"), "legacy");
  const a = {
    entrypoint: "main.ts",
    files: [...one.files, { path: "a.json", content: "{}" }],
  };
  assertEquals(
    bindingSource("", a),
    bindingSource("", { ...a, files: [...a.files].reverse() }),
  );
});
Deno.test("registered capability requests normalize enforceable constraints", () => {
  for (const capability of Object.keys(CAPABILITIES)) {
    const [r] = parseRequests([{
      capability,
      required: true,
      reason: "contract",
      constraints: { maxCalls: 1 },
    }]);
    assertEquals(r.constraints.maxCalls, 1);
  }
  assertThrows(() =>
    validateArguments("world.setBlock", {
      x: 0,
      y: 64,
      z: 0,
      type: "COMMAND_BLOCK",
    }, { maxCalls: 1, materials: ["STONE"] })
  );
});
Deno.test("generated Paper capability resource matches shared authority", async () => {
  const raw = JSON.parse(
    await Deno.readTextFile(
      new URL(
        "../../../minecraft/bridge/src/main/resources/capability-registry.json",
        import.meta.url,
      ),
    ),
  );
  assertEquals(raw.capabilities, CAPABILITIES);
  assertEquals(raw.materials.includes("COMMAND_BLOCK"), false);
});
