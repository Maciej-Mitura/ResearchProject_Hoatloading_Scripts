import { Hono } from "jsr:@hono/hono@4.6.5";
import { withClient } from "../db/client.ts";
import * as repo from "../repositories/conversations.ts";
import * as scriptRepo from "../repositories/scripts.ts";
import { ChatProviderError, type ChatProvider } from "../providers/chat.ts";
import { jsonError } from "../middleware/errors.ts";
import { getProjectContextService } from "../project/project-context-service.ts";

const ASSISTANT_UNAVAILABLE =
  "The assistant could not respond. Please try again.";

export function conversationRoutes(chat: ChatProvider) {
  const app = new Hono();

  app.get("/", async (c) => {
    const items = await withClient((client) => repo.listConversations(client));
    return c.json({ items });
  });

  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const title = typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "New conversation";
    const item = await withClient((client) => repo.createConversation(client, title));
    return c.json(item, 201);
  });

  app.get("/:id/messages", async (c) => {
    const id = c.req.param("id");
    const exists = await withClient((client) => repo.getConversation(client, id));
    if (!exists) return jsonError(c, 404, "not_found", "Conversation not found");
    const items = await withClient((client) => repo.listMessages(client, id));
    return c.json({ items });
  });

  app.post("/:id/messages", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      return jsonError(c, 400, "validation_error", "content is required");
    }

    const conv = await withClient((client) => repo.getConversation(client, id));
    if (!conv) return jsonError(c, 404, "not_found", "Conversation not found");

    const history = await withClient((client) => repo.listMessages(client, id));
    const userMsg = await withClient((client) =>
      repo.addMessage(client, id, "user", content)
    );

    // Auto-title from first message
    if (history.length === 0 && conv.title === "New conversation") {
      const title = content.slice(0, 60) + (content.length > 60 ? "…" : "");
      await withClient(async (client) => {
        await client.queryObject`
          UPDATE conversations SET title = ${title}, updated_at = now() WHERE id = ${id}
        `;
      });
    }

    // Fresh project context every turn — latest saved settings, no stale cache.
    const assistantContext = await getProjectContextService().buildChatContext();

    let result;
    try {
      result = await chat.respond({
        conversationId: id,
        userMessage: content,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        systemInstruction: assistantContext.systemInstruction,
      });
    } catch (err) {
      logChatFailure(err);
      // Preserve the user message; client may retry.
      return c.json({
        error: {
          code: "assistant_unavailable",
          message: ASSISTANT_UNAVAILABLE,
        },
        userMessage: userMsg,
        assistantMessage: null,
        proposal: null,
        savedScriptId: null,
      }, 502);
    }

    let savedScriptId: string | undefined;
    if (result.proposal && body.saveProposal === true) {
      const created = await withClient((client) =>
        scriptRepo.createScript(client, {
          name: result.proposal!.name,
          description: result.proposal!.description,
          language: result.proposal!.language,
          source: result.proposal!.source,
          status: "draft",
        })
      );
      savedScriptId = created.script.id;
    }

    const assistantMsg = await withClient((client) =>
      repo.addMessage(client, id, "assistant", result.content, {
        ...result.metadata,
        provider: chat.name,
        proposal: result.proposal ?? null,
        savedScriptId: savedScriptId ?? null,
      })
    );

    return c.json({
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      proposal: result.proposal ?? null,
      savedScriptId: savedScriptId ?? null,
    }, 201);
  });

  return app;
}

function logChatFailure(err: unknown): void {
  if (err instanceof ChatProviderError) {
    console.error("[chat] provider failure", {
      category: err.category,
      httpStatus: err.httpStatus,
      requestId: err.requestId,
      message: err.message,
      // never log API keys or Authorization headers
    });
    return;
  }
  console.error("[chat] unexpected provider failure", {
    name: err instanceof Error ? err.name : typeof err,
    // message may contain model names; avoid dumping full unknown objects
  });
}
