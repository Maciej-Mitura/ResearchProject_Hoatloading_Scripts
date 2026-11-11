import { CAPABILITIES, isCapability } from "../../../packages/contracts/src/capabilities.ts";
/**
 * Trusted Host Gateway.
 *
 * Sandbox-facing: narrow capability endpoints authenticated by execution-scoped tokens.
 * Supervisor-facing: session create/revoke with admin token.
 *
 * Deno --allow-net to this service is TRANSPORT only — this process decides
 * whether chat.broadcast is authorized for the session.
 */

import { Hono } from "jsr:@hono/hono@4.6.5";
import {
  enqueueBroadcastMessage as apiEnqueue,
  postSecurityEvents as apiPostEvents,
} from "./api-client.ts";
import {
  ADMIN_BIND_HOST,
  ADMIN_PORT,
  ADMIN_TOKEN,
  CHAT_BROADCAST,
  INTERNAL_SERVICE_TOKEN,
  PORT,
} from "./config.ts";
import {
  createSession,
  hasCapability,
  type HostApiEvent,
  incrementCallCount,
  lookupSession,
  recordEvent,
  revokeSession,
} from "./sessions.ts";
import { messagePreview, validateChatBroadcastBody } from "./validate.ts";

import {
  requireServiceSecret,
  serviceAuthorized,
} from "../../../packages/contracts/src/service-auth.ts";

import { fetchAuthority } from "./api-client.ts";
import { manifestCalls } from "./manifest-calls.ts";

export function createGatewayApps(options: {
  adminToken?: string;
  enqueue?: typeof apiEnqueue;
  postEvents?: typeof apiPostEvents;
  authority?: typeof fetchAuthority;
  command?: typeof import("./api-client.ts").capabilityCommand;
} = {}) {
  const adminToken = Object.hasOwn(options, "adminToken")
    ? options.adminToken
    : ADMIN_TOKEN;
  const enqueueBroadcastMessage = options.enqueue ?? apiEnqueue;
  const postSecurityEvents = options.postEvents ?? apiPostEvents;
  const app = new Hono<{Bindings:{peerIp?:string}}>();
  const adminApp = new Hono();

  function bearerToken(header: string | undefined): string | null {
    if (!header) return null;
    const m = /^Bearer\s+(.+)$/i.exec(header.trim());
    return m ? m[1].trim() : null;
  }

  function requireAdmin(
    c: { req: { header: (n: string) => string | undefined } },
  ): boolean {
    const token = bearerToken(c.req.header("Authorization")) ??
      c.req.header("X-Admin-Token");
    return serviceAuthorized(adminToken, token);
  }

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "host-gateway",
      capabilities: Object.keys(CAPABILITIES),
      warning:
        "Transport reachability does not grant authority. Registered capabilities are authorized per execution-scoped session.",
    }));

  /** Supervisor: create execution-scoped capability session. */
  adminApp.post("/internal/sessions", async (c) => {
    if (!requireAdmin(c)) {
      return c.json({
        error: { code: "unauthorized", message: "admin required" },
      }, 401);
    }
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({
        error: { code: "validation_error", message: "JSON body required" },
      }, 400);
    }
    const record = body as Record<string, unknown>;
    try {
      const authority = record.manifestMode === true ? await (options.authority ?? fetchAuthority)(String(record.executionId ?? "")) : undefined;
      if(authority && (authority.sourceSha256 !== record.sourceSha256 || authority.executionId !== record.executionId)) throw new Error("source_or_execution_mismatch");
      const created = createSession({
        authority,
        executionId: String(record.executionId ?? ""),
        capabilities: authority ? authority.review?.approved.map(r=>r.capability) ?? [] : Array.isArray(record.capabilities)
          ? record.capabilities.map(String)
          : [],
        ttlMs: typeof record.ttlMs === "number" ? record.ttlMs : undefined,
        // Correlation only — admin/supervisor supplied; never from sandbox body.
        traceId: typeof record.traceId === "string" ? record.traceId : null,
      });
      return c.json(created, 201);
    } catch (err) {
      return c.json(
        { error: { code: "validation_error", message: String(err) } },
        400,
      );
    }
  });

  /** Supervisor: revoke session and return collected host API events. */
  adminApp.post("/internal/sessions/revoke", async (c) => {
    if (!requireAdmin(c)) {
      return c.json({
        error: { code: "unauthorized", message: "admin required" },
      }, 401);
    }
    const body = await c.req.json().catch(() => null);
    const token = body && typeof body === "object"
      ? String((body as { token?: unknown }).token ?? "")
      : "";
    const events = revokeSession(token);
    return c.json({ revoked: true, events });
  });

  // A manifest credential is unusable until the trusted supervisor binds the
  // Docker-observed sandbox address. Sandbox headers never supply this address.
  adminApp.post("/internal/sessions/bind",async c=>{
    if(!requireAdmin(c)) return c.json({error:{code:"unauthorized"}},401);
    const b=await c.req.json().catch(()=>null);
    const session=lookupSession(b?.token).session;
    if(!session?.authority || session.peerIp || session.executionId!==b?.executionId || typeof b?.peerIp!=="string" || !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(b.peerIp)) return c.json({error:{code:"invalid_binding"}},403);
    session.peerIp=b.peerIp;
    return c.json({bound:true});
  });

  /**
   * Sandbox-facing capability endpoint — only chat.broadcast.
   * Authorization is derived from the session token, not the request body,
   * and not from any traceparent / traceId the sandbox may forge.
   */
  const manifestApp=manifestCalls(postSecurityEvents,options.command);
  app.use("/v1/capabilities/*", async (c,next)=>{
    const token=bearerToken(c.req.header("Authorization"));
    if(lookupSession(token).session?.authority || (c.req.path.split("/").pop()!=="chat.broadcast" && isCapability(c.req.path.split("/").pop()??""))) {
      const url=new URL(c.req.url);url.pathname="/"+url.pathname.split("/").pop();
      return await manifestApp.fetch(new Request(url,c.req.raw),c.env);
    }
    await next();
  });
  app.post("/v1/capabilities/chat.broadcast", async (c) => {
    const callId = crypto.randomUUID();
    const token = bearerToken(c.req.header("Authorization")) ??
      c.req.header("X-Capability-Token");
    // Intentionally ignore sandbox-supplied traceparent for authorization.
    // Correlation uses the trusted session.traceId from supervisor create.
    void c.req.header("traceparent");
    const { session, denial } = lookupSession(token);

    if (!session) {
      return c.json(
        {
          accepted: false,
          error: {
            code: "unauthorized",
            message: "capability credential rejected",
            denial: denial ?? "invalid_token",
          },
        },
        401,
      );
    }

    const requested = recordEvent(session, {
      eventType: "host_api.requested",
      capability: CHAT_BROADCAST.capability,
      callId,
    });
    await postSecurityEvents([requested]);

    if (!hasCapability(session, CHAT_BROADCAST.capability)) {
      const denied = recordEvent(session, {
        eventType: "host_api.denied",
        capability: CHAT_BROADCAST.capability,
        callId,
        reason: "capability_not_granted",
      });
      await postSecurityEvents([denied]);
      return c.json(
        {
          accepted: false,
          error: { code: "forbidden", message: "capability not granted" },
        },
        403,
      );
    }

    const body = await c.req.json().catch(() => null);
    const validated = validateChatBroadcastBody(body);
    if (!validated.ok) {
      const denied = recordEvent(session, {
        eventType: "host_api.denied",
        capability: CHAT_BROADCAST.capability,
        callId,
        reason: validated.reason,
      });
      await postSecurityEvents([denied]);
      return c.json(
        {
          accepted: false,
          error: { code: "validation_error", message: validated.reason },
        },
        400,
      );
    }

    if(validated.value.message.includes(session.token)) {
      await postSecurityEvents([recordEvent(session,{eventType:"host_api.denied",capability:CHAT_BROADCAST.capability,callId,reason:"credential_in_arguments"})]);
      return c.json({accepted:false,error:{code:"validation_error",message:"Execution credentials cannot be sent as messages"}},400);
    }
    const count = incrementCallCount(session, CHAT_BROADCAST.capability);
    if (count > CHAT_BROADCAST.maxCallsPerExecution) {
      const denied = recordEvent(session, {
        eventType: "host_api.denied",
        capability: CHAT_BROADCAST.capability,
        callId,
        reason: "budget_exhausted",
        messagePreview: messagePreview(validated.value.message),
      });
      await postSecurityEvents([denied]);
      return c.json(
        {
          accepted: false,
          error: {
            code: "budget_exhausted",
            message:
              `chat.broadcast budget exceeded (max ${CHAT_BROADCAST.maxCallsPerExecution} per execution)`,
          },
        },
        429,
      );
    }

    const allowed = recordEvent(session, {
      eventType: "host_api.allowed",
      capability: CHAT_BROADCAST.capability,
      callId,
      messagePreview: messagePreview(validated.value.message),
    });
    await postSecurityEvents([allowed]);

    const enqueued = await enqueueBroadcastMessage(validated.value.message, {
      executionId: session.executionId,
      callId,
      traceId: session.traceId,
      // Trusted correlation toward API only — built from session, not sandbox header.
      traceparent: session.traceId
        ? `00-${session.traceId}-${callId.replace(/-/g, "").slice(0, 16)}-01`
        : null,
    });
    if (!enqueued.ok || !enqueued.commandId) {
      const denied = recordEvent(session, {
        eventType: "host_api.denied",
        capability: CHAT_BROADCAST.capability,
        callId,
        reason: enqueued.error ?? "enqueue_failed",
      });
      await postSecurityEvents([denied]);
      return c.json(
        {
          accepted: false,
          error: {
            code: "enqueue_failed",
            message: "failed to queue host command",
          },
        },
        502,
      );
    }

    const queued = recordEvent(session, {
      eventType: "host_api.queued",
      capability: CHAT_BROADCAST.capability,
      callId,
      commandId: enqueued.commandId,
      messagePreview: messagePreview(validated.value.message),
    });
    await postSecurityEvents([queued]);

    // Queued/accepted — not proof the message was displayed in Minecraft yet.
    return c.json({
      accepted: true,
      commandId: enqueued.commandId,
      callId,
      capability: CHAT_BROADCAST.capability,
      executionId: session.executionId,
    });
  });

  /** Reject unknown capability paths explicitly (no dynamic dispatch). */
  app.all("/v1/capabilities/*", (c) => {
    return c.json(
      {
        accepted: false,
        error: {
          code: "unknown_capability",
          message: "capability not available",
        },
      },
      404,
    );
  });

  // Intentionally no /executeCommand, no arbitrary proxy, no Docker.

  return { app, adminApp };
}

export const { app, adminApp } = createGatewayApps();
export type { HostApiEvent };

if (import.meta.main) {
  requireServiceSecret("HOST_GATEWAY_ADMIN_TOKEN", ADMIN_TOKEN);
  requireServiceSecret("HOST_GATEWAY_SERVICE_TOKEN", INTERNAL_SERVICE_TOKEN);
  if (ADMIN_TOKEN === INTERNAL_SERVICE_TOKEN) {
    throw new Error("Admin and service secrets must be independent");
  }
  const addresses = await Deno.resolveDns(ADMIN_BIND_HOST, "A");
  if (addresses.length !== 1 || addresses[0] === "0.0.0.0") {
    throw new Error("Admin alias must resolve to one app-network IPv4 address");
  }
  Deno.serve({ port: ADMIN_PORT, hostname: addresses[0] }, adminApp.fetch);
  console.log(
    `[host-gateway] listening on :${PORT} capability=${CHAT_BROADCAST.capability}` +
      ` budget=${CHAT_BROADCAST.maxCallsPerExecution}`,
  );
  Deno.serve({ port: PORT, hostname: "0.0.0.0" }, (req,info)=>app.fetch(req,{peerIp:info.remoteAddr.hostname}));
}
