import type { Context, Next } from "jsr:@hono/hono@4.6.5";
import { jsonError } from "./errors.ts";

/**
 * Shared development token for bridge authentication.
 * This is NOT the final security architecture.
 */
export async function bridgeAuth(c: Context, next: Next) {
  const expected = Deno.env.get("BRIDGE_TOKEN");
  if (!expected) {
    return jsonError(c, 500, "misconfigured", "BRIDGE_TOKEN is not set");
  }
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : c.req.header("X-Bridge-Token");
  if (!token || token !== expected) {
    return jsonError(c, 401, "unauthorized", "Invalid bridge token");
  }
  await next();
}
