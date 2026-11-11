import { isCapability } from "../../../../packages/contracts/src/capabilities.ts";
/** Only the authenticated gateway may create this queue-side mapping. Never read payload._meta. */
export interface SandboxCommandCorrelation {
  executionId: string;
  traceId: string;
  callId: string;
  capability:
    import("../../../../packages/contracts/src/capabilities.ts").CapabilityId;
  manifestId?: string;
  scriptVersionId?: string;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseGatewayCommand(
  body: unknown,
): { message: string; correlation: SandboxCommandCorrelation } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (
    Object.keys(b).some((k) =>
      !["message", "executionId", "traceId", "callId"].includes(k)
    )
  ) return null;
  if (
    typeof b.message !== "string" || !b.message.trim() ||
    b.message.length > 256 ||
    /[\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(b.message)
  ) return null;
  if (
    typeof b.executionId !== "string" || !UUID.test(b.executionId) ||
    typeof b.callId !== "string" || !UUID.test(b.callId)
  ) return null;
  if (
    typeof b.traceId !== "string" || !/^(?!0{32})[0-9a-f]{32}$/.test(b.traceId)
  ) return null;
  return {
    message: b.message,
    correlation: {
      executionId: b.executionId,
      traceId: b.traceId,
      callId: b.callId,
      capability: "chat.broadcast",
    },
  };
}

export function trustedCommandCorrelation(
  command: { origin?: string; correlation?: unknown },
): SandboxCommandCorrelation | null {
  if (
    command.origin !== "sandbox_capability" || !command.correlation ||
    typeof command.correlation !== "object"
  ) return null;
  const c = command.correlation as Record<string, unknown>;
  const parsed = parseGatewayCommand({
    message: "validation",
    executionId: c.executionId,
    traceId: c.traceId,
    callId: c.callId,
  });
  if (
    !parsed || typeof c.capability !== "string" || !isCapability(c.capability)
  ) return null;
  return {
    ...parsed.correlation,
    capability: c.capability as SandboxCommandCorrelation["capability"],
    ...(typeof c.manifestId === "string" ? { manifestId: c.manifestId } : {}),
    ...(typeof c.scriptVersionId === "string"
      ? { scriptVersionId: c.scriptVersionId }
      : {}),
  };
}
