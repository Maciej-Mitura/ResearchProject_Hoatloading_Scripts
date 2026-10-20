/**
 * chat.broadcast client — calls Host Gateway only.
 */

export interface BroadcastResult {
  accepted: boolean;
  commandId?: string;
  callId?: string;
  capability?: string;
  error?: { code: string; message: string };
}

function gatewayUrl(): string {
  const base = Deno.env.get("HOST_GATEWAY_URL");
  if (!base) {
    throw new Error(
      "host API unavailable: HOST_GATEWAY_URL not configured for this execution",
    );
  }
  return base.replace(/\/$/, "");
}

function capabilityToken(): string {
  const token = Deno.env.get("HOST_CAPABILITY_TOKEN");
  if (!token) {
    throw new Error(
      "host API unavailable: capability credential not configured for this execution",
    );
  }
  return token;
}

export async function broadcast(message: string): Promise<BroadcastResult> {
  if (typeof message !== "string") {
    throw new TypeError("host.chat.broadcast(message) requires a string");
  }
  const url = `${gatewayUrl()}/v1/capabilities/chat.broadcast`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${capabilityToken()}`,
    },
    body: JSON.stringify({ message }),
  });
  const body = await res.json().catch(() => ({})) as BroadcastResult;
  if (!res.ok) {
    return {
      accepted: false,
      error: body.error ?? {
        code: `http_${res.status}`,
        message: "host capability request rejected",
      },
    };
  }
  return body;
}
