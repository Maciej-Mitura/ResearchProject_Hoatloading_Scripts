import type { Context, Next } from "jsr:@hono/hono@4.6.5";

export async function corsMiddleware(c: Context, next: Next) {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Bridge-Token",
  );
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
}
