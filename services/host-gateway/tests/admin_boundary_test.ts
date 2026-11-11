import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createGatewayApps } from "../src/main.ts";
import { serviceAuthorized } from "../../../packages/contracts/src/service-auth.ts";
import { clearAllSessions } from "../src/sessions.ts";

const secret = crypto.randomUUID().replaceAll("-", "") +
  crypto.randomUUID().replaceAll("-", "");
const request = (credential?: string) => ({
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
  },
  body: JSON.stringify({
    executionId: "test-execution",
    capabilities: ["chat.broadcast"],
  }),
});
Deno.test("admin auth rejects absent, placeholder and incorrect configuration/credentials", async () => {
  assertEquals(serviceAuthorized(undefined, secret), false);
  assertEquals(
    serviceAuthorized(
      "change-me-host-gateway-admin",
      "change-me-host-gateway-admin",
    ),
    false,
  );
  assertEquals(
    serviceAuthorized("example-" + "a".repeat(64), "example-" + "a".repeat(64)),
    false,
  );
  for (
    const configured of [
      undefined,
      "",
      "change-me-host-gateway-admin",
      "placeholder-" + "a".repeat(64),
    ]
  ) {
    const { adminApp: misconfigured } = createGatewayApps({
      adminToken: configured,
    });
    assertEquals(
      (await misconfigured.request(
        "/internal/sessions",
        request(configured ?? secret),
      )).status,
      401,
    );
  }
  const { adminApp } = createGatewayApps({ adminToken: secret });
  assertEquals(
    (await adminApp.request("/internal/sessions", request())).status,
    401,
  );
  assertEquals(
    (await adminApp.request("/internal/sessions", request("incorrect"))).status,
    401,
  );
  assertEquals(
    (await adminApp.request(
      "/internal/sessions",
      request("change-me-host-gateway-admin"),
    )).status,
    401,
  );
  const response = await adminApp.request(
    "/internal/sessions",
    request(secret),
  );
  assertEquals(response.status, 201);
  const { token } = await response.json();
  assertEquals(
    (await adminApp.request("/internal/sessions/revoke", request(token)))
      .status,
    401,
  );
  assertEquals(
    (await adminApp.request("/internal/sessions/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ token }),
    })).status,
    200,
  );
  clearAllSessions();
});
Deno.test("sandbox HTTP surface has no session administration even with correct admin credential", async () => {
  const { app } = createGatewayApps({ adminToken: secret });
  for (const path of ["/internal/sessions", "/internal/sessions/revoke"]) {
    assertEquals((await app.request(path, request(secret))).status, 404);
  }
});
