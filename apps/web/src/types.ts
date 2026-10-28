export type PermissionProfileId =
  | "none"
  | "read-fixture"
  | "env-demo"
  | "host-chat";

export interface PermissionProfileOption {
  id: PermissionProfileId;
  label: string;
  description: string;
}

export interface PublicConfig {
  chatProvider: string;
  chatModel?: string;
  executionProvider?: string;
  permissionProfiles?: PermissionProfileOption[];
  defaultPermissionProfile?: PermissionProfileId;
}

export interface DenoPermissionsGrant {
  read: string[];
  env: string[];
  net: string[];
  run: string[];
  write: string[];
  ffi: string[];
}

export interface ExecutionManifest {
  runtime: "deno";
  runtimeVersion: string;
  executionProvider: "docker" | "mock";
  permissionProfile: string;
  denoPermissions?: DenoPermissionsGrant;
  hostCapabilities?: string[];
  dockerNetwork?: string;
  networkMode?: string;
  dockerRuntime?: string;
  cpuLimit?: number;
  memoryLimitMb?: number;
  pidsLimit?: number;
  timeoutMs?: number;
  outputLimitBytes?: number;
  rootFilesystemReadOnly?: boolean;
  sandboxImage?: string;
}

export interface HostApiEvent {
  eventType: string;
  capability: string;
  executionId: string;
  callId: string;
  commandId?: string;
  reason?: string;
  messagePreview?: string;
  source: "host_gateway";
  timestamp: string;
}

export interface PermissionAccessEvent {
  event: "permission.accessed";
  permission: string;
  target: string | null;
  datetime?: string;
  auditVersion?: number;
  source: "deno_permission_audit";
}

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
  failureCategory?: string | null;
  runtimeVersion?: string | null;
  /** Trusted OTel correlation id — not authorization. */
  traceId?: string | null;
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
  conversationId?: string | null;
  sourceMessageId?: string | null;
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
  result: ExecutionResult | null;
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
  classification: "low" | "review" | "high" | "medium" | null;
  score: number;
  confidence: number | null;
  reasons: string[];
  provider: string;
  analyzerVersion?: string | null;
  latencyMs?: number | null;
  evidenceSchemaVersion?: number | null;
  assessmentStatus?: string;
  failureKind?: string | null;
  providerMetadata?: Record<string, unknown>;
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
  | "server_broadcast"
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
