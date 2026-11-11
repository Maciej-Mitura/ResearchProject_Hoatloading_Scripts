import { Hono } from "jsr:@hono/hono@4.6.5";
import {
  CAPABILITIES,
  isCapability,
  validateArguments,
} from "../../../packages/contracts/src/capabilities.ts";
import {
  type HostApiEvent,
  incrementCallCount,
  lookupSession,
  recordEvent,
} from "./sessions.ts";
import { capabilityCommand } from "./api-client.ts";
/** Only registry IDs reach an explicit typed queue command. No caller-selected method. */
export function manifestCalls(
  postEvents: (events: HostApiEvent[]) => Promise<void>,
  command = capabilityCommand,
) {
  const app = new Hono<{ Bindings: { peerIp?: string } }>();
  app.post("/:capability", async (c) => {
    const token = /^Bearer\s+(.+)$/i.exec(c.req.header("Authorization") ?? "")
      ?.[1];
    const { session } = lookupSession(token);
    if (!session?.authority) {
      return c.json({
        accepted: false,
        error: {
          code: "CAPABILITY_NOT_APPROVED",
          message: "Manifest session required",
        },
      }, 401);
    }
    const id = c.req.param("capability"), callId = crypto.randomUUID();
    const grant = session.authority.review?.approved.find((r) =>
      r.capability === id
    );
    const base = {
      capability: id,
      callId,
      constraints: grant?.constraints,
      approved: !!grant,
    };
    const event = async (
      eventType: HostApiEvent["eventType"],
      reason?: string,
      args?: unknown,
      commandId?: string,
    ) =>
      await postEvents([
        recordEvent(session, {
          ...base,
          eventType,
          reason,
          arguments: args,
          commandId,
        }),
      ]);
    await event("host_api.requested");
    const deny = async (
      code: string,
      status: 400 | 403 | 404 | 429,
      message: string,
    ) => {
      await event("host_api.denied", code);
      return c.json(
        { accepted: false, callId, error: { code, message } },
        status,
      );
    };
    if (
      !session.peerIp || c.env?.peerIp !== session.peerIp ||
      c.req.header("X-Execution-Id") !== session.executionId
    ) {
      return await deny(
        "CAPABILITY_EXECUTION_MISMATCH",
        403,
        "Credential does not belong to this sandbox execution",
      );
    }
    if (!isCapability(id)) {
      return await deny(
        "CAPABILITY_NOT_SUPPORTED",
        404,
        "Capability not registered",
      );
    }
    if (!grant || !session.capabilities.has(id)) {
      return await deny(
        "CAPABILITY_NOT_APPROVED",
        403,
        "Capability was not approved for this version",
      );
    }
    let args: Record<string, unknown>;
    try {
      args = validateArguments(id, await c.req.json(), grant.constraints);
    } catch {
      return await deny(
        "CAPABILITY_ARGUMENT_NOT_ALLOWED",
        400,
        "Arguments exceed registered or approved constraints",
      );
    }
    if (JSON.stringify(args).includes(session.token)) {
      return await deny(
        "CAPABILITY_ARGUMENT_NOT_ALLOWED",
        400,
        "Execution credentials cannot be sent as capability arguments",
      );
    }
    const total = incrementCallCount(session, "__total");
    if (
      total > 12 ||
      incrementCallCount(session, id) >
        Math.min(grant.constraints.maxCalls, CAPABILITIES[id].maxCalls)
    ) {
      return await deny(
        "CAPABILITY_QUOTA_EXCEEDED",
        429,
        "Execution capability quota exceeded",
      );
    }
    // Arguments deliberately contain only the strict, bounded capability schema.
    await event("host_api.allowed", undefined, args);
    try {
      const result = await command({
        executionId: session.executionId,
        scriptVersionId: session.authority.scriptVersionId,
        manifestId: session.authority.id,
        capability: id,
        callId,
        traceId: session.traceId,
        args,
      });
      await event("host_api.queued", undefined, undefined, result.commandId);
      return c.json({ ...result, callId, capability: id });
    } catch {
      await event("host_api.denied", "CAPABILITY_HOST_UNAVAILABLE");
      return c.json({
        accepted: false,
        callId,
        error: {
          code: "CAPABILITY_HOST_UNAVAILABLE",
          message: "Host command could not be confirmed",
        },
      }, 502);
    }
  });
  return app;
}
