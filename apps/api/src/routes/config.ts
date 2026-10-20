import { Hono } from "jsr:@hono/hono@4.6.5";
import type { ChatProvider } from "../providers/chat.ts";
import {
  DEFAULT_PERMISSION_PROFILE,
  PERMISSION_PROFILE_IDS,
  PERMISSION_PROFILE_META,
} from "../domain/types.ts";

/**
 * Public, non-secret configuration for the workbench UI.
 * Never include API keys or other secrets here.
 */
export function configRoutes(
  chat: ChatProvider,
  executionProvider: string = "mock",
  riskAnalyzer: string = "deterministic",
) {
  const app = new Hono();

  app.get("/public", (c) => {
    const body: {
      chatProvider: string;
      chatModel?: string;
      executionProvider: string;
      riskAnalyzer: string;
      permissionProfiles: Array<{
        id: string;
        label: string;
        description: string;
      }>;
      defaultPermissionProfile: string;
    } = {
      chatProvider: chat.name,
      executionProvider,
      riskAnalyzer,
      permissionProfiles: PERMISSION_PROFILE_IDS.map((id) => ({
        id,
        label: PERMISSION_PROFILE_META[id].label,
        description: PERMISSION_PROFILE_META[id].description,
      })),
      defaultPermissionProfile: DEFAULT_PERMISSION_PROFILE,
    };
    if (chat.name !== "mock" && chat.model) {
      body.chatModel = chat.model;
    }
    return c.json(body);
  });

  return app;
}
