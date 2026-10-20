import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateChatBroadcastBody } from "../src/validate.ts";

Deno.test("accepts valid message", () => {
  const r = validateChatBroadcastBody({ message: "Hello" });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.value.message, "Hello");
});

Deno.test("rejects empty message", () => {
  const r = validateChatBroadcastBody({ message: "   " });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "message_empty");
});

Deno.test("rejects wrong type", () => {
  const r = validateChatBroadcastBody({ message: 123 });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "message_not_string");
});

Deno.test("rejects oversized message", () => {
  const r = validateChatBroadcastBody({ message: "x".repeat(300) });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "message_too_long");
});

Deno.test("rejects capability override fields from script", () => {
  const r = validateChatBroadcastBody({
    message: "hi",
    capabilities: ["chat.broadcast", "console.execute"],
  });
  assertEquals(r.ok, false);
});
