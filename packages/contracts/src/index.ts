/**
 * Shared application protocol types.
 * Wire format version: 1
 *
 * These types are the source of truth for API/UI contracts.
 * The Paper bridge uses equivalent JSON schemas under packages/contracts/schemas/.
 */

export const CONTRACT_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Script domain
// ---------------------------------------------------------------------------

export type ScriptLanguage = "javascript" | "typescript" | (string & {});

export type ScriptStatus = "draft" | "ready" | "disabled";

export type ExecutionStatus =
  | "queued"
  | "validating"
  | "analysing"
  | "running"
  | "completed"
  | "blocked"
  | "failed"
  | "terminated";

export type RiskClassification = "low" | "medium" | "high";

export interface Script {
  id: string;
  name: string;
  description: string | null;
  language: ScriptLanguage;
  status: ScriptStatus;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptVersion {
  id: string;
  scriptId: string;
  versionNumber: number;
  source: string;
  language: ScriptLanguage;
  createdAt: string;
  changelog: string | null;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface Execution {
  id: string;
  scriptId: string;
  scriptVersionId: string;
  status: ExecutionStatus;
  riskAssessmentId: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionEvent {
  id: string;
  executionId: string;
  status: ExecutionStatus;
  message: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Risk / security (advisory only — NEVER an authorization authority)
// ---------------------------------------------------------------------------

export interface RiskAssessment {
  id: string;
  scriptVersionId: string;
  executionId: string | null;
  classification: RiskClassification;
  score: number;
  confidence: number;
  reasons: string[];
  provider: string;
  createdAt: string;
}

export type SecurityEventSeverity = "info" | "warning" | "error" | "critical";

export interface SecurityEvent {
  id: string;
  executionId: string | null;
  eventType: string;
  severity: SecurityEventSeverity;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export type MessageRole = "user" | "assistant" | "system";

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ScriptProposal {
  name: string;
  description: string;
  language: ScriptLanguage;
  source: string;
}

// ---------------------------------------------------------------------------
// Host bridge (versioned wire protocol)
// ---------------------------------------------------------------------------

export type HostCommandType =
  | "broadcast_message"
  | "request_status"
  | "request_player_list";

export type HostEventType =
  | "plugin_started"
  | "heartbeat"
  | "player_join"
  | "player_leave"
  | "player_chat"
  | "player_command"
  | "command_result";

/** Allowed host observability event types (SecureBridge → platform). */
export const HOST_EVENT_TYPES = [
  "plugin_started",
  "heartbeat",
  "player_join",
  "player_leave",
  "player_chat",
  "player_command",
  "command_result",
] as const satisfies readonly HostEventType[];

export interface HostConnection {
  id: string;
  pluginVersion: string;
  serverVersion: string | null;
  onlinePlayers: number;
  lastHeartbeatAt: string;
  connectedAt: string;
  metadata: Record<string, unknown>;
}

export interface HostEvent {
  id: string;
  connectionId: string | null;
  eventType: HostEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface HostCommand {
  id: string;
  commandType: HostCommandType;
  payload: Record<string, unknown>;
  status: "pending" | "delivered" | "completed" | "failed" | "rejected";
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface HostCommandResult {
  commandId: string;
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

/** Bridge → platform registration/heartbeat body */
export interface BridgeHeartbeatRequest {
  protocolVersion: typeof CONTRACT_VERSION;
  pluginVersion: string;
  serverVersion: string;
  onlinePlayers: number;
  maxPlayers: number;
  motd?: string;
}

/** Bridge → platform event submission */
export interface BridgeHostEventRequest {
  protocolVersion: typeof CONTRACT_VERSION;
  eventType: HostEventType;
  payload: Record<string, unknown>;
}

/** Platform → bridge pending commands poll response */
export interface BridgePendingCommandsResponse {
  protocolVersion: typeof CONTRACT_VERSION;
  commands: Array<{
    id: string;
    commandType: HostCommandType;
    payload: Record<string, unknown>;
  }>;
}

/** Bridge → platform command result */
export interface BridgeCommandResultRequest {
  protocolVersion: typeof CONTRACT_VERSION;
  commandId: string;
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface HostStatusResponse {
  connected: boolean;
  connection: HostConnection | null;
  pendingCommands: number;
}
