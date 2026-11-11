import type {
  ChatMessage,
  Conversation,
  Execution,
  ExecutionEvent,
  ExecutionHistoryItem,
  HostEvent,
  HostStatusResponse,
  ProjectSettingsResponse,
  PublicConfig,
  RiskAssessment,
  Script,
  ScriptProposal,
  ScriptVersion,
  SecurityEvent,
} from "../types";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const errObj = body?.error as { message?: string } | undefined;
    const message = errObj?.message ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status, body);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getManifest: (scriptId: string, versionId: string) =>
    request<
      {
        manifest:
          | import("../../../../packages/contracts/src/capabilities").CapabilityManifest
          | null;
        legacy: boolean;
      }
    >(`/api/scripts/${scriptId}/versions/${versionId}/manifest`),
  reviewManifest: (
    scriptId: string,
    versionId: string,
    manifestId: string,
    selected: string[],
  ) =>
    request<
      {
        manifest:
          import("../../../../packages/contracts/src/capabilities").CapabilityManifest;
      }
    >(`/api/scripts/${scriptId}/versions/${versionId}/manifest/reviews`, {
      method: "POST",
      body: JSON.stringify({ manifestId, selected }),
    }),
  health: () => request<{ status: string }>("/health"),

  publicConfig: () => request<PublicConfig>("/api/config/public"),

  getProjectSettings: () =>
    request<ProjectSettingsResponse>("/api/project/settings"),

  patchProjectSettings: (patch: Record<string, unknown>) =>
    request<ProjectSettingsResponse>("/api/project/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  resetProjectSettings: () =>
    request<ProjectSettingsResponse>("/api/project/settings/reset", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  projectContextPreview: () =>
    request<{ preview: ProjectSettingsResponse["preview"] }>(
      "/api/project/settings/context-preview",
    ),

  listConversations: () =>
    request<{ items: Conversation[] }>("/api/conversations").then(
      (r) => r.items,
    ),

  createConversation: (title?: string) =>
    request<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  listMessages: (id: string) =>
    request<{ items: ChatMessage[] }>(`/api/conversations/${id}/messages`).then(
      (r) => r.items,
    ),

  sendMessage: (id: string, content: string, saveProposal = false) =>
    request<{
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      proposal: ScriptProposal | null;
      savedScriptId: string | null;
    }>(`/api/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, saveProposal }),
    }),

  listScripts: () =>
    request<{ items: Script[] }>("/api/scripts").then((r) => r.items),

  getScript: (id: string) =>
    request<{
      script: Script;
      currentVersion: ScriptVersion | null;
      versions: ScriptVersion[];
    }>(`/api/scripts/${id}`),

  createScript: (input: {
    conversationId?: string;
    sourceMessageId?: string;
    name: string;
    description?: string;
    language: string;
    source: string;
    project?:
      import("../../../../packages/contracts/src/script-project").ScriptProject;
    status?: string;
    requestedCapabilities?:
      import("../../../../packages/contracts/src/capabilities").CapabilityRequest[];
  }) =>
    request<{ script: Script; version: ScriptVersion }>("/api/scripts", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  patchScript: (id: string, patch: Partial<Script>) =>
    request<Script>(`/api/scripts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  saveScriptVersion: (
    id: string,
    source: string,
    language: string,
    project?:
      import("../../../../packages/contracts/src/script-project").ScriptProject,
  ) =>
    request<ScriptVersion>(`/api/scripts/${id}/versions`, {
      method: "POST",
      body: JSON.stringify({
        source,
        project,
        language,
        changelog: "Saved from workbench editor",
      }),
    }),

  executionHistory: (scriptId: string, signal?: AbortSignal) =>
    request<{ items: ExecutionHistoryItem[]; total: number; limit: number }>(
      `/api/executions/history?scriptId=${
        encodeURIComponent(scriptId)
      }&limit=100`,
      { signal },
    ),

  executionPeriod: (params: Record<string, string>, signal?: AbortSignal) =>
    request<
      {
        items: Array<ExecutionHistoryItem & { scriptName: string }>;
        total: number;
        limit: number;
        offset: number;
        summary: {
          low?: number;
          review?: number;
          high?: number;
          completed: number;
          failed: number;
          terminated: number;
          averageDurationMs: number | null;
          completeEvidence: number;
        };
      }
    >(`/api/executions/period?${new URLSearchParams(params)}`, { signal }),
  capabilityRegistry: () =>
    request<
      typeof import("../../../../packages/contracts/src/capabilities").CAPABILITIES
    >("/api/scripts/capabilities/registry"),
  listExecutions: () =>
    request<{ items: Execution[] }>("/api/executions").then((r) => r.items),

  getExecution: (id: string) =>
    request<{
      execution: Execution;
      events: ExecutionEvent[];
      securityEvents?: SecurityEvent[];
      timeline?: Array<{
        at: string;
        kind: string;
        label: string;
        detail?: string;
        source: string;
      }>;
      traceId?: string | null;
    }>(`/api/executions/${id}`),

  startExecution: (
    scriptId: string,
    opts?: { scriptVersionId?: string; permissionProfile?: string },
  ) =>
    request<Execution>("/api/executions", {
      method: "POST",
      body: JSON.stringify({
        scriptId,
        scriptVersionId: opts?.scriptVersionId,
        permissionProfile: opts?.permissionProfile,
      }),
    }),

  hostStatus: () => request<HostStatusResponse>("/api/host/status"),

  hostEvents: (limit = 100, filter = "") =>
    request<{ items: HostEvent[]; limit: number }>(
      `/api/host/events?limit=${encodeURIComponent(String(limit))}&filter=${
        encodeURIComponent(filter)
      }`,
    ).then((r) => r.items),

  securityEvents: (executionId?: string) => {
    const q = executionId
      ? `?executionId=${encodeURIComponent(executionId)}`
      : "";
    return request<{ items: SecurityEvent[] }>(`/api/security/events${q}`).then(
      (r) => r.items,
    );
  },

  riskAssessments: (executionId?: string) =>
    request<{ items: RiskAssessment[] }>(
      `/api/risk-assessments${
        executionId ? `?executionId=${encodeURIComponent(executionId)}` : ""
      }`,
    ).then((r) => r.items),

  executionEventSource: (id: string) =>
    new EventSource(`${API_URL}/api/executions/${id}/events`),
};

export { API_URL };
