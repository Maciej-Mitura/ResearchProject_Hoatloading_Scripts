import type { ChatMessage, ScriptProposal } from "./types";

export function newestFirst<T extends { id: string; createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
}

export function messageProposals(message: ChatMessage): ScriptProposal[] {
  if (message.role !== "assistant") return [];
  const structured = message.metadata?.proposal as ScriptProposal | undefined;
  if (structured?.source && structured.name && structured.language) return [structured];
  return Array.from(message.content.matchAll(/```(javascript|typescript|js|ts)?[ \t]*\n([\s\S]*?)```/gi))
    .filter((match) => (match[2] ?? "").trim())
    .map((match, index) => ({
      name: `script-${message.id.slice(0, 8)}-${index + 1}`,
      description: "Saved from assistant message",
      language: /^(ts|typescript)$/i.test(match[1] ?? "") ? "typescript" : "javascript",
      source: (match[2] ?? "").trim(),
    }));
}
