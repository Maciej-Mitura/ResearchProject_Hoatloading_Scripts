/**
 * Resolve the version-controlled config/ directory (project-spec, policy, capabilities).
 */

import { fromFileUrl, join } from "https://deno.land/std@0.224.0/path/mod.ts";

export function resolveConfigDir(): string {
  const env = Deno.env.get("PROJECT_CONFIG_DIR")?.trim();
  if (env) return env.replace(/[/\\]+$/, "");
  // apps/api/src/project → repo root → config/
  return fromFileUrl(new URL("../../../../config/", import.meta.url)).replace(
    /[/\\]+$/,
    "",
  );
}

export function configFile(name: string): string {
  return join(resolveConfigDir(), name);
}
