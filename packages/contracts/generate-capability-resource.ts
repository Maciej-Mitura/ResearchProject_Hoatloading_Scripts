import {
  CAPABILITIES,
  ENTITY_TYPES,
  MATERIALS,
  SOUNDS,
  TIMES,
  WEATHER,
} from "./src/capabilities.ts";
const target = new URL(
  "../../minecraft/bridge/src/main/resources/capability-registry.json",
  import.meta.url,
);
const output = JSON.stringify(
  {
    capabilities: CAPABILITIES,
    entityTypes: ENTITY_TYPES,
    materials: MATERIALS,
    weather: WEATHER,
    times: TIMES,
    sounds: SOUNDS,
  },
  null,
  2,
) + "\n";
if (Deno.args.includes("--check")) {
  if (await Deno.readTextFile(target) !== output) {
    throw new Error("Regenerate the Paper capability registry resource");
  }
} else await Deno.writeTextFile(target, output);
