import { Hono } from "jsr:@hono/hono@4.6.5";
import type { ChatProvider } from "../providers/chat.ts";

/**
 * Public, non-secret configuration for the workbench UI.
 * Never include API keys or other secrets here.
 */
export function configRoutes(chat: ChatProvider) {
  const app = new Hono();

  app.get("/public", (c) => {
    const body: { chatProvider: string; chatModel?: string } = {
      chatProvider: chat.name,
    };
    if (chat.name !== "mock" && chat.model) {
      body.chatModel = chat.model;
    }
    return c.json(body);
  });

  return app;
}
