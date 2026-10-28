import type { PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import type {
  HostCommand,
  HostCommandType,
  HostConnection,
  HostEvent,
} from "../domain/types.ts";

function mapConnection(r: Record<string, unknown>): HostConnection {
  return {
    id: String(r.id),
    pluginVersion: String(r.plugin_version),
    serverVersion: r.server_version == null ? null : String(r.server_version),
    onlinePlayers: Number(r.online_players),
    lastHeartbeatAt: new Date(r.last_heartbeat_at as string).toISOString(),
    connectedAt: new Date(r.connected_at as string).toISOString(),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  };
}

function mapEvent(r: Record<string, unknown>): HostEvent {
  return {
    id: String(r.id),
    connectionId: r.connection_id == null ? null : String(r.connection_id),
    eventType: r.event_type as HostEvent["eventType"],
    payload: (r.payload as Record<string, unknown>) ?? {},
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

function mapCommand(r: Record<string, unknown>): HostCommand {
  return {
    id: String(r.id),
    commandType: r.command_type as HostCommandType,
    payload: (r.payload as Record<string, unknown>) ?? {},
    status: r.status as HostCommand["status"],
    result: (r.result as Record<string, unknown>) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

/** Keep a single "active" connection row for the local PoC. */
export async function upsertHeartbeat(
  client: PoolClient,
  input: {
    pluginVersion: string;
    serverVersion: string;
    onlinePlayers: number;
    metadata?: Record<string, unknown>;
  },
): Promise<HostConnection> {
  const existing = await client.queryObject`
    SELECT * FROM host_connections ORDER BY last_heartbeat_at DESC LIMIT 1
  `;

  if (existing.rows[0]) {
    const id = String((existing.rows[0] as Record<string, unknown>).id);
    const metadataJson = JSON.stringify(input.metadata ?? {});
    const res = await client.queryObject`
      UPDATE host_connections SET
        plugin_version = ${input.pluginVersion},
        server_version = ${input.serverVersion},
        online_players = ${input.onlinePlayers},
        last_heartbeat_at = now(),
        metadata = ${metadataJson}::jsonb
      WHERE id = ${id}
      RETURNING *
    `;
    return mapConnection(res.rows[0] as Record<string, unknown>);
  }

  const metadataJson = JSON.stringify(input.metadata ?? {});
  const res = await client.queryObject`
    INSERT INTO host_connections (plugin_version, server_version, online_players, metadata)
    VALUES (
      ${input.pluginVersion},
      ${input.serverVersion},
      ${input.onlinePlayers},
      ${metadataJson}::jsonb
    )
    RETURNING *
  `;
  return mapConnection(res.rows[0] as Record<string, unknown>);
}

export async function getLatestConnection(
  client: PoolClient,
): Promise<HostConnection | null> {
  const res = await client.queryObject`
    SELECT * FROM host_connections ORDER BY last_heartbeat_at DESC LIMIT 1
  `;
  if (!res.rows[0]) return null;
  return mapConnection(res.rows[0] as Record<string, unknown>);
}

export async function addHostEvent(
  client: PoolClient,
  connectionId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<HostEvent> {
  const payloadJson = JSON.stringify(payload ?? {});
  const res = await client.queryObject`
    INSERT INTO host_events (connection_id, event_type, payload)
    VALUES (${connectionId}, ${eventType}, ${payloadJson}::jsonb)
    RETURNING *
  `;
  return mapEvent(res.rows[0] as Record<string, unknown>);
}

export async function enqueueHostCommand(
  client: PoolClient,
  commandType: HostCommandType,
  payload: Record<string, unknown>,
): Promise<HostCommand> {
  const payloadJson = JSON.stringify(payload ?? {});
  const res = await client.queryObject`
    INSERT INTO host_commands (command_type, payload, status)
    VALUES (${commandType}, ${payloadJson}::jsonb, 'pending')
    RETURNING *
  `;
  return mapCommand(res.rows[0] as Record<string, unknown>);
}

export async function claimPendingCommands(
  client: PoolClient,
  limit = 10,
): Promise<HostCommand[]> {
  const res = await client.queryObject`
    UPDATE host_commands
    SET status = 'delivered', updated_at = now()
    WHERE id IN (
      SELECT id FROM host_commands
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
  return res.rows.map((r) => mapCommand(r as Record<string, unknown>));
}

export async function completeHostCommand(
  client: PoolClient,
  commandId: string,
  success: boolean,
  message: string,
  data?: Record<string, unknown>,
): Promise<HostCommand | null> {
  const status = success ? "completed" : "failed";
  const resultJson = JSON.stringify({ success, message, data: data ?? {} });
  const res = await client.queryObject`
    UPDATE host_commands
    SET status = ${status}, result = ${resultJson}::jsonb, updated_at = now()
    WHERE id = ${commandId}
    RETURNING *
  `;
  if (!res.rows[0]) return null;
  return mapCommand(res.rows[0] as Record<string, unknown>);
}

export async function countPendingCommands(client: PoolClient): Promise<number> {
  const res = await client.queryObject<{ count: number }>`
    SELECT COUNT(*)::int AS count FROM host_commands WHERE status = 'pending'
  `;
  return res.rows[0]?.count ?? 0;
}

const DEFAULT_EVENT_LIMIT = 100;
const MAX_EVENT_LIMIT = 200;

export function clampHostEventLimit(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_EVENT_LIMIT;
  return Math.min(Math.floor(n), MAX_EVENT_LIMIT);
}

/** Recent host observability events, newest first. */
export async function listHostEvents(
  client: PoolClient,
  limit: number = DEFAULT_EVENT_LIMIT,
  filter: string = "",
): Promise<HostEvent[]> {
  const capped = clampHostEventLimit(limit);
  const res = await client.queryObject`
    WITH activity AS (
      SELECT e.id, e.connection_id, e.created_at,
        CASE WHEN e.event_type = 'command_result' AND c.command_type = 'broadcast_message'
          AND e.payload->>'success' = 'true' THEN 'server_broadcast'
          ELSE e.event_type END AS event_type,
        e.payload || CASE WHEN c.command_type = 'broadcast_message'
          THEN jsonb_build_object('commandType', c.command_type, 'broadcastMessage', c.payload->>'message')
          ELSE '{}'::jsonb END AS payload
      FROM host_events e
      LEFT JOIN host_commands c ON e.event_type = 'command_result' AND c.id::text = e.payload->>'commandId'
    )
    SELECT * FROM activity
    WHERE ${filter} = ''
      OR (${filter} = 'all' AND event_type <> 'heartbeat')
      OR (${filter} = 'chat' AND event_type IN ('player_chat', 'server_broadcast'))
      OR (${filter} = 'players' AND event_type IN ('player_join', 'player_leave'))
      OR (${filter} = 'commands' AND event_type IN ('player_command', 'command_result', 'server_broadcast'))
      OR (${filter} = 'system' AND event_type IN ('plugin_started', 'heartbeat', 'command_result'))
    ORDER BY created_at DESC, id DESC LIMIT ${capped}
  `;
  return res.rows.map((r) => mapEvent(r as Record<string, unknown>));
}
