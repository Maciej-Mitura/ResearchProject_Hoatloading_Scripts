import type { Context, Next } from "jsr:@hono/hono@4.6.5";
import { jsonError } from "./errors.ts";
import {
  serviceAuthorized,
  validServiceSecret,
} from "../../../../packages/contracts/src/service-auth.ts";

/**
 * Shared development token for bridge authentication.
 * This is NOT the final security architecture.
 */
export async function bridgeAuth(c: Context, next: Next) {
  const expected = Deno.env.get("BRIDGE_TOKEN");
  if (!validServiceSecret(expected)) {
    return jsonError(
      c,
      503,
      "misconfigured",
      "BRIDGE_TOKEN requires an explicit non-placeholder secret of at least 32 characters",
    );
  }
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : c.req.header("X-Bridge-Token");
  if (!serviceAuthorized(expected, token)) {
    return jsonError(c, 401, "unauthorized", "Invalid bridge token");
  }
  await next();
}
