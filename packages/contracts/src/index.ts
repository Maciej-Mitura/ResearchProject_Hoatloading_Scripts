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

/** Advisory research categories — not malice labels. */
export type RiskClassification = "low" | "review" | "high";
/** @deprecated use "review" — kept for reading legacy rows */
export type LegacyRiskClassification = "medium";

export interface Script {
  conversationId?: string | null;
  sourceMessageId?: string | null;
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

/** Evidence provenance for security observations. */
export type SecurityEvidenceSource =
  | "deno_permission_audit"
  | "supervisor"
  | "host_gateway"
  | "host_bridge"
  | "application"
  | "mock";

/**
 * Trusted permission profile IDs selectable by clients.
 * Mapping to Deno --allow-* flags is owned by the execution supervisor only.
 */
export const PERMISSION_PROFILE_IDS = [
  "none",
  "read-fixture",
  "env-demo",
  "host-chat",
] as const;

export type PermissionProfileId = (typeof PERMISSION_PROFILE_IDS)[number];

export const DEFAULT_PERMISSION_PROFILE: PermissionProfileId = "none";

/** UI labels/descriptions — factual, not "safe"/"secure" marketing language. */
export const PERMISSION_PROFILE_META: Record<
  PermissionProfileId,
  { label: string; description: string }
> = {
  none: {
    label: "No permissions",
    description:
      "Deno receives no filesystem, network, environment, subprocess or FFI permissions.",
  },
  "read-fixture": {
    label: "Read test fixture",
    description:
      "Configured Deno permissions: read /fixtures only (baked-in test file). Not general filesystem access.",
  },
  "env-demo": {
    label: "Demo environment variable",
    description:
      "Configured Deno permissions: env SANDBOX_DEMO_VALUE only. Application secrets are not injected.",
  },
  "host-chat": {
    label: "Chat broadcast",
    description:
      "Host capability chat.broadcast via Host Gateway. Deno may reach only the gateway; authority is enforced by the gateway, not by network access alone.",
  },
};

export function isPermissionProfileId(
  value: string,
): value is PermissionProfileId {
  return (PERMISSION_PROFILE_IDS as readonly string[]).includes(value);
}

/** Granted Deno capabilities recorded on the execution manifest. */
export interface DenoPermissionsGrant {
  read: string[];
  env: string[];
  net: string[];
  run: string[];
  write: string[];
  ffi: string[];
}

/** Reproducible sandbox configuration snapshot (derived from supervisor config). */
export interface ExecutionManifest {
  runtime: "deno";
  runtimeVersion: string;
  executionProvider: "docker" | "mock";
  permissionProfile: string;
  /** Derived from the trusted profile definition used to launch Deno. */
  denoPermissions?: DenoPermissionsGrant;
  /** Host capabilities via Host Gateway (distinct from Deno permissions). */
  hostCapabilities?: string[];
  dockerNetwork?: string;
  sandboxHostNetworkName?: string;
  hostGatewayNetAllow?: string;
  hostGatewayUrl?: string;
  dockerRuntime?: string;
  networkMode?: string;
  cpuLimit?: number;
  memoryLimitMb?: number;
  pidsLimit?: number;
  timeoutMs?: number;
  outputLimitBytes?: number;
  rootFilesystemReadOnly?: boolean;
  sandboxImage?: string;
  permissionAuditEnabled?: boolean;
  permissionAuditPath?: string;
}

/** Structured host API evidence from the trusted Host Gateway. */
export interface HostApiEvent {
  eventType:
    | "host_api.requested"
    | "host_api.allowed"
    | "host_api.denied"
    | "host_api.queued"
    | string;
  capability: string;
  executionId: string;
  callId: string;
  commandId?: string;
  reason?: string;
  messagePreview?: string;
  source: "host_gateway";
  timestamp: string;
}

/**
 * Neutral permission observation from Deno's native audit JSONL.
 * This records ACCESS/CHECK — not allow/deny outcome.
 */
export interface PermissionAccessEvent {
  event: "permission.accessed";
  permission: string;
  target: string | null;
  datetime?: string;
  auditVersion?: number;
  source: "deno_permission_audit";
}

/** Persisted outcome of a script run (mock or docker). Stored in executions.result JSONB. */
export interface ExecutionResult {
  provider: "mock" | "docker";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  outputTruncated: boolean;
  sandboxImage?: string | null;
  manifest?: ExecutionManifest | null;
  permissionEvents?: PermissionAccessEvent[];
  permissionAuditTruncated?: boolean;
  hostApiEvents?: HostApiEvent[];
  /** e.g. deno_permission | timeout | process_nonzero_exit | supervisor_error */
  failureCategory?: string | null;
  runtimeVersion?: string | null;
  /** Trusted OTel trace id (correlation only — not authorization). */
  traceId?: string | null;
}

export interface Execution {
  id: string;
  scriptId: string;
  scriptVersionId: string;
  status: ExecutionStatus;
  riskAssessmentId: string | null;
  errorMessage: string | null;
  /** Real or mock run outcome; null until the running step finishes. */
  result: ExecutionResult | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Narrow supervisor wire contract (API → trusted execution supervisor). */
export interface SupervisorExecuteRequest {
  executionId: string;
  language: "javascript" | "typescript";
  source: string;
  /** Trusted profile ID only — never raw Deno flags or paths. */
  permissionProfile?: PermissionProfileId;
}

export interface SupervisorExecuteResponse {
  executionId: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  outputTruncated: boolean;
  sandboxImage?: string;
  status?: "completed" | "failed" | "terminated";
  error?: string | null;
  manifest?: ExecutionManifest;
  permissionEvents?: PermissionAccessEvent[];
  permissionAuditTruncated?: boolean;
  hostApiEvents?: HostApiEvent[];
  failureCategory?: string | null;
  runtimeVersion?: string;
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
  /** Null when assessment_status is failed/unavailable (provider failure). */
  classification: RiskClassification | null;
  score: number;
  /** Null when provider did not return confidence, or on failure. */
  confidence: number | null;
  reasons: string[];
  provider: string;
  analyzerVersion?: string | null;
  latencyMs?: number | null;
  evidenceSchemaVersion?: number | null;
  /** ok | failed | unavailable */
  assessmentStatus?: string;
  failureKind?: string | null;
  providerMetadata?: Record<string, unknown>;
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
  | "server_broadcast"
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
