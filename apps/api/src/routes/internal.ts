/**
 * Internal service-to-service routes (Host Gateway → API).
 * Protected by shared HOST_GATEWAY_SERVICE_TOKEN — never exposed to sandboxes.
 */

import { Hono } from "jsr:@hono/hono@4.6.5";
import { withClient } from "../db/client.ts";
import * as riskRepo from "../repositories/risk.ts";
import { jsonError } from "../middleware/errors.ts";

import { serviceAuthorized } from "../../../../packages/contracts/src/service-auth.ts";
import { parseGatewayCommand } from "../host/provenance.ts";
import * as hostRepo from "../repositories/host.ts";
import { authorityFor } from "../repositories/capability-manifests.ts";
import { CAPABILITIES, isCapability, object, onlyKeys, validateArguments } from "../../../../packages/contracts/src/capabilities.ts";
const SERVICE_TOKEN = Deno.env.get("HOST_GATEWAY_SERVICE_TOKEN");

export function createInternalRoutes(options: {
  serviceToken?: string;
  enqueue?: (
    message: string,
    correlation: import("../host/provenance.ts").SandboxCommandCorrelation,
  ) => Promise<import("../domain/types.ts").HostCommand | null>;
} = {}) {
  const internalRoutes = new Hono();
  const serviceToken = options.serviceToken ?? SERVICE_TOKEN;
  internalRoutes.post("/host-commands", async (c) => {
    if (!serviceAuthorized(serviceToken, c.req.header("X-Internal-Token"))) {
      return jsonError(
        c,
        401,
        "unauthorized",
        "gateway service credential required",
      );
    }
    const input = parseGatewayCommand(await c.req.json().catch(() => null));
    if (!input) {
      return jsonError(
        c,
        400,
        "validation_error",
        "Invalid gateway command or caller metadata",
      );
    }
    const command = await (options.enqueue ?? ((message, correlation) =>
      withClient((client) =>
        hostRepo.enqueueSandboxBroadcast(client, message, correlation)
      )))(input.message, input.correlation);
    if (!command) {
      return jsonError(
        c,
        403,
        "untrusted_correlation",
        "Execution/trace mapping not found",
      );
    }
    return c.json(command, 201);
  });

  internalRoutes.post("/host-events", async (c) => {
    const token = c.req.header("X-Internal-Token") ?? "";
    if (!serviceAuthorized(serviceToken, token)) {
      return jsonError(c, 401, "unauthorized", "internal token required");
    }

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(c, 400, "validation_error", "JSON body required");
    }
    const events = (body as { events?: unknown }).events;
    if (!Array.isArray(events)) {
      return jsonError(c, 400, "validation_error", "events array required");
    }

    let stored = 0;
    await withClient(async (client) => {
      for (const raw of events) {
        if (!raw || typeof raw !== "object") continue;
        const ev = raw as Record<string, unknown>;
        const executionId = typeof ev.executionId === "string"
          ? ev.executionId
          : "";
        const eventType = typeof ev.eventType === "string" ? ev.eventType : "";
        // execution_id column is UUID — skip non-uuid test/probe ids.
        if (
          !executionId ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(executionId) ||
          !eventType.startsWith("host_api.")
        ) {
          continue;
        }

        await riskRepo.addSecurityEvent(client, {
          executionId,
          eventType,
          severity: eventType === "host_api.denied" ? "warning" : "info",
          message: typeof ev.reason === "string"
            ? `${eventType}: ${String(ev.capability ?? "")} (${ev.reason})`
            : `${eventType}: ${String(ev.capability ?? "")}`,
          metadata: {
            source: "host_gateway",
            capability: ev.capability ?? null,
            scriptVersionId: ev.scriptVersionId ?? null, manifestId: ev.manifestId ?? null, constraints: ev.constraints ?? null, arguments: ev.arguments ?? null, approved: ev.approved ?? null,
            callId: ev.callId ?? null,
            commandId: ev.commandId ?? null,
            reason: ev.reason ?? null,
            messagePreview: typeof ev.messagePreview === "string"
              ? ev.messagePreview.slice(0, 80)
              : null,
            timestamp: ev.timestamp ?? null,
            traceId: typeof ev.traceId === "string" ? ev.traceId : null,
          },
        });
        stored++;
      }
    });

    return c.json({ ok: true, stored });
  });

  internalRoutes.get("/capability-authority/:id", async c=>{
    if(!serviceAuthorized(serviceToken,c.req.header("X-Internal-Token"))) return jsonError(c,401,"unauthorized","Service credential required");
    const a=await withClient(client=>authorityFor(client,c.req.param("id")));
    return a ? c.json(a) : jsonError(c,403,"no_authority","No active execution approval snapshot");
  });
  internalRoutes.post("/capability-commands",async c=>{
    if(!serviceAuthorized(serviceToken,c.req.header("X-Internal-Token"))) return jsonError(c,401,"unauthorized","Service credential required");
    try {
      const b=object(await c.req.json());onlyKeys(b,["executionId","scriptVersionId","manifestId","capability","callId","traceId","args"]);
      const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if(typeof b.executionId!=="string" || !uuid.test(b.executionId) || typeof b.callId!=="string" || !uuid.test(b.callId) || typeof b.traceId!=="string" || !/^(?!0{32})[0-9a-f]{32}$/.test(b.traceId) || typeof b.capability!=="string" || !isCapability(b.capability)) throw new Error("Invalid correlation or capability");
      const id=b.capability;
      const command=await withClient(async client=>{
        const a=await authorityFor(client,b.executionId as string);
        const grant=a?.review?.approved.find(r=>r.capability===id);
        if(!a || !grant || a.id!==b.manifestId || a.scriptVersionId!==b.scriptVersionId) throw new Error("Authority mismatch");
        const args=validateArguments(id,b.args,grant.constraints);
        return hostRepo.enqueueCapabilityCommand(client,CAPABILITIES[id].command,args,{executionId:b.executionId as string,traceId:b.traceId as string,callId:b.callId as string,capability:id,manifestId:a.id,scriptVersionId:a.scriptVersionId});
      });
      return command ? c.json(command,201) : jsonError(c,403,"untrusted_correlation","Execution/trace mismatch");
    }catch {return jsonError(c,403,"capability_rejected","Capability arguments, approval or correlation rejected");}
  });
  internalRoutes.get("/capability-commands/:id",async c=>{
    if(!serviceAuthorized(serviceToken,c.req.header("X-Internal-Token"))) return jsonError(c,401,"unauthorized","Service credential required");
    const command=await withClient(client=>hostRepo.getCapabilityCommand(client,c.req.param("id"),c.req.query("executionId")??"",c.req.query("callId")??""));
    return command ? c.json(command) : jsonError(c,404,"not_found","Correlated command not found");
  });
  return internalRoutes;
}
export const internalRoutes = createInternalRoutes();
