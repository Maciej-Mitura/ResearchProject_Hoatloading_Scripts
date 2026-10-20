/**
 * ExecutionProvider abstraction.
 *
 * Selection happens ONLY via createExecutionProvider() — do not branch on
 * EXECUTION_PROVIDER inside route handlers.
 *
 * mock  — deterministic simulated run (default; safer for local UI work)
 * docker — real Deno run inside a fresh sandbox container via supervisor
 *
 * Never silently fall back from docker → mock.
 */

import type {
  DenoPermissionsGrant,
  ExecutionResult,
  HostApiEvent,
  PermissionAccessEvent,
  PermissionProfileId,
  SupervisorExecuteResponse,
} from "../domain/types.ts";
import { DEFAULT_PERMISSION_PROFILE } from "../domain/types.ts";

export type ExecutionProviderName = "mock" | "docker";

export interface ExecutionRunInput {
  executionId: string;
  language: string;
  source: string;
  permissionProfile?: PermissionProfileId;
  /** Trusted W3C traceparent — correlation only, never authorization. */
  traceparent?: string | null;
  traceId?: string | null;
}

export interface ExecutionProvider {
  readonly name: ExecutionProviderName;
  run(input: ExecutionRunInput): Promise<ExecutionResult>;
}

const STEP_DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function emptyGrants(): DenoPermissionsGrant {
  return { read: [], env: [], net: [], run: [], write: [], ffi: [] };
}

/** API-side mirror of supervisor grants for mock manifests (no Deno flags here). */
function mockGrantsFor(profile: PermissionProfileId): DenoPermissionsGrant {
  switch (profile) {
    case "read-fixture":
      return { ...emptyGrants(), read: ["/fixtures"] };
    case "env-demo":
      return { ...emptyGrants(), env: ["SANDBOX_DEMO_VALUE"] };
    case "host-chat":
      return {
        ...emptyGrants(),
        read: ["/trusted/host"],
        env: ["HOST_GATEWAY_URL", "HOST_CAPABILITY_TOKEN"],
        net: ["host-gateway:3200"],
      };
    case "none":
    default:
      return emptyGrants();
  }
}

function mockHostCapabilities(profile: PermissionProfileId): string[] {
  return profile === "host-chat" ? ["chat.broadcast"] : [];
}

function dockerFailure(message: string, partial?: Partial<ExecutionResult>): ExecutionResult {
  return {
    provider: "docker",
    exitCode: null,
    stdout: "",
    stderr: message,
    durationMs: 0,
    timedOut: false,
    outputTruncated: false,
    sandboxImage: null,
    permissionEvents: [],
    permissionAuditTruncated: false,
    hostApiEvents: [],
    failureCategory: "supervisor_error",
    manifest: null,
    runtimeVersion: null,
    ...partial,
  };
}

/** Simulated run — does not execute source. Kept for explicit mock mode. */
export class MockExecutionProvider implements ExecutionProvider {
  readonly name: ExecutionProviderName = "mock";

  async run(input: ExecutionRunInput): Promise<ExecutionResult> {
    await sleep(STEP_DELAY_MS);
    const profile = input.permissionProfile ?? DEFAULT_PERMISSION_PROFILE;
    const forceFail = input.source.includes("FAIL_DEMO");
    if (forceFail) {
      return {
        provider: "mock",
        exitCode: 1,
        stdout: "",
        stderr: "Mock failure: FAIL_DEMO",
        durationMs: STEP_DELAY_MS,
        timedOut: false,
        outputTruncated: false,
        sandboxImage: null,
        manifest: {
          runtime: "deno",
          runtimeVersion: "mock",
          executionProvider: "mock",
          permissionProfile: profile,
          denoPermissions: mockGrantsFor(profile),
          hostCapabilities: mockHostCapabilities(profile),
        },
        permissionEvents: [],
        permissionAuditTruncated: false,
        hostApiEvents: [],
        failureCategory: "mock_failure",
        runtimeVersion: "mock",
      };
    }
    return {
      provider: "mock",
      exitCode: 0,
      stdout:
        "[mock] Script was not executed. Set EXECUTION_PROVIDER=docker for real runs.\n",
      stderr: "",
      durationMs: STEP_DELAY_MS,
      timedOut: false,
      outputTruncated: false,
      sandboxImage: null,
      manifest: {
        runtime: "deno",
        runtimeVersion: "mock",
        executionProvider: "mock",
        permissionProfile: profile,
        denoPermissions: mockGrantsFor(profile),
        hostCapabilities: mockHostCapabilities(profile),
      },
      permissionEvents: [],
      permissionAuditTruncated: false,
      hostApiEvents: [],
      failureCategory: null,
      runtimeVersion: "mock",
    };
  }
}

/**
 * Calls the trusted execution supervisor over the internal Docker network.
 * Supervisor owns image/runtime/limits/audit/Deno flags — this client only
 * sends the narrow payload (including a trusted profile ID).
 */
export class DockerExecutionProvider implements ExecutionProvider {
  readonly name: ExecutionProviderName = "docker";

  constructor(private supervisorUrl: string) {}

  async run(input: ExecutionRunInput): Promise<ExecutionResult> {
    if (input.language !== "javascript" && input.language !== "typescript") {
      return dockerFailure(
        `Unsupported language '${input.language}' (allowed: javascript, typescript)`,
      );
    }

    const permissionProfile = input.permissionProfile ?? DEFAULT_PERMISSION_PROFILE;
    const url = `${this.supervisorUrl.replace(/\/$/, "")}/execute`;
    let res: Response;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (input.traceparent) {
        headers.traceparent = input.traceparent;
      }
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          executionId: input.executionId,
          language: input.language,
          source: input.source,
          permissionProfile,
          // Correlation only — supervisor must not treat this as capability auth.
          traceId: input.traceId ?? undefined,
        }),
      });
    } catch (err) {
      return dockerFailure(
        `Execution supervisor unreachable at ${url}: ${String(err)}. ` +
          "Refusing to fall back to mock.",
      );
    }

    let body: SupervisorExecuteResponse;
    try {
      body = await res.json() as SupervisorExecuteResponse;
    } catch {
      return dockerFailure(
        `Execution supervisor returned non-JSON (HTTP ${res.status})`,
      );
    }

    const permissionEvents = normalizePermissionEvents(body.permissionEvents);
    const hostApiEvents = normalizeHostApiEvents(body.hostApiEvents);

    if (!res.ok) {
      const errField = (body as unknown as { error?: unknown }).error;
      let msg = `Execution supervisor error (HTTP ${res.status})`;
      if (typeof errField === "string" && errField) msg = errField;
      else if (
        errField &&
        typeof errField === "object" &&
        typeof (errField as { message?: unknown }).message === "string"
      ) {
        msg = (errField as { message: string }).message;
      }
      return {
        provider: "docker",
        exitCode: body.exitCode ?? null,
        stdout: body.stdout ?? "",
        stderr: body.stderr || msg,
        durationMs: body.durationMs ?? 0,
        timedOut: Boolean(body.timedOut),
        outputTruncated: Boolean(body.outputTruncated),
        sandboxImage: body.sandboxImage ?? null,
        manifest: body.manifest ?? null,
        permissionEvents,
        permissionAuditTruncated: Boolean(body.permissionAuditTruncated),
        hostApiEvents,
        failureCategory: body.failureCategory ?? "supervisor_error",
        runtimeVersion: body.runtimeVersion ?? body.manifest?.runtimeVersion ?? null,
        traceId: input.traceId ?? null,
      };
    }

    return {
      provider: "docker",
      exitCode: body.exitCode ?? null,
      stdout: body.stdout ?? "",
      stderr: body.stderr ?? (body.error ?? ""),
      durationMs: body.durationMs ?? 0,
      timedOut: Boolean(body.timedOut),
      outputTruncated: Boolean(body.outputTruncated),
      sandboxImage: body.sandboxImage ?? null,
      manifest: body.manifest ?? null,
      permissionEvents,
      permissionAuditTruncated: Boolean(body.permissionAuditTruncated),
      hostApiEvents,
      failureCategory: body.failureCategory ?? null,
      runtimeVersion: body.runtimeVersion ?? body.manifest?.runtimeVersion ?? null,
      traceId: input.traceId ?? null,
    };
  }
}

function normalizePermissionEvents(
  raw: PermissionAccessEvent[] | undefined,
): PermissionAccessEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: PermissionAccessEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    if (item.event !== "permission.accessed") continue;
    if (typeof item.permission !== "string") continue;
    out.push({
      event: "permission.accessed",
      permission: item.permission,
      target: typeof item.target === "string" ? item.target : item.target === null ? null : null,
      datetime: typeof item.datetime === "string" ? item.datetime : undefined,
      auditVersion: typeof item.auditVersion === "number" ? item.auditVersion : undefined,
      source: "deno_permission_audit",
    });
  }
  return out;
}

function normalizeHostApiEvents(raw: HostApiEvent[] | undefined): HostApiEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: HostApiEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.eventType !== "string") continue;
    if (typeof item.capability !== "string") continue;
    out.push({
      eventType: item.eventType,
      capability: item.capability,
      executionId: typeof item.executionId === "string" ? item.executionId : "",
      callId: typeof item.callId === "string" ? item.callId : "",
      commandId: typeof item.commandId === "string" ? item.commandId : undefined,
      reason: typeof item.reason === "string" ? item.reason : undefined,
      messagePreview: typeof item.messagePreview === "string"
        ? item.messagePreview.slice(0, 80)
        : undefined,
      source: "host_gateway",
      timestamp: typeof item.timestamp === "string"
        ? item.timestamp
        : new Date().toISOString(),
    });
  }
  return out;
}

export function createExecutionProvider(
  kind: string = "mock",
): ExecutionProvider {
  const normalized = kind.trim().toLowerCase();
  if (normalized === "mock" || normalized === "") {
    return new MockExecutionProvider();
  }
  if (normalized === "docker") {
    const url = Deno.env.get("EXECUTION_SUPERVISOR_URL") ??
      Deno.env.get("RUNNER_URL") ??
      "http://runner:3100";
    return new DockerExecutionProvider(url);
  }
  throw new Error(
    `Unknown EXECUTION_PROVIDER '${kind}'. Use 'mock' or 'docker'.`,
  );
}

export function mapResultToStatus(
  result: ExecutionResult,
): "completed" | "failed" | "terminated" {
  if (result.timedOut) return "terminated";
  if (result.exitCode === 0) return "completed";
  return "failed";
}
