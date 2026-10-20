/**
 * Execution/sandbox manifest — single source of truth derived from supervisor config.
 */

import {
  HOST_GATEWAY_NET_ALLOW,
  HOST_GATEWAY_SANDBOX_URL,
  LIMITS,
  SANDBOX_DENO_VERSION,
  SANDBOX_DOCKER_RUNTIME,
  SANDBOX_HOST_NETWORK,
  SANDBOX_IMAGE,
} from "./config.ts";
import {
  DEFAULT_PERMISSION_PROFILE,
  PERMISSION_AUDIT_PATH,
  PERMISSION_PROFILE_DEFINITIONS,
  type DenoPermissionsGrant,
  type DockerNetworkMode,
  type PermissionProfileName,
} from "./permissions.ts";

export interface ExecutionManifest {
  runtime: "deno";
  runtimeVersion: string;
  executionProvider: "docker";
  permissionProfile: PermissionProfileName;
  /** Derived from the same trusted profile definition used to launch Deno. */
  denoPermissions: DenoPermissionsGrant;
  /** Host capabilities authorized via Host Gateway (distinct from Deno perms). */
  hostCapabilities: string[];
  dockerNetwork: DockerNetworkMode;
  sandboxHostNetworkName?: string;
  hostGatewayNetAllow?: string;
  hostGatewayUrl?: string;
  dockerRuntime: string;
  networkMode: DockerNetworkMode;
  cpuLimit: number;
  memoryLimitMb: number;
  pidsLimit: number;
  timeoutMs: number;
  outputLimitBytes: number;
  rootFilesystemReadOnly: true;
  sandboxImage: string;
  permissionAuditEnabled: true;
  permissionAuditPath: string;
}

export function parseMemoryLimitMb(memory: string): number {
  const m = memory.trim().toLowerCase();
  const num = parseFloat(m);
  if (!Number.isFinite(num)) return 256;
  if (m.endsWith("g")) return Math.round(num * 1024);
  if (m.endsWith("m")) return Math.round(num);
  if (m.endsWith("k")) return Math.max(1, Math.round(num / 1024));
  return Math.round(num);
}

export function buildExecutionManifest(opts?: {
  observedRuntimeVersion?: string | null;
  permissionProfile?: PermissionProfileName;
}): ExecutionManifest {
  const observed = opts?.observedRuntimeVersion?.trim();
  let runtimeVersion = SANDBOX_DENO_VERSION;
  if (observed) {
    const match = observed.match(/deno\s+(\d+\.\d+\.\d+)/i);
    if (match) runtimeVersion = match[1];
  }

  const permissionProfile = opts?.permissionProfile ?? DEFAULT_PERMISSION_PROFILE;
  const def = PERMISSION_PROFILE_DEFINITIONS[permissionProfile];

  const manifest: ExecutionManifest = {
    runtime: "deno",
    runtimeVersion,
    executionProvider: "docker",
    permissionProfile,
    denoPermissions: {
      read: [...def.denoPermissions.read],
      env: [...def.denoPermissions.env],
      net: [...def.denoPermissions.net],
      run: [...def.denoPermissions.run],
      write: [...def.denoPermissions.write],
      ffi: [...def.denoPermissions.ffi],
    },
    hostCapabilities: [...def.hostCapabilities],
    dockerNetwork: def.dockerNetwork,
    dockerRuntime: SANDBOX_DOCKER_RUNTIME || "runc",
    networkMode: def.dockerNetwork,
    cpuLimit: Number(LIMITS.cpus),
    memoryLimitMb: parseMemoryLimitMb(LIMITS.memory),
    pidsLimit: Number(LIMITS.pidsLimit),
    timeoutMs: LIMITS.timeoutMs,
    outputLimitBytes: LIMITS.maxOutputBytes,
    rootFilesystemReadOnly: true,
    sandboxImage: SANDBOX_IMAGE,
    permissionAuditEnabled: true,
    permissionAuditPath: PERMISSION_AUDIT_PATH,
  };

  if (def.dockerNetwork === "sandbox-host") {
    manifest.sandboxHostNetworkName = SANDBOX_HOST_NETWORK;
    manifest.hostGatewayNetAllow = HOST_GATEWAY_NET_ALLOW;
    manifest.hostGatewayUrl = HOST_GATEWAY_SANDBOX_URL;
  }

  return manifest;
}
