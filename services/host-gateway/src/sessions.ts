/**
 * Execution-scoped capability sessions.
 * Opaque random tokens — capabilities come from the trusted session, never from the script body.
 */

import { CHAT_BROADCAST, DEFAULT_SESSION_TTL_MS, MAX_SESSION_TTL_MS } from "./config.ts";

export type HostCapabilityId = "chat.broadcast";

export interface HostApiEvent {
  eventType:
    | "host_api.requested"
    | "host_api.allowed"
    | "host_api.denied"
    | "host_api.queued";
  capability: string;
  executionId: string;
  callId: string;
  commandId?: string;
  reason?: string;
  messagePreview?: string;
  /** Correlation only — never used for authorization. */
  traceId?: string | null;
  source: "host_gateway";
  timestamp: string;
}

export interface CapabilitySession {
  token: string;
  executionId: string;
  /** Trusted correlation id from supervisor session create — not from sandbox. */
  traceId: string | null;
  capabilities: ReadonlySet<HostCapabilityId>;
  expiresAt: number;
  revoked: boolean;
  callCounts: Map<string, number>;
  events: HostApiEvent[];
}

const sessions = new Map<string, CapabilitySession>();

const ALLOWED_CAPS = new Set<HostCapabilityId>([CHAT_BROADCAST.capability]);

export function createSession(input: {
  executionId: string;
  capabilities: string[];
  ttlMs?: number;
  /** Trusted OTel correlation id from supervisor — optional, never auth. */
  traceId?: string | null;
}): { token: string; expiresAt: string; capabilities: string[]; traceId: string | null } {
  const executionId = input.executionId.trim();
  if (!executionId || executionId.length > 128) {
    throw new Error("invalid_execution_id");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(executionId)) {
    throw new Error("invalid_execution_id");
  }

  let traceId: string | null = null;
  if (typeof input.traceId === "string" && input.traceId.trim()) {
    const t = input.traceId.trim().toLowerCase();
    if (/^[0-9a-f]{32}$/.test(t)) {
      traceId = t;
    }
  }

  const caps: HostCapabilityId[] = [];
  for (const c of input.capabilities) {
    if (!ALLOWED_CAPS.has(c as HostCapabilityId)) {
      throw new Error(`unsupported_capability:${c}`);
    }
    caps.push(c as HostCapabilityId);
  }
  if (caps.length === 0) {
    throw new Error("no_capabilities");
  }

  let ttl = input.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  if (!Number.isFinite(ttl) || ttl <= 0) ttl = DEFAULT_SESSION_TTL_MS;
  ttl = Math.min(ttl, MAX_SESSION_TTL_MS);

  const token = crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");
  const expiresAt = Date.now() + ttl;
  sessions.set(token, {
    token,
    executionId,
    traceId,
    capabilities: new Set(caps),
    expiresAt,
    revoked: false,
    callCounts: new Map(),
    events: [],
  });

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    capabilities: caps,
    traceId,
  };
}

export function revokeSession(token: string): HostApiEvent[] {
  const session = sessions.get(token);
  if (!session) return [];
  session.revoked = true;
  const events = [...session.events];
  sessions.delete(token);
  return events;
}

export function lookupSession(token: string | null | undefined): {
  session: CapabilitySession | null;
  denial?: string;
} {
  if (!token) return { session: null, denial: "missing_token" };
  const session = sessions.get(token);
  if (!session) return { session: null, denial: "invalid_token" };
  if (session.revoked) {
    sessions.delete(token);
    return { session: null, denial: "revoked_token" };
  }
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return { session: null, denial: "expired_token" };
  }
  return { session };
}

export function recordEvent(
  session: CapabilitySession,
  event: Omit<HostApiEvent, "source" | "timestamp" | "executionId"> & {
    executionId?: string;
  },
): HostApiEvent {
  const full: HostApiEvent = {
    ...event,
    executionId: event.executionId ?? session.executionId,
    traceId: event.traceId ?? session.traceId,
    source: "host_gateway",
    timestamp: new Date().toISOString(),
  };
  session.events.push(full);
  // Cap stored events per session
  if (session.events.length > 100) {
    session.events.splice(0, session.events.length - 100);
  }
  return full;
}

export function incrementCallCount(
  session: CapabilitySession,
  capability: string,
): number {
  const next = (session.callCounts.get(capability) ?? 0) + 1;
  session.callCounts.set(capability, next);
  return next;
}

export function hasCapability(
  session: CapabilitySession,
  capability: HostCapabilityId,
): boolean {
  return session.capabilities.has(capability);
}

/** Test helper — clear all sessions. */
export function clearAllSessions(): void {
  sessions.clear();
}

export function sessionCount(): number {
  return sessions.size;
}
