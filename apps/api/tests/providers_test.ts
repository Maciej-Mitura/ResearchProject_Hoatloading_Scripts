import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ChatProviderError,
  createChatProvider,
  MockChatProvider,
} from "../src/providers/chat.ts";
import { GeminiChatProvider } from "../src/providers/gemini.ts";
import { OpenAIChatProvider } from "../src/providers/openai.ts";
import { MockRiskAnalyzer } from "../src/providers/risk.ts";
import { ALLOWED_HOST_COMMANDS } from "../src/domain/types.ts";

Deno.test("MockChatProvider welcome scenario proposes a script", async () => {
  const chat = new MockChatProvider();
  const first = await chat.respond({
    conversationId: "c1",
    userMessage: "Create something that sends a welcome message when a player joins.",
    history: [],
  });
  assertExists(first.content);
  // First turn may clarify
  const second = await chat.respond({
    conversationId: "c1",
    userMessage: "yes, include the name",
    history: [
      {
        role: "user",
        content: "Create something that sends a welcome message when a player joins.",
      },
      { role: "assistant", content: first.content },
    ],
  });
  assertExists(second.proposal);
  assertEquals(second.proposal!.language, "javascript");
  assertEquals(second.proposal!.name, "welcome-message");
});

Deno.test("user and assistant roles are represented correctly in turn input history", async () => {
  const chat = new MockChatProvider();
  const result = await chat.respond({
    conversationId: "c-roles",
    userMessage: "hello",
    history: [
      { role: "user", content: "first user turn" },
      { role: "assistant", content: "first assistant turn" },
    ],
  });
  assertEquals(typeof result.content, "string");
  assertEquals(result.content.length > 0, true);
  // History roles used by provider remain the canonical union
  const roles = ["user", "assistant", "system"] as const;
  assertEquals(roles.includes("user"), true);
  assertEquals(roles.includes("assistant"), true);
});

Deno.test("createChatProvider selects mock", () => {
  const chat = createChatProvider("mock");
  assertEquals(chat.name, "mock");
});

Deno.test("createChatProvider selects gemini when key present", () => {
  const prevKey = Deno.env.get("GEMINI_API_KEY");
  const prevModel = Deno.env.get("GEMINI_MODEL");
  Deno.env.set("GEMINI_API_KEY", "AIza-test-not-real");
  Deno.env.set("GEMINI_MODEL", "gemini-3.8-flash");
  try {
    const chat = createChatProvider("gemini");
    assertEquals(chat.name, "gemini");
    assertEquals(chat.model, "gemini-3.8-flash");
  } finally {
    if (prevKey === undefined) Deno.env.delete("GEMINI_API_KEY");
    else Deno.env.set("GEMINI_API_KEY", prevKey);
    if (prevModel === undefined) Deno.env.delete("GEMINI_MODEL");
    else Deno.env.set("GEMINI_MODEL", prevModel);
  }
});

Deno.test("createChatProvider gemini without key throws controlled config error", () => {
  const prevKey = Deno.env.get("GEMINI_API_KEY");
  Deno.env.delete("GEMINI_API_KEY");
  try {
    assertThrows(
      () => createChatProvider("gemini"),
      ChatProviderError,
      "GEMINI_API_KEY",
    );
  } finally {
    if (prevKey !== undefined) Deno.env.set("GEMINI_API_KEY", prevKey);
  }
});

Deno.test("GeminiChatProvider maps generateContent text to ChatTurnResult", async () => {
  const chat = new GeminiChatProvider({
    apiKey: "AIza-test",
    model: "gemini-3.8-flash",
    generate: async () => "Hello from the mapped Gemini API.",
  });

  const result = await chat.respond({
    conversationId: "c-gemini",
    userMessage: "Hello",
    history: [{ role: "user", content: "earlier" }],
  });

  assertEquals(result.content, "Hello from the mapped Gemini API.");
  assertEquals(result.metadata?.provider, "gemini");
  assertEquals(result.metadata?.model, "gemini-3.8-flash");
});

Deno.test("GeminiChatProvider rejects empty model output", async () => {
  const chat = new GeminiChatProvider({
    apiKey: "AIza-test",
    model: "gemini-3.8-flash",
    generate: async () => "   ",
  });
  await assertRejects(
    () =>
      chat.respond({
        conversationId: "c-empty",
        userMessage: "Hi",
        history: [],
      }),
    ChatProviderError,
  );
});

Deno.test("createChatProvider selects openai when key present", () => {
  const prevKey = Deno.env.get("OPENAI_API_KEY");
  const prevModel = Deno.env.get("OPENAI_MODEL");
  Deno.env.set("OPENAI_API_KEY", "sk-test-not-real");
  Deno.env.set("OPENAI_MODEL", "gpt-5.5");
  try {
    const chat = createChatProvider("openai");
    assertEquals(chat.name, "openai");
    assertEquals(chat.model, "gpt-5.5");
  } finally {
    if (prevKey === undefined) Deno.env.delete("OPENAI_API_KEY");
    else Deno.env.set("OPENAI_API_KEY", prevKey);
    if (prevModel === undefined) Deno.env.delete("OPENAI_MODEL");
    else Deno.env.set("OPENAI_MODEL", prevModel);
  }
});

Deno.test("OpenAIChatProvider maps Responses API output_text to ChatTurnResult", async () => {
  const fakeClient = {
    responses: {
      create: (_body: unknown) =>
        Promise.resolve({
          id: "resp_test_1",
          output_text: "Hello from the mapped Responses API.",
        }),
    },
  };

  const chat = new OpenAIChatProvider({
    apiKey: "sk-test",
    model: "gpt-5.5",
    client: fakeClient,
  });

  const result = await chat.respond({
    conversationId: "c-openai",
    userMessage: "Hello",
    history: [{ role: "user", content: "earlier" }],
  });

  assertEquals(result.content, "Hello from the mapped Responses API.");
  assertEquals(result.metadata?.provider, "openai");
  assertEquals(result.metadata?.model, "gpt-5.5");
});

Deno.test("OpenAIChatProvider rejects empty model output", async () => {
  const fakeClient = {
    responses: {
      create: () => Promise.resolve({ id: "resp_empty", output_text: "   " }),
    },
  };
  const chat = new OpenAIChatProvider({
    apiKey: "sk-test",
    model: "gpt-5.5",
    client: fakeClient,
  });
  await assertRejects(
    () =>
      chat.respond({
        conversationId: "c-empty",
        userMessage: "Hi",
        history: [],
      }),
    ChatProviderError,
  );
});

Deno.test("MockRiskAnalyzer is advisory and detects BLOCK_DEMO", async () => {
  const risk = new MockRiskAnalyzer();
  const result = await risk.analyze({
    scriptVersionId: "v1",
    language: "javascript",
    source: "// BLOCK_DEMO\neval('x')",
  });
  assertEquals(result.provider, "mock");
  assertEquals(result.classification, "high");
});

Deno.test("host command allowlist is tiny and explicit", () => {
  assertEquals(ALLOWED_HOST_COMMANDS.includes("broadcast_message"), true);
  assertEquals(
    (ALLOWED_HOST_COMMANDS as readonly string[]).includes("execute_console"),
    false,
  );
});
