/**
 * Trusted supervisor client for Host Gateway session lifecycle.
 */

import { requireServiceSecret } from "../../../packages/contracts/src/service-auth.ts";
import {
  HOST_GATEWAY_ADMIN_TOKEN,
  HOST_GATEWAY_URL,
  LIMITS,
} from "./config.ts";

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

export interface CapabilitySession {
  token: string;
  expiresAt: string;
  capabilities: string[];
}

export async function createCapabilitySession(input: {
  executionId: string;
  capabilities: string[];
  sourceSha256?: string;
  manifestMode?: boolean;
  /** Correlation only — stored on session; never authorizes capabilities. */
  traceId?: string | null;
}): Promise<CapabilitySession> {
  const ttlMs = LIMITS.timeoutMs + 30_000; // execution timeout + cleanup buffer
  const res = await fetch(`${HOST_GATEWAY_URL}/internal/sessions`, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${
        requireServiceSecret(
          "HOST_GATEWAY_ADMIN_TOKEN",
          HOST_GATEWAY_ADMIN_TOKEN,
        )
      }`,
    },
    body: JSON.stringify({
      executionId: input.executionId,
      sourceSha256: input.sourceSha256,
      manifestMode: input.manifestMode,
      capabilities: input.capabilities,
      ttlMs,
      traceId: input.traceId ?? null,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Host Gateway session create failed (HTTP ${res.status}): ${
        text.slice(0, 200)
      }`,
    );
  }
  return await res.json() as CapabilitySession;
}

export async function revokeCapabilitySession(
  token: string,
): Promise<HostApiEvent[]> {
  try {
    const res = await fetch(`${HOST_GATEWAY_URL}/internal/sessions/revoke`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${
          requireServiceSecret(
            "HOST_GATEWAY_ADMIN_TOKEN",
            HOST_GATEWAY_ADMIN_TOKEN,
          )
        }`,
      },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) throw new Error("gateway_revoke_failed");
    const body = await res.json() as { events?: HostApiEvent[] };
    return Array.isArray(body.events) ? body.events : [];
  } catch {
    throw new Error("gateway_revoke_failed");
  }
}

export async function bindCapabilitySession(token:string,executionId:string,peerIp:string):Promise<void> {
 const response=await fetch(`${HOST_GATEWAY_URL}/internal/sessions/bind`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${requireServiceSecret("HOST_GATEWAY_ADMIN_TOKEN",HOST_GATEWAY_ADMIN_TOKEN)}`},body:JSON.stringify({token,executionId,peerIp}),signal:AbortSignal.timeout(5000)});
 await response.body?.cancel();
 if(!response.ok) throw new Error("gateway_sandbox_binding_failed");
}
