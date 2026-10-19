import type { PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import type { ChatMessage, Conversation } from "../domain/types.ts";

function mapConversation(r: Record<string, unknown>): Conversation {
  return {
    id: String(r.id),
    title: String(r.title),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

function mapMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: String(r.id),
    conversationId: String(r.conversation_id),
    role: r.role as ChatMessage["role"],
    content: String(r.content),
    metadata: (r.metadata as Record<string, unknown>) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listConversations(client: PoolClient): Promise<Conversation[]> {
  const res = await client.queryObject`
    SELECT * FROM conversations ORDER BY updated_at DESC
  `;
  return res.rows.map((r) => mapConversation(r as Record<string, unknown>));
}

export async function createConversation(
  client: PoolClient,
  title: string,
): Promise<Conversation> {
  const res = await client.queryObject`
    INSERT INTO conversations (title) VALUES (${title})
    RETURNING *
  `;
  return mapConversation(res.rows[0] as Record<string, unknown>);
}

export async function getConversation(
  client: PoolClient,
  id: string,
): Promise<Conversation | null> {
  const res = await client.queryObject`
    SELECT * FROM conversations WHERE id = ${id}
  `;
  if (!res.rows[0]) return null;
  return mapConversation(res.rows[0] as Record<string, unknown>);
}

export async function touchConversation(client: PoolClient, id: string): Promise<void> {
  await client.queryObject`
    UPDATE conversations SET updated_at = now() WHERE id = ${id}
  `;
}

export async function listMessages(
  client: PoolClient,
  conversationId: string,
): Promise<ChatMessage[]> {
  const res = await client.queryObject`
    SELECT * FROM messages WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `;
  return res.rows.map((r) => mapMessage(r as Record<string, unknown>));
}

export async function addMessage(
  client: PoolClient,
  conversationId: string,
  role: ChatMessage["role"],
  content: string,
  metadata: Record<string, unknown> | null = null,
): Promise<ChatMessage> {
  const metadataJson = metadata == null ? null : JSON.stringify(metadata);
  const res = await client.queryObject`
    INSERT INTO messages (conversation_id, role, content, metadata)
    VALUES (
      ${conversationId},
      ${role},
      ${content},
      ${metadataJson}::jsonb
    )
    RETURNING *
  `;
  await touchConversation(client, conversationId);
  return mapMessage(res.rows[0] as Record<string, unknown>);
}
