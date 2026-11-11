/** Post-research product extension. Never grants authority from source detection. */
export const ENTITY_TYPES = ["ZOMBIE", "SKELETON", "COW", "PIG"] as const;
export const MATERIALS = [
  "STONE",
  "DIRT",
  "GRASS_BLOCK",
  "COBBLESTONE",
  "OAK_PLANKS",
  "GLASS",
  "GOLD_BLOCK",
  "DIAMOND_ORE",
  "AIR",
] as const;
export const WEATHER = ["CLEAR", "RAIN", "THUNDER"] as const;
export const TIMES = ["DAY", "NOON", "SUNSET", "NIGHT"] as const;
export const SOUNDS = [
  "ENTITY_ZOMBIE_AMBIENT",
  "BLOCK_NOTE_BLOCK_PLING",
  "ENTITY_EXPERIENCE_ORB_PICKUP",
] as const;
export const CAPABILITIES = {
  "chat.broadcast": {
    version: 1,
    label: "Chat broadcast",
    description: "Send a bounded server-wide message.",
    impact: "low",
    maxCalls: 5,
    command: "broadcast_message",
    sdk: "host.chat.broadcast",
  },
  "server.status": {
    version: 1,
    label: "Server status",
    description:
      "Read player counts, Paper version and the public demo location.",
    impact: "low",
    maxCalls: 3,
    command: "capability_status",
    sdk: "host.server.status",
  },
  "player.sendMessage": {
    version: 1,
    label: "Private player message",
    description: "Send a bounded message to an online player.",
    impact: "low",
    maxCalls: 5,
    command: "send_player_message",
    sdk: "host.player.sendMessage",
  },
  "player.getState": {
    version: 1,
    label: "Player state",
    description: "Read sanitized online player position, rotation and world.",
    impact: "low",
    maxCalls: 3,
    command: "player_state",
    sdk: "host.player.getState",
  },
  "world.getBlock": {
    version: 1,
    label: "Read block",
    description: "Read a block in the loaded demo area.",
    impact: "low",
    maxCalls: 5,
    command: "get_block",
    sdk: "host.world.getBlock",
  },
  "world.setBlock": {
    version: 1,
    label: "Place block",
    description: "Place approved demo materials in the loaded demo area.",
    impact: "review",
    maxCalls: 5,
    command: "set_block",
    sdk: "host.world.setBlock",
  },
  "world.setWeather": {
    version: 1,
    label: "Change weather",
    description: "Set approved weather in the active world.",
    impact: "review",
    maxCalls: 1,
    command: "set_weather",
    sdk: "host.world.setWeather",
  },
  "world.setTime": {
    version: 1,
    label: "Change time",
    description: "Set an approved time preset in the active world.",
    impact: "review",
    maxCalls: 1,
    command: "set_time",
    sdk: "host.world.setTime",
  },
  "world.playSound": {
    version: 1,
    label: "Play sound",
    description: "Play an allowlisted sound in the loaded demo area.",
    impact: "low",
    maxCalls: 3,
    command: "play_sound",
    sdk: "host.world.playSound",
  },
  "world.spawnEntity": {
    version: 1,
    label: "Spawn entities",
    description:
      "Spawn ZOMBIE, SKELETON, COW or PIG near the active world's spawn, in loaded chunks only.",
    impact: "review",
    maxCalls: 3,
    command: "spawn_entity",
    sdk: "host.world.spawnEntity",
  },
} as const;
export type CapabilityId = keyof typeof CAPABILITIES;
export interface CapabilityConstraints {
  maxCalls: number;
  entityTypes?: string[];
  playerNames?: string[];
  materials?: string[];
  weather?: string[];
  times?: string[];
  sounds?: string[];
}
export interface CapabilityRequest {
  capability: string;
  required: boolean;
  reason: string;
  constraints: CapabilityConstraints;
}
export interface CapabilityReview {
  id: string;
  approvedAt: string;
  approved: CapabilityRequest[];
  denied: CapabilityRequest[];
}
export interface CapabilityManifest {
  schemaVersion: 1;
  id: string;
  scriptId: string;
  scriptVersionId: string;
  sourceSha256: string;
  requested: CapabilityRequest[];
  warnings: string[];
  review: CapabilityReview | null;
}
export interface ExecutionAuthority extends CapabilityManifest {
  executionId: string;
}
export function isCapability(id: string): id is CapabilityId {
  return Object.hasOwn(CAPABILITIES, id);
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("JSON object required");
  }
  return value as Record<string, unknown>;
}
export function onlyKeys(value: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(value).some((k) => !keys.includes(k))) {
    throw new Error("Unsupported fields");
  }
}
export function parseRequests(raw: unknown): CapabilityRequest[] {
  if (!Array.isArray(raw) || raw.length > 16) {
    throw new Error("At most 16 capability requests allowed");
  }
  const seen = new Set<string>();
  return raw.map((item) => {
    const r = object(item);
    onlyKeys(r, ["capability", "required", "reason", "constraints"]);
    if (
      typeof r.capability !== "string" ||
      !/^[a-zA-Z][\w.]{0,79}$/.test(r.capability) || seen.has(r.capability)
    ) throw new Error("Invalid or duplicate capability");
    seen.add(r.capability);
    if (
      typeof r.required !== "boolean" || typeof r.reason !== "string" ||
      !r.reason.trim() || r.reason.length > 500
    ) throw new Error("Capability reason and required flag required");
    const c = object(r.constraints ?? {});
    onlyKeys(c, [
      "maxCalls",
      "entityTypes",
      "playerNames",
      "materials",
      "weather",
      "times",
      "sounds",
    ]);
    const max = isCapability(r.capability)
      ? CAPABILITIES[r.capability].maxCalls
      : 1;
    if (
      c.maxCalls !== undefined &&
      (!Number.isInteger(c.maxCalls) || Number(c.maxCalls) < 1 ||
        Number(c.maxCalls) > max)
    ) throw new Error("Invalid capability quota");
    const constraints: CapabilityConstraints = {
      maxCalls: c.maxCalls === undefined ? max : Number(c.maxCalls),
    };
    if (r.capability === "world.spawnEntity") {
      const types = c.entityTypes ?? [...ENTITY_TYPES];
      if (
        !Array.isArray(types) || !types.length || types.length > 4 ||
        types.some((t) => !ENTITY_TYPES.includes(t))
      ) throw new Error("Invalid entity allowlist");
      constraints.entityTypes = [...new Set(types)] as string[];
    } else if (c.entityTypes !== undefined) {
      throw new Error("Entity constraints apply only to spawning");
    }
    if (
      (r.capability === "player.sendMessage" ||
        r.capability === "player.getState") && c.playerNames !== undefined
    ) {
      if (
        !Array.isArray(c.playerNames) || !c.playerNames.length ||
        c.playerNames.length > 10 || c.playerNames.some((n) =>
          typeof n !== "string" || !/^[A-Za-z0-9_]{1,16}$/.test(n)
        )
      ) {
        throw new Error("Invalid player allowlist");
      }
      constraints.playerNames = [...new Set(c.playerNames)] as string[];
    } else if (c.playerNames !== undefined) {
      throw new Error("Player constraints apply only to messaging");
    }
    for (
      const [key, id, values] of [
        ["materials", "world.setBlock", MATERIALS],
        ["weather", "world.setWeather", WEATHER],
        ["times", "world.setTime", TIMES],
        ["sounds", "world.playSound", SOUNDS],
      ] as const
    ) {
      if (r.capability === id) {
        const supplied = c[key] ?? [...values];
        if (
          !Array.isArray(supplied) || !supplied.length ||
          supplied.length > values.length || supplied.some((v) =>
            !(values as readonly unknown[]).includes(v)
          )
        ) throw new Error("Invalid " + key + " allowlist");
        constraints[key] = [...new Set(supplied)] as string[];
      } else if (c[key] !== undefined) {
        throw new Error("Constraint does not apply: " + key);
      }
    }
    return {
      capability: r.capability,
      required: r.required,
      reason: r.reason.trim(),
      constraints,
    };
  });
}
export function detectedCapabilities(source: string): CapabilityId[] {
  return (Object.keys(CAPABILITIES) as CapabilityId[]).filter((id) =>
    source.includes(CAPABILITIES[id].sdk)
  );
}
export function prepareRequests(
  source: string,
  raw?: unknown,
): { requested: CapabilityRequest[]; warnings: string[] } {
  const requested = raw === undefined
    ? detectedCapabilities(source).map((capability) => ({
      capability,
      required: true,
      reason:
        "Known Host SDK call detected in saved source; detection is advisory.",
      constraints: {
        maxCalls: CAPABILITIES[capability].maxCalls,
        ...(capability === "world.spawnEntity"
          ? { entityTypes: [...ENTITY_TYPES] }
          : {}),
      },
    }))
    : parseRequests(raw);
  const warnings = requested.filter((r) => !isCapability(r.capability)).map(
    (r) =>
      `UNSUPPORTED: ${r.capability}. The assistant requested a capability that this project does not expose.`,
  );
  for (const id of detectedCapabilities(source)) {
    if (!requested.some((r) => r.capability === id)) {
      warnings.push(
        `Source uses ${id}, but the manifest does not request it. The Gateway will deny it.`,
      );
    }
  }
  return { requested: parseRequests(requested), warnings };
}
export function validateArguments(
  id: CapabilityId,
  raw: unknown,
  constraints: CapabilityConstraints,
): Record<string, unknown> {
  const a = object(raw);
  switch (id) {
    case "server.status":
      onlyKeys(a, []);
      break;
    case "chat.broadcast":
    case "player.sendMessage": {
      onlyKeys(
        a,
        id === "chat.broadcast" ? ["message"] : ["playerName", "message"],
      );
      if (
        typeof a.message !== "string" || !a.message.trim() ||
        a.message.length > 256 || /[\x00-\x1f\x7f§]/.test(a.message)
      ) throw new Error("Message must contain 1–256 printable characters");
      if (
        id === "player.sendMessage" &&
        (typeof a.playerName !== "string" ||
          !/^[A-Za-z0-9_]{1,16}$/.test(a.playerName) ||
          (constraints.playerNames &&
            !constraints.playerNames.includes(a.playerName)))
      ) throw new Error("Player outside approved constraint");
      break;
    }
    case "player.getState":
      onlyKeys(a, ["playerName"]);
      if (
        typeof a.playerName !== "string" ||
        !/^[A-Za-z0-9_]{1,16}$/.test(a.playerName) ||
        (constraints.playerNames &&
          !constraints.playerNames.includes(a.playerName))
      ) throw new Error("Player outside approved constraint");
      break;
    case "world.setWeather":
    case "world.setTime": {
      const key = id === "world.setWeather" ? "weather" : "times",
        arg = id === "world.setWeather" ? "weather" : "time";
      onlyKeys(a, [arg]);
      const registered = id === "world.setWeather" ? WEATHER : TIMES;
      if (
        typeof a[arg] !== "string" ||
        !(registered as readonly string[]).includes(a[arg] as string) ||
        !constraints[key]?.includes(a[arg] as string)
      ) throw new Error("Value outside approved constraint");
      break;
    }
    case "world.getBlock":
    case "world.setBlock":
    case "world.playSound": {
      onlyKeys(
        a,
        id === "world.getBlock"
          ? ["x", "y", "z"]
          : id === "world.setBlock"
          ? ["x", "y", "z", "type"]
          : ["x", "y", "z", "sound"],
      );
      coordinates(a, id !== "world.playSound");
      if (
        id === "world.setBlock" &&
        (typeof a.type !== "string" ||
          !(MATERIALS as readonly string[]).includes(a.type) ||
          !constraints.materials?.includes(a.type))
      ) throw new Error("Material outside approved constraint");
      if (
        id === "world.playSound" &&
        (typeof a.sound !== "string" ||
          !(SOUNDS as readonly string[]).includes(a.sound) ||
          !constraints.sounds?.includes(a.sound))
      ) throw new Error("Sound outside approved constraint");
      break;
    }
    case "world.spawnEntity":
      onlyKeys(a, ["type", "x", "y", "z"]);
      if (
        typeof a.type !== "string" ||
        !(ENTITY_TYPES as readonly string[]).includes(a.type) ||
        !constraints.entityTypes?.includes(a.type)
      ) throw new Error("Entity outside approved constraint");
      for (const axis of ["x", "y", "z"]) {
        if (
          typeof a[axis] !== "number" || !Number.isFinite(a[axis]) ||
          Math.abs(Number(a[axis])) > 30000000
        ) throw new Error("Coordinates must be finite and bounded");
      }
      if (Number(a.y) < -64 || Number(a.y) > 320) {
        throw new Error("Height outside supported bounds");
      }
      break;
  }
  return a;
}
export async function sourceHash(source: string): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)),
    ),
  ].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function coordinates(a: Record<string, unknown>, integer: boolean) {
  for (const axis of ["x", "y", "z"]) {
    if (
      typeof a[axis] !== "number" || !Number.isFinite(a[axis]) ||
      Math.abs(Number(a[axis])) > 30000000 ||
      (integer && !Number.isInteger(a[axis]))
    ) {
      throw new Error(
        "Coordinates must be finite, bounded" + (integer ? " integers" : ""),
      );
    }
  }
  if (Number(a.y) < -64 || Number(a.y) > 320) {
    throw new Error("Height outside supported bounds");
  }
}
export const CAPABILITY_EXAMPLES: Record<CapabilityId, string> = {
  "chat.broadcast": 'await host.chat.broadcast("Hello");',
  "server.status": "const status = await host.server.status();",
  "player.sendMessage":
    'await host.player.sendMessage("GoldennBullet", "Hello");',
  "player.getState":
    'const player = await host.player.getState("GoldennBullet");',
  "world.getBlock": "await host.world.getBlock({x: 0, y: 64, z: 0});",
  "world.setBlock":
    'await host.world.setBlock({x: 0, y: 64, z: 0, type: "DIAMOND_ORE"});',
  "world.spawnEntity":
    'await host.world.spawnEntity({type: "ZOMBIE", x: 0, y: 64, z: 0});',
  "world.setWeather": 'await host.world.setWeather("THUNDER");',
  "world.setTime": 'await host.world.setTime("NIGHT");',
  "world.playSound":
    'await host.world.playSound({sound: "BLOCK_NOTE_BLOCK_PLING", x: 0, y: 64, z: 0});',
};
