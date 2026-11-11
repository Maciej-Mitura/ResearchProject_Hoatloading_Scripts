import {
  bindingSource,
  type ScriptProject,
} from "../../../packages/contracts/src/script-project.ts";
import { sourceHash } from "../../../packages/contracts/src/capabilities.ts";
/**
 * Docker job orchestration for one-shot sandbox containers.
 * Only this trusted supervisor talks to the Docker Engine.
 */

import {
  HOST_GATEWAY_NET_ALLOW,
  LIMITS,
  SANDBOX_DENO_VERSION,
  SANDBOX_DOCKER_RUNTIME,
  SANDBOX_HOST_NETWORK,
  SANDBOX_IMAGE,
} from "./config.ts";
import {
  type AuditCollection,
  collectAuditStatus,
} from "./audit-collection.ts";
import { newFrameMarker, splitFramedStdout } from "./frames.ts";
import {
  bindCapabilitySession,
  createCapabilitySession,
  type HostApiEvent,
  revokeCapabilitySession,
} from "./gateway.ts";
import { boundCombinedOutput } from "./output.ts";
import type { AllowedLanguage } from "./config.ts";
import { buildExecutionManifest, type ExecutionManifest } from "./manifest.ts";
import {
  classifyExecutionFailure,
  DEFAULT_AUDIT_LIMITS,
  DEFAULT_PERMISSION_PROFILE,
  parsePermissionAuditJsonl,
  PERMISSION_AUDIT_PATH,
  PERMISSION_PROFILE_DEFINITIONS,
  type PermissionAccessEvent,
  type PermissionProfileName,
} from "./permissions.ts";

export interface SandboxRunInput {
  executionId: string;
  language: AllowedLanguage;
  source: string;
  project?: ScriptProject;
  permissionProfile?: PermissionProfileName;
  /** Correlation only — passed to Host Gateway session; never sandbox auth. */
  traceId?: string | null;
}

export interface SandboxRunResult {
  executionId: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  outputTruncated: boolean;
  sandboxImage: string;
  containerName: string;
  error?: string;
  manifest: ExecutionManifest;
  permissionEvents: PermissionAccessEvent[];
  permissionAuditTruncated: boolean;
  auditCollection: AuditCollection;
  hostApiEvents: HostApiEvent[];
  failureCategory: string | null;
  runtimeVersion: string;
  cleanupErrors: string[];
  oomKilled?: boolean;
}

function containerNameFor(executionId: string): string {
  return `poc-exec-${executionId}`.slice(0, 63);
}

function buildDockerArgs(
  name: string,
  language: AllowedLanguage,
  frameMarker: string,
  permissionProfile: PermissionProfileName,
  extraEnv: Record<string, string>,
): string[] {
  const profile = PERMISSION_PROFILE_DEFINITIONS[permissionProfile];
  const network = profile.dockerNetwork === "sandbox-host"
    ? SANDBOX_HOST_NETWORK
    : "none";

  const args = [
    "run",
    "--rm",
    "-i",
    "--name",
    name,
    "--network",
    network,
    "--read-only",
    "--log-driver=none",
    "--user",
    "deno",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges:true",
    "--pids-limit",
    String(LIMITS.pidsLimit),
    "--cpus",
    String(LIMITS.cpus),
    "--memory",
    String(LIMITS.memory),
    "--memory-swap",
    String(LIMITS.memory),
    "--tmpfs",
    `/workspace:rw,size=${LIMITS.workspaceTmpfsSize},mode=1777`,
    "--tmpfs",
    `/tmp:rw,size=${LIMITS.tmpTmpfsSize},mode=1777`,
    "-e",
    `SCRIPT_LANGUAGE=${language}`,
    "-e",
    "DENO_DIR=/workspace/.deno",
    "-e",
    `PERMISSION_PROFILE=${profile.id}`,
    "-e",
    `DENO_AUDIT_PERMISSIONS=${PERMISSION_AUDIT_PATH}`,
    "-e",
    `SANDBOX_DENO_VERSION=${SANDBOX_DENO_VERSION}`,
    "-e",
    `POC_FRAME_MARKER=${frameMarker}`,
    "-e",
    `HOST_GATEWAY_NET_ALLOW=${HOST_GATEWAY_NET_ALLOW}`,
    // Intentionally no BRIDGE_TOKEN, API keys, DATABASE_URL, admin tokens, Docker socket.
  ];

  for (const [key, value] of Object.entries(profile.envVars)) {
    args.push("-e", `${key}=${value}`);
  }
  for (const [key, value] of Object.entries(extraEnv)) {
    args.push("-e", `${key}=${value}`);
  }

  if (SANDBOX_DOCKER_RUNTIME) {
    args.push("--runtime", SANDBOX_DOCKER_RUNTIME);
  }

  args.push(SANDBOX_IMAGE);
  return args;
}

async function readBounded(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  onLimit?: () => void,
): Promise<{ text: string; truncated: boolean }> {
  if (!stream) return { text: "", truncated: false };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total >= maxBytes) {
      if (!truncated) onLimit?.();
      truncated = true;
      continue;
    }
    const remaining = maxBytes - total;
    if (value.byteLength > remaining) {
      chunks.push(value.slice(0, remaining));
      total += remaining;
      if (!truncated) onLimit?.();
      truncated = true;
    } else {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return { text: new TextDecoder().decode(merged), truncated };
}

export const OPERATION_MS = 5000;
import { deadline } from "../../../packages/contracts/src/deadline.ts";
import { admission } from "./admission.ts";

async function dockerCommand(args: string[], timeoutMs = OPERATION_MS) {
  // Kill and reap the CLI before returning a timeout. Racing output() alone
  // leaves pipe readers/process handles alive and can falsely quarantine capacity.
  const child = new Deno.Command("docker", {
    args,
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      child.kill("SIGKILL");
    } catch { /* exited */ }
  }, timeoutMs);
  try {
    const output = await child.output();
    if (timedOut) throw new Error("docker_operation_timeout");
    return output;
  } finally {
    clearTimeout(timer);
  }
}

export async function runSandboxContainer(
  input: SandboxRunInput,
): Promise<SandboxRunResult> {
  return await admission.run(input.executionId, () => executeSandbox(input));
}

export interface SandboxDependencies {
  command?: typeof dockerCommand;
  spawn?: () => Deno.ChildProcess;
  createSession?: typeof createCapabilitySession;
  revokeSession?: typeof revokeCapabilitySession;
  timeoutMs?: number;
}
export async function executeSandbox(
  input: SandboxRunInput,
  dependencies: SandboxDependencies = {},
): Promise<SandboxRunResult> {
  const command = (args: string[]) =>
    dependencies.command
      ? deadline(
        OPERATION_MS,
        "docker_operation_timeout",
        () => dependencies.command!(args),
      )
      : dockerCommand(args);
  const createSession = dependencies.createSession ?? createCapabilitySession;
  const revokeSession = dependencies.revokeSession ?? revokeCapabilitySession;
  const started = Date.now();
  const permissionProfile = input.permissionProfile ??
    DEFAULT_PERMISSION_PROFILE;
  // Runner owns uniqueness; caller IDs never determine the name of an existing job.
  const name = containerNameFor(crypto.randomUUID());
  const marker = newFrameMarker();
  let token: string | null = null;
  let child: Deno.ChildProcess | undefined;
  let childDrained: Promise<unknown> | undefined;
  let containerAttempted = false;
  const cleanupErrors: string[] = [];
  const result: SandboxRunResult = {
    executionId: input.executionId,
    exitCode: null,
    stdout: "",
    stderr: "",
    durationMs: 0,
    timedOut: false,
    outputTruncated: false,
    sandboxImage: SANDBOX_IMAGE,
    containerName: name,
    manifest: buildExecutionManifest({ permissionProfile }),
    permissionEvents: [],
    permissionAuditTruncated: false,
    auditCollection: {
      version: 1,
      status: "unavailable",
      reasons: ["execution_not_observed"],
    },
    hostApiEvents: [],
    failureCategory: null,
    runtimeVersion: SANDBOX_DENO_VERSION,
    cleanupErrors,
  };
  let stage = "gateway_admin";
  try {
    const extra: Record<string, string> = input.project
      ? { SCRIPT_PROJECT: "1" }
      : {};
    if (
      permissionProfile === "host-capabilities" ||
      PERMISSION_PROFILE_DEFINITIONS[permissionProfile].hostCapabilities.length
    ) {
      const session = await deadline(
        OPERATION_MS,
        "gateway_admin_timeout",
        async () =>
          createSession({
            executionId: input.executionId,
            manifestMode: permissionProfile === "host-capabilities",
            sourceSha256: await sourceHash(
              bindingSource(input.source, input.project),
            ),
            traceId: input.traceId,
            capabilities: [
              ...PERMISSION_PROFILE_DEFINITIONS[permissionProfile]
                .hostCapabilities,
            ],
          }),
      );
      token = session.token;
      extra.HOST_CAPABILITY_TOKEN = permissionProfile === "host-capabilities"
        ? `${input.executionId}:${token}`
        : token;
    }
    stage = "docker_create";
    const args = buildDockerArgs(
      name,
      input.language,
      marker,
      permissionProfile,
      extra,
    );
    args[0] = "create";
    args.splice(args.indexOf("--rm"), 1);
    containerAttempted = true; // Docker may create even if its acknowledgement is lost.
    const created = await command(args);
    if (!created.success) throw new Error("docker_create_failed");
    stage = "docker_start_wait";
    child = dependencies.spawn
      ? dependencies.spawn()
      : new Deno.Command("docker", {
        args: ["start", "-ai", name],
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
      }).spawn();
    const process = child;
    let signalOutputLimit: (() => void) | undefined;
    const outputLimit = new Promise<never>((_, reject) => {
      signalOutputLimit = () => reject(new Error("output_limit"));
    });
    // Attach a handler before source transfer can produce output.
    outputLimit.catch(() => {});
    const stdoutP = readBounded(
      process.stdout,
      LIMITS.maxOutputBytes + DEFAULT_AUDIT_LIMITS.maxBytes + 4096,
      signalOutputLimit,
    );
    const stderrP = readBounded(
      process.stderr,
      LIMITS.maxOutputBytes,
      signalOutputLimit,
    );
    childDrained = Promise.allSettled([process.status, stdoutP, stderrP]);
    if (permissionProfile === "host-capabilities") {
      // entrypoint is waiting for stdin EOF. Bind before any source is sent.
      let peerIp = "";
      const until = Date.now() + 1500;
      do {
        const address = await command([
          "inspect",
          "--format",
          "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
          name,
        ]);
        if (address.success) {
          peerIp = new TextDecoder().decode(address.stdout).trim();
        }
        if (!peerIp) await new Promise((resolve) => setTimeout(resolve, 50));
      } while (!peerIp && Date.now() < until);
      if (!peerIp) throw new Error("sandbox_address_unavailable");
      await bindCapabilitySession(token!, input.executionId, peerIp);
    }
    const writer = process.stdin.getWriter();
    const writeP = (async () => {
      try {
        await writer.write(
          new TextEncoder().encode(
            input.project ? JSON.stringify(input.project) : input.source,
          ),
        );
      } finally {
        try {
          await writer.close();
        } catch { /* process exited */ }
      }
    })();
    // Includes source transfer and attached start/wait. A stalled Docker attach is not proof of script timeout.
    let observed;
    try {
      observed = await deadline(
        dependencies.timeoutMs ?? LIMITS.timeoutMs,
        "job_wall_timeout",
        async () => {
          const [status, stdout, stderr] = await Promise.race([
            Promise.all([process.status, stdoutP, stderrP, writeP]),
            outputLimit,
          ]);
          return { status, stdout, stderr };
        },
      );
    } catch (err) {
      if (
        err instanceof Error &&
        ["job_wall_timeout", "output_limit"].includes(err.message)
      ) {
        if (err.message === "job_wall_timeout") {
          const state = await command([
            "inspect",
            "--format",
            "{{.State.Running}}",
            name,
          ]);
          if (
            !state.success ||
            new TextDecoder().decode(state.stdout).trim() !== "true"
          ) throw new Error("docker_wait_timeout");
        }
        result.timedOut = err.message === "job_wall_timeout";
        // Stop the workload before disconnecting its attach stream. Otherwise a
        // flooding process can keep the daemon's output path busy during removal.
        const stopped = await command(["kill", "--signal", "KILL", name]);
        if (!stopped.success) {
          const state = await command([
            "inspect",
            "--format",
            "{{.State.Running}}",
            name,
          ]);
          if (
            state.success &&
            new TextDecoder().decode(state.stdout).trim() === "true"
          ) throw new Error("container_stop_unconfirmed");
        }
        try {
          process.kill("SIGKILL");
        } catch { /* stopped */ }
        const partial = await deadline(
          OPERATION_MS,
          "capture_timeout",
          async () => {
            const [stdout, stderr] = await Promise.all([stdoutP, stderrP]);
            return { stdout, stderr };
          },
        );
        const bounded = boundCombinedOutput(
          partial.stdout.text,
          partial.stderr.text,
          LIMITS.maxOutputBytes,
        );
        result.stdout = bounded.stdout;
        result.stderr = bounded.stderr;
        result.outputTruncated = bounded.outputTruncated ||
          partial.stdout.truncated || partial.stderr.truncated;
        result.outputTruncated ||= err.message === "output_limit";
        result.failureCategory = result.timedOut ? "timeout" : "output_limit";
        result.auditCollection = {
          version: 1,
          status: "unavailable",
          reasons: [err.message, "missing_audit_frame"],
        };
      } else throw err;
    }
    if (observed) {
      const framed = splitFramedStdout(observed.stdout.text, marker);
      const bounded = boundCombinedOutput(
        framed.scriptStdout,
        observed.stderr.text,
        LIMITS.maxOutputBytes,
      );
      const audit = parsePermissionAuditJsonl(
        framed.auditJsonl,
        DEFAULT_AUDIT_LIMITS,
      );
      result.stdout = bounded.stdout;
      result.stderr = bounded.stderr;
      result.exitCode = observed.status.code;
      result.outputTruncated = bounded.outputTruncated ||
        observed.stdout.truncated || observed.stderr.truncated;
      result.permissionEvents = audit.events;
      result.permissionAuditTruncated = audit.truncated;
      result.manifest = buildExecutionManifest({
        permissionProfile,
        observedRuntimeVersion: framed.runtimeVersionText,
      });
      result.runtimeVersion = result.manifest.runtimeVersion;
      const inspected = await command([
        "inspect",
        "--format",
        "{{.State.OOMKilled}}",
        name,
      ]);
      if (!inspected.success) throw new Error("docker_inspect_failed");
      result.oomKilled =
        new TextDecoder().decode(inspected.stdout).trim() === "true";
      result.failureCategory = result.oomKilled
        ? "memory_limit"
        : classifyExecutionFailure({
          timedOut: false,
          exitCode: result.exitCode,
          stderr: result.stderr,
        });
      if ([125, 126, 127].includes(result.exitCode)) {
        throw new Error("docker_start_failed");
      }
      result.auditCollection = collectAuditStatus({
        frame: framed.auditFrame,
        timedOut: false,
        outputTruncated: result.outputTruncated,
        auditTruncated: audit.truncated,
        malformedCount: audit.malformedCount,
        terminated: result.oomKilled || !!observed.status.signal,
      });
    }
  } catch (err) {
    result.error = `Supervisor failure at ${stage}`;
    if (
      stage === "docker_create" && err instanceof Error &&
      /timeout/.test(err.message)
    ) {
      admission.blocked = true;
      cleanupErrors.push("create_deadline_state_uncertain");
    }
    result.failureCategory = err instanceof Error && /timeout/.test(err.message)
      ? (stage === "gateway_admin"
        ? "gateway_admin_timeout"
        : "docker_operation_timeout")
      : "supervisor_error";
    result.auditCollection = {
      version: 1,
      status: "unavailable",
      reasons: [result.failureCategory, stage],
    };
  } finally {
    if (child) {
      try {
        child.kill("SIGKILL");
      } catch { /* already exited */ }
    }
    if (containerAttempted) {
      try {
        const removed = dependencies.command
          ? await command(["rm", "-f", name])
          : await dockerCommand(["rm", "-f", name], 10000);
        if (!removed.success) {
          const absent = await command(["inspect", name]);
          if (!new TextDecoder().decode(absent.stderr).includes("No such")) {
            throw new Error("remove_not_confirmed");
          }
        }
      } catch {
        cleanupErrors.push("container_removal_unconfirmed");
        admission.blocked = true;
      }
    }
    if (child) {
      try {
        await child.stdin.abort();
      } catch { /* writer already closed */ }
      if (childDrained) {
        try {
          await deadline(
            OPERATION_MS,
            "attach_cleanup_timeout",
            () => childDrained!,
          );
        } catch {
          cleanupErrors.push("attach_cleanup_unconfirmed");
        }
      }
    }
    if (token) {
      try {
        result.hostApiEvents = await deadline(
          OPERATION_MS,
          "gateway_revoke_timeout",
          () => revokeSession(token!),
        );
      } catch {
        cleanupErrors.push("session_revocation_unconfirmed_ttl_fallback");
      }
    }
    if (token) {
      result.stdout = result.stdout.replaceAll(
        token,
        "[execution credential redacted]",
      );
      result.stderr = result.stderr.replaceAll(
        token,
        "[execution credential redacted]",
      );
    }
    result.durationMs = Date.now() - started;
  }
  return result;
}

export async function dockerAvailable(): Promise<boolean> {
  try {
    const cmd = new Deno.Command("docker", {
      args: ["version", "--format", "{{.Server.Version}}"],
      signal: AbortSignal.timeout(5000),
      stdout: "piped",
      stderr: "piped",
    });
    const out = await cmd.output();
    return out.success;
  } catch {
    return false;
  }
}
