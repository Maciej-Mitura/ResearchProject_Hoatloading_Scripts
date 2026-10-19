/**
 * Host capability catalogue loader.
 */

import { parse as parseYaml } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { configFile } from "./paths.ts";

export type CapabilityStatus = "implemented" | "mocked" | "planned";

export interface HostCapability {
  id: string;
  status: CapabilityStatus;
  description: string;
  bridgeCommand?: string;
  parameters?: Record<string, unknown>;
  returns?: Record<string, unknown>;
  constraints?: string[];
}

export interface CapabilityCatalogue {
  implemented: HostCapability[];
  roadmap: HostCapability[];
  all: HostCapability[];
}

let cache: CapabilityCatalogue | null = null;

export function clearCapabilityCache(): void {
  cache = null;
}

export async function loadHostCapabilities(
  path = configFile("host-capabilities.yaml"),
): Promise<CapabilityCatalogue> {
  if (cache) return cache;
  const text = await Deno.readTextFile(path);
  const raw = parseYaml(text) as Record<string, unknown>;
  const implemented: HostCapability[] = [];
  const roadmap: HostCapability[] = [];

  const caps = raw.capabilities;
  if (caps && typeof caps === "object" && !Array.isArray(caps)) {
    for (const [id, def] of Object.entries(caps as Record<string, unknown>)) {
      const cap = normalizeCap(id, def);
      if (cap.status === "implemented") implemented.push(cap);
      else roadmap.push(cap);
    }
  }

  const road = raw.roadmap;
  if (road && typeof road === "object" && !Array.isArray(road)) {
    for (const [id, def] of Object.entries(road as Record<string, unknown>)) {
      roadmap.push(normalizeCap(id, def));
    }
  }

  cache = { implemented, roadmap, all: [...implemented, ...roadmap] };
  return cache;
}

function normalizeCap(id: string, def: unknown): HostCapability {
  const d = (def && typeof def === "object" ? def : {}) as Record<string, unknown>;
  const status = (d.status as CapabilityStatus) ?? "planned";
  return {
    id,
    status,
    description: String(d.description ?? ""),
    bridgeCommand: d.bridgeCommand == null ? undefined : String(d.bridgeCommand),
    parameters: (d.parameters as Record<string, unknown>) ?? undefined,
    returns: (d.returns as Record<string, unknown>) ?? undefined,
    constraints: Array.isArray(d.constraints)
      ? d.constraints.map(String)
      : undefined,
  };
}
