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
import { newFrameMarker, splitFramedStdout } from "./frames.ts";
import {
  createCapabilitySession,
  revokeCapabilitySession,
  type HostApiEvent,
} from "./gateway.ts";
import { boundCombinedOutput } from "./output.ts";
import type { AllowedLanguage } from "./config.ts";
import { buildExecutionManifest, type ExecutionManifest } from "./manifest.ts";
import {
  classifyExecutionFailure,
  DEFAULT_AUDIT_LIMITS,
  DEFAULT_PERMISSION_PROFILE,
  PERMISSION_AUDIT_PATH,
  PERMISSION_PROFILE_DEFINITIONS,
  parsePermissionAuditJsonl,
  type PermissionAccessEvent,
  type PermissionProfileName,
} from "./permissions.ts";

export interface SandboxRunInput {
  executionId: string;
  language: AllowedLanguage;
  source: string;
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
  hostApiEvents: HostApiEvent[];
  failureCategory: string | null;
  runtimeVersion: string;
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
      truncated = true;
      continue;
    }
    const remaining = maxBytes - total;
    if (value.byteLength > remaining) {
      chunks.push(value.slice(0, remaining));
      total += remaining;
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

async function forceRemove(name: string): Promise<void> {
  try {
    const kill = new Deno.Command("docker", {
      args: ["rm", "-f", name],
      stdout: "null",
      stderr: "null",
    });
    await kill.output();
  } catch {
    /* best-effort cleanup */
  }
}

export async function runSandboxContainer(
  input: SandboxRunInput,
): Promise<SandboxRunResult> {
  const permissionProfile = input.permissionProfile ?? DEFAULT_PERMISSION_PROFILE;
  const profile = PERMISSION_PROFILE_DEFINITIONS[permissionProfile];
  const name = containerNameFor(input.executionId);
  const frameMarker = newFrameMarker();
  const started = Date.now();
  const emptyManifest = buildExecutionManifest({ permissionProfile });

  let capabilityToken: string | null = null;
  let hostApiEvents: HostApiEvent[] = [];
  const extraEnv: Record<string, string> = {};

  if (profile.hostCapabilities.length > 0) {
    try {
      const session = await createCapabilitySession({
        executionId: input.executionId,
        capabilities: [...profile.hostCapabilities],
        traceId: input.traceId ?? null,
      });
      capabilityToken = session.token;
      extraEnv.HOST_CAPABILITY_TOKEN = session.token;
    } catch (err) {
      return {
        executionId: input.executionId,
        exitCode: null,
        stdout: "",
        stderr: "",
        durationMs: Date.now() - started,
        timedOut: false,
        outputTruncated: false,
        sandboxImage: SANDBOX_IMAGE,
        containerName: name,
        error: `Failed to create host capability session: ${String(err)}`,
        manifest: emptyManifest,
        permissionEvents: [],
        permissionAuditTruncated: false,
        hostApiEvents: [],
        failureCategory: "supervisor_error",
        runtimeVersion: SANDBOX_DENO_VERSION,
      };
    }
  }

  const args = buildDockerArgs(
    name,
    input.language,
    frameMarker,
    permissionProfile,
    extraEnv,
  );

  await forceRemove(name);

  let child: Deno.ChildProcess;
  try {
    const cmd = new Deno.Command("docker", {
      args,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });
    child = cmd.spawn();
  } catch (err) {
    if (capabilityToken) {
      hostApiEvents = await revokeCapabilitySession(capabilityToken);
    }
    return {
      executionId: input.executionId,
      exitCode: null,
      stdout: "",
      stderr: "",
      durationMs: Date.now() - started,
      timedOut: false,
      outputTruncated: false,
      sandboxImage: SANDBOX_IMAGE,
      containerName: name,
      error: `Failed to start docker: ${String(err)}`,
      manifest: emptyManifest,
      permissionEvents: [],
      permissionAuditTruncated: false,
      hostApiEvents,
      failureCategory: "supervisor_error",
      runtimeVersion: SANDBOX_DENO_VERSION,
    };
  }

  const writer = child.stdin.getWriter();
  try {
    await writer.write(new TextEncoder().encode(input.source));
  } finally {
    try {
      await writer.close();
    } catch {
      /* already closed */
    }
  }

  const captureCap = LIMITS.maxOutputBytes + DEFAULT_AUDIT_LIMITS.maxBytes + 4096;
  const stdoutP = readBounded(child.stdout, captureCap);
  const stderrP = readBounded(child.stderr, LIMITS.maxOutputBytes);

  let timedOut = false;
  let timeoutHandle: number | undefined;
  const timeoutP = new Promise<"timeout">((resolve) => {
    timeoutHandle = setTimeout(() => resolve("timeout"), LIMITS.timeoutMs);
  });
  const statusP = child.status.then((s) => ({ kind: "status" as const, s }));

  const first = await Promise.race([timeoutP, statusP]);
  if (first === "timeout") {
    timedOut = true;
    try {
      await new Deno.Command("docker", {
        args: ["kill", name],
        stdout: "null",
        stderr: "null",
      }).output();
    } catch {
      /* ignore */
    }
    try {
      child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }
  if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);

  const [status, stdoutRaw, stderrRaw] = await Promise.all([
    child.status,
    stdoutP,
    stderrP,
  ]);

  await forceRemove(name);

  if (capabilityToken) {
    hostApiEvents = await revokeCapabilitySession(capabilityToken);
  }

  const framed = splitFramedStdout(stdoutRaw.text, frameMarker);
  const bounded = boundCombinedOutput(
    framed.scriptStdout,
    stderrRaw.text,
    LIMITS.maxOutputBytes,
  );

  const audit = parsePermissionAuditJsonl(framed.auditJsonl, DEFAULT_AUDIT_LIMITS);
  const manifest = buildExecutionManifest({
    observedRuntimeVersion: framed.runtimeVersionText,
    permissionProfile,
  });
  const durationMs = Date.now() - started;
  const exitCode = timedOut ? null : (status.code ?? null);
  const failureCategory = classifyExecutionFailure({
    timedOut,
    exitCode,
    stderr: bounded.stderr,
  });

  let error: string | undefined;
  if (!timedOut && status.code === 125) {
    error =
      "Docker failed to create/start the sandbox container (exit 125). Is the sandbox image built and the daemon available?";
  } else if (!timedOut && status.code === 127) {
    error = "docker CLI not found in supervisor image";
  }

  return {
    executionId: input.executionId,
    exitCode,
    stdout: bounded.stdout,
    stderr: bounded.stderr,
    durationMs,
    timedOut,
    outputTruncated: bounded.outputTruncated || stdoutRaw.truncated ||
      stderrRaw.truncated,
    sandboxImage: SANDBOX_IMAGE,
    containerName: name,
    error,
    manifest,
    permissionEvents: audit.events,
    permissionAuditTruncated: audit.truncated,
    hostApiEvents,
    failureCategory: error ? "supervisor_error" : failureCategory,
    runtimeVersion: manifest.runtimeVersion,
  };
}

export async function dockerAvailable(): Promise<boolean> {
  try {
    const cmd = new Deno.Command("docker", {
      args: ["version", "--format", "{{.Server.Version}}"],
      stdout: "piped",
      stderr: "piped",
    });
    const out = await cmd.output();
    return out.success;
  } catch {
    return false;
  }
}
