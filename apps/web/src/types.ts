export interface PublicConfig {
  chatProvider: string;
  chatModel?: string;
}

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

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ScriptProposal {
  name: string;
  description: string;
  language: string;
  source: string;
}

export interface Script {
  id: string;
  name: string;
  description: string | null;
  language: string;
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
  language: string;
  changelog: string | null;
  createdAt: string;
}

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

export interface RiskAssessment {
  id: string;
  scriptVersionId: string;
  executionId: string | null;
  classification: "low" | "medium" | "high";
  score: number;
  confidence: number;
  reasons: string[];
  provider: string;
  createdAt: string;
}

export interface SecurityEvent {
  id: string;
  executionId: string | null;
  eventType: string;
  severity: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface HostConnection {
  id: string;
  pluginVersion: string;
  serverVersion: string | null;
  onlinePlayers: number;
  lastHeartbeatAt: string;
  connectedAt: string;
  metadata: Record<string, unknown>;
}

export interface HostStatusResponse {
  connected: boolean;
  connection: HostConnection | null;
  pendingCommands: number;
}

/** Host observability events from SecureBridge (not OTEL/script telemetry). */
export type HostEventType =
  | "plugin_started"
  | "heartbeat"
  | "player_join"
  | "player_leave"
  | "player_chat"
  | "player_command"
  | "command_result";

export interface HostEvent {
  id: string;
  connectionId: string | null;
  eventType: HostEventType | string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ValidationIssue {
  path?: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ProjectSettingsField {
  path: string;
  category: string;
  type: string;
  label: string;
  description?: string;
  editable: boolean;
  values?: string[];
  value: unknown;
  source: "base" | "override";
  risky?: boolean;
}

export interface ContextPreview {
  game: string;
  server: string;
  runtime: string;
  preferredLanguage: string;
  network: string;
  filesystem: string;
  hostCapabilities: string[];
  hostStatus: string;
  reportedGameVersion: string | null;
  versionMismatch: boolean;
  enforcement: string;
  warnings: string[];
}

export interface ProjectSettingsResponse {
  base: Record<string, unknown>;
  overrides: Record<string, unknown>;
  effective: Record<string, unknown>;
  fields: ProjectSettingsField[];
  issues: ValidationIssue[];
  hostState: Record<string, unknown>;
  preview: ContextPreview;
}
