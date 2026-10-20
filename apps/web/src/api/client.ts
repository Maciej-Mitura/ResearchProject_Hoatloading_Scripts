import type {
  ChatMessage,
  Conversation,
  Execution,
  ExecutionEvent,
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

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
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
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const errObj = body?.error as { message?: string } | undefined;
    const message = errObj?.message ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status, body);
  }
  return res.json() as Promise<T>;
}

export const api = {
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
    request<{ items: Conversation[] }>("/api/conversations").then((r) => r.items),

  createConversation: (title?: string) =>
    request<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  listMessages: (id: string) =>
    request<{ items: ChatMessage[] }>(`/api/conversations/${id}/messages`).then((r) => r.items),

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

  listScripts: () => request<{ items: Script[] }>("/api/scripts").then((r) => r.items),

  getScript: (id: string) =>
    request<{
      script: Script;
      currentVersion: ScriptVersion | null;
      versions: ScriptVersion[];
    }>(`/api/scripts/${id}`),

  createScript: (input: {
    name: string;
    description?: string;
    language: string;
    source: string;
    status?: string;
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

  listExecutions: () =>
    request<{ items: Execution[] }>("/api/executions").then((r) => r.items),

  getExecution: (id: string) =>
    request<{
      execution: Execution;
      events: ExecutionEvent[];
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

  hostEvents: (limit = 100) =>
    request<{ items: HostEvent[]; limit: number }>(
      `/api/host/events?limit=${encodeURIComponent(String(limit))}`,
    ).then((r) => r.items),

  enqueueHostCommand: (commandType: string, payload: Record<string, unknown>) =>
    request<unknown>("/api/host/commands", {
      method: "POST",
      body: JSON.stringify({ commandType, payload }),
    }),

  securityEvents: (executionId?: string) => {
    const q = executionId
      ? `?executionId=${encodeURIComponent(executionId)}`
      : "";
    return request<{ items: SecurityEvent[] }>(`/api/security/events${q}`).then(
      (r) => r.items,
    );
  },

  riskAssessments: () =>
    request<{ items: RiskAssessment[] }>("/api/risk-assessments").then((r) => r.items),

  executionEventSource: (id: string) =>
    new EventSource(`${API_URL}/api/executions/${id}/events`),
};

export { API_URL };
