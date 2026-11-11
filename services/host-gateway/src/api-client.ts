/**
 * Trusted client: Host Gateway → API host command queue.
 * Uses the existing allowlisted host command pipeline (no direct Paper access).
 */

import { API_BASE_URL, INTERNAL_SERVICE_TOKEN } from "./config.ts";
import type { HostApiEvent } from "./sessions.ts";

export interface EnqueueResult {
  ok: boolean;
  commandId?: string;
  error?: string;
}

export async function enqueueBroadcastMessage(
  message: string,
  correlation?: {
    executionId?: string;
    callId?: string;
    traceId?: string | null;
    traceparent?: string | null;
  },
): Promise<EnqueueResult> {
  const url = `${API_BASE_URL}/api/internal/host-commands`;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Token": INTERNAL_SERVICE_TOKEN ?? "",
    };
    if (correlation?.traceparent) {
      headers.traceparent = correlation.traceparent;
    }
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers,
      body: JSON.stringify({
        message,
        executionId: correlation?.executionId,
        callId: correlation?.callId,
        traceId: correlation?.traceId,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `api_enqueue_failed:${res.status}:${text.slice(0, 200)}`,
      };
    }
    const body = await res.json() as { id?: string };
    if (typeof body.id !== "string") {
      return { ok: false, error: "api_enqueue_missing_id" };
    }
    return { ok: true, commandId: body.id };
  } catch (err) {
    return { ok: false, error: `api_unreachable:${String(err)}` };
  }
}

/** Best-effort persistence of host API events into the API security_events table. */
export async function postSecurityEvents(
  events: HostApiEvent[],
): Promise<void> {
  if (events.length === 0) return;
  const url = `${API_BASE_URL}/api/internal/host-events`;
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": INTERNAL_SERVICE_TOKEN ?? "",
      },
      body: JSON.stringify({ events }),
    });
    await res.body?.cancel().catch(() => undefined);
  } catch {
    /* best-effort — runner also returns events on revoke */
  }
}

export async function fetchAuthority(executionId: string): Promise<import("../../../packages/contracts/src/capabilities.ts").ExecutionAuthority> {
 const res=await fetch(`${API_BASE_URL}/api/internal/capability-authority/${encodeURIComponent(executionId)}`,{headers:{"X-Internal-Token":INTERNAL_SERVICE_TOKEN??""},signal:AbortSignal.timeout(5000)});
 if(!res.ok) throw new Error("Execution authority unavailable");
 return await res.json();
}
export async function capabilityCommand(input: Record<string,unknown>): Promise<{accepted:boolean;commandId:string;success?:boolean;data?:Record<string,unknown>;error?:unknown}> {
 const headers={"Content-Type":"application/json","X-Internal-Token":INTERNAL_SERVICE_TOKEN??""};
 const res=await fetch(`${API_BASE_URL}/api/internal/capability-commands`,{method:"POST",headers,body:JSON.stringify(input),signal:AbortSignal.timeout(5000)});
 if(!res.ok) throw new Error("Command rejected");
 const command=await res.json() as {id:string};
 // Bounded wait. Queued is never mislabeled as a completed Paper effect.
 const deadline=Date.now()+3500;
 do {
   const result=await fetch(`${API_BASE_URL}/api/internal/capability-commands/${command.id}?executionId=${input.executionId}&callId=${input.callId}`,{headers,signal:AbortSignal.timeout(1000)});
   if(result.ok) {
     const b=await result.json() as {status:string;result?:{success:boolean;message:string;data:Record<string,unknown>}};
     if(b.result && ["completed","failed","rejected"].includes(b.status)) return {accepted:true,commandId:command.id,success:b.result.success,data:b.result.data,...(!b.result.success?{error:{code:"CAPABILITY_PAPER_REJECTED",message:b.result.message}}:{})};
   } else await result.body?.cancel();
   await new Promise(resolve=>setTimeout(resolve,100));
 } while(Date.now()<deadline);
 return {accepted:true,commandId:command.id,error:{code:"CAPABILITY_RESULT_PENDING",message:"Queued; Paper result not yet confirmed"}};
}
