import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Hono } from "jsr:@hono/hono@4.6.5";
import { bridgeAuth } from "../src/middleware/bridge-auth.ts";
Deno.test("bridge confirmation authority rejects missing/default/wrong credentials", async () => {
  const previous = Deno.env.get("BRIDGE_TOKEN");
  const secret = crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "");
  const app = new Hono();
  app.use("*", bridgeAuth);
  app.post("/result", (c) => c.json({ confirmed: true }));
  const send = (token?: string) =>
    app.request("/result", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  try {
    Deno.env.delete("BRIDGE_TOKEN");
    assertEquals((await send()).status, 503);
    Deno.env.set("BRIDGE_TOKEN", "change-me-local-dev-only");
    assertEquals((await send("change-me-local-dev-only")).status, 503);
    Deno.env.set("BRIDGE_TOKEN", secret);
    assertEquals((await send()).status, 401);
    assertEquals((await send("wrong")).status, 401);
    assertEquals((await send(secret)).status, 200);
  } finally {
    if (previous == null) Deno.env.delete("BRIDGE_TOKEN");
    else Deno.env.set("BRIDGE_TOKEN", previous);
  }
});
