/**
 * Lightweight OpenTelemetry OTLP/HTTP scaffolding for Deno.
 * Avoids NodeSDK (poor Deno fit). Application works if Collector is down.
 *
 * RESEARCH TODO: mandatory security event types, retention, sampling,
 * sensitive-data redaction, authoritative vs untrusted telemetry sources,
 * incident reconstruction criteria.
 */

export interface SimpleSpan {
  executionId: string;
  startMs: number;
  name: string;
}

let endpoint: string | null = null;
let serviceName = "research-api";

export async function initTelemetry(): Promise<void> {
  const ep = Deno.env.get("OTEL_EXPORTER_OTLP_ENDPOINT");
  serviceName = Deno.env.get("OTEL_SERVICE_NAME") ?? "research-api";
  if (!ep) {
    console.log("[otel] no OTEL_EXPORTER_OTLP_ENDPOINT — tracing disabled");
    return;
  }
  endpoint = ep.replace(/\/$/, "");
  console.log(`[otel] OTLP endpoint configured → ${endpoint}`);
}

export async function shutdownTelemetry(): Promise<void> {
  /* no-op for fetch-based exporter */
}

export function startExecutionSpan(executionId: string): SimpleSpan | null {
  if (!endpoint) return null;
  return {
    executionId,
    startMs: Date.now(),
    name: "mock.execution",
  };
}

export function endSpanOk(span: SimpleSpan | null): void {
  if (!span || !endpoint) return;
  void exportSpan(span, true);
}

export function endSpanError(span: SimpleSpan | null, err: unknown): void {
  if (!span || !endpoint) return;
  void exportSpan(span, false, String(err));
}

async function exportSpan(
  span: SimpleSpan,
  ok: boolean,
  errorMessage?: string,
): Promise<void> {
  if (!endpoint) return;
  const endMs = Date.now();
  const startNano = BigInt(span.startMs) * 1_000_000n;
  const endNano = BigInt(endMs) * 1_000_000n;
  const traceId = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "").slice(0, 0);
  // 32-hex trace id, 16-hex span id
  const tid = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const sid = [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const attributes = [
    { key: "execution.id", value: { stringValue: span.executionId } },
    { key: "execution.mode", value: { stringValue: "mock" } },
  ];
  if (errorMessage) {
    attributes.push({ key: "error.message", value: { stringValue: errorMessage } });
  }

  const body = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: serviceName } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "research-api" },
            spans: [
              {
                traceId: tid,
                spanId: sid,
                name: span.name,
                kind: 1,
                startTimeUnixNano: startNano.toString(),
                endTimeUnixNano: endNano.toString(),
                attributes,
                status: {
                  code: ok ? 1 : 2,
                  message: errorMessage ?? "",
                },
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(`${endpoint}/v1/traces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`[otel] export failed: ${res.status}`);
    }
  } catch (err) {
    // Collector unavailable — continue silently
    console.warn("[otel] export error (ignored):", (err as Error).message);
  }

  // silence unused
  void startNano;
  void traceId;
}
