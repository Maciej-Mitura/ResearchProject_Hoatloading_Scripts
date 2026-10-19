import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { configRoutes } from "../src/routes/config.ts";
import { MockChatProvider } from "../src/providers/chat.ts";
import type { ChatProvider } from "../src/providers/chat.ts";

Deno.test("public config for mock never exposes secrets", async () => {
  const app = configRoutes(new MockChatProvider());
  const res = await app.request("http://localhost/public");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.chatProvider, "mock");
  assertEquals(body.chatModel, undefined);
  assertEquals("OPENAI_API_KEY" in body, false);
  assertEquals("GEMINI_API_KEY" in body, false);
  assertEquals("apiKey" in body, false);
  assertEquals(JSON.stringify(body).includes("sk-"), false);
  assertEquals(JSON.stringify(body).includes("AIza"), false);
});

Deno.test("public config for gemini includes model only", async () => {
  const geminiLike: ChatProvider = {
    name: "gemini",
    model: "gemini-3.8-flash",
    respond: () => Promise.resolve({ content: "x" }),
  };
  const app = configRoutes(geminiLike);
  const res = await app.request("http://localhost/public");
  const body = await res.json();
  assertEquals(body, { chatProvider: "gemini", chatModel: "gemini-3.8-flash" });
  assertEquals(Object.keys(body).sort(), ["chatModel", "chatProvider"]);
});
