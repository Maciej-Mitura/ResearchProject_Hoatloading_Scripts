/**
 * Trusted OpenTelemetry OTLP/HTTP scaffolding for Deno.
 *
 * Correlation / observability only — NOT authorization, sandboxing, or IDS.
 * Application continues if the Collector is unavailable.
 *
 * Never put script source, capability tokens, or bridge secrets into attributes.
 *
 * RESEARCH TODO: DENO_AUDIT_PERMISSIONS=otel comparison; production sampling.
 */

export type AttrValue = string | number | boolean;

export interface ExecutionTrace {
  executionId: string;
  /** 32-char hex W3C trace id — created by trusted API, not by scripts. */
  traceId: string;
  /** 16-char hex root span id */
  rootSpanId: string;
  startMs: number;
  name: string;
  provider: string;
  /** Child spans accumulated until export */
  children: ChildSpan[];
  /** Span events on the root */
  events: SpanEvent[];
  attributes: Record<string, AttrValue>;
}

export interface ChildSpan {
  name: string;
  spanId: string;
  startMs: number;
  endMs?: number;
  ok?: boolean;
  attributes: Record<string, AttrValue>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timeMs: number;
  attributes: Record<string, AttrValue>;
}

const SECRET_KEY_RE =
  /(token|password|secret|api[_-]?key|authorization|bridge_token|database_url)/i;
const FORBIDDEN_ATTR_KEYS = new Set([
  "script.source",
  "source",
  "HOST_CAPABILITY_TOKEN",
  "HOST_GATEWAY_ADMIN_TOKEN",
  "BRIDGE_TOKEN",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "DATABASE_URL",
]);

let endpoint: string | null = null;
let serviceName = "research-api";

/** Simple PoC counters — not high-cardinality labeled metrics. */
const counters = {
  execution_count: 0,
  execution_failures: 0,
  permission_access_count: 0,
  host_api_request_count: 0,
  host_api_deny_count: 0,
};

export async function initTelemetry(): Promise<void> {
  const ep = Deno.env.get("OTEL_EXPORTER_OTLP_ENDPOINT");
  serviceName = Deno.env.get("OTEL_SERVICE_NAME") ?? "research-api";
  if (!ep) {
    console.log("[otel] no OTEL_EXPORTER_OTLP_ENDPOINT — tracing disabled");
    return;
  }
  endpoint = ep.replace(/\/$/, "");
  console.log(
    `[otel] OTLP endpoint configured → ${endpoint} (100% recording for PoC; not a production recommendation)`,
  );
}

export async function shutdownTelemetry(): Promise<void> {
  /* no-op for fetch-based exporter */
}

export function isTelemetryEnabled(): boolean {
  return endpoint !== null;
}

export function getCounters(): Readonly<typeof counters> {
  return { ...counters };
}

function hex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Create a trusted root execution trace (API-owned identity). */
export function startExecutionTrace(
  executionId: string,
  provider: string = "mock",
): ExecutionTrace {
  counters.execution_count++;
  return {
    executionId,
    traceId: hex(16),
    rootSpanId: hex(8),
    startMs: Date.now(),
    name: "execution",
    provider,
    children: [],
    events: [],
    attributes: {
      "execution.id": executionId,
      "execution.provider": provider,
    },
  };
}

/** @deprecated alias — prefer startExecutionTrace */
export function startExecutionSpan(
  executionId: string,
  provider: string = "mock",
): ExecutionTrace {
  return startExecutionTrace(executionId, provider);
}

export function addTraceEvent(
  trace: ExecutionTrace | null,
  name: string,
  attributes: Record<string, AttrValue> = {},
): void {
  if (!trace) return;
  trace.events.push({
    name,
    timeMs: Date.now(),
    attributes: sanitizeAttrs(attributes),
  });
  if (name === "permission.accessed") counters.permission_access_count++;
  if (name === "host_api.requested") counters.host_api_request_count++;
  if (name === "host_api.denied") counters.host_api_deny_count++;
}

export function startChildSpan(
  trace: ExecutionTrace | null,
  name: string,
  attributes: Record<string, AttrValue> = {},
): ChildSpan | null {
  if (!trace) return null;
  const child: ChildSpan = {
    name,
    spanId: hex(8),
    startMs: Date.now(),
    attributes: sanitizeAttrs(attributes),
    events: [],
  };
  trace.children.push(child);
  return child;
}

export function endChildSpan(
  child: ChildSpan | null,
  ok: boolean,
  attributes: Record<string, AttrValue> = {},
): void {
  if (!child) return;
  child.endMs = Date.now();
  child.ok = ok;
  Object.assign(child.attributes, sanitizeAttrs(attributes));
}

export function setTraceAttributes(
  trace: ExecutionTrace | null,
  attrs: Record<string, AttrValue>,
): void {
  if (!trace) return;
  Object.assign(trace.attributes, sanitizeAttrs(attrs));
}

/** W3C traceparent for trusted service-to-service propagation only. */
export function formatTraceparent(trace: ExecutionTrace | null): string | null {
  if (!trace) return null;
  return `00-${trace.traceId}-${trace.rootSpanId}-01`;
}

export function parseTraceparent(header: string | null | undefined): {
  traceId: string;
  parentSpanId: string;
} | null {
  if (!header) return null;
  const m = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(
    header.trim(),
  );
  if (!m) return null;
  return { traceId: m[1].toLowerCase(), parentSpanId: m[2].toLowerCase() };
}

export function endSpanOk(
  trace: ExecutionTrace | null,
  attrs: Record<string, AttrValue> = {},
): void {
  if (!trace) return;
  Object.assign(trace.attributes, sanitizeAttrs(attrs));
  void exportTrace(trace, true);
}

export function endSpanError(
  trace: ExecutionTrace | null,
  err: unknown,
  attrs: Record<string, AttrValue> = {},
): void {
  if (!trace) return;
  counters.execution_failures++;
  Object.assign(trace.attributes, sanitizeAttrs(attrs));
  const msg = String(err).slice(0, 400);
  void exportTrace(trace, false, msg);
}

export function sanitizeAttrs(
  attrs: Record<string, AttrValue>,
): Record<string, AttrValue> {
  const out: Record<string, AttrValue> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (FORBIDDEN_ATTR_KEYS.has(key) || SECRET_KEY_RE.test(key)) continue;
    if (typeof value === "string") {
      if (value.includes("SECRET_KEY") || /sk-[a-zA-Z0-9]{10,}/.test(value)) {
        continue;
      }
      // Cap cardinality-prone string attrs
      out[key] = value.length > 256 ? `${value.slice(0, 256)}…` : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Detect forbidden content in a serialized telemetry payload (tests). */
export function telemetryBlobLooksSafe(blob: string): boolean {
  if (blob.includes("HOST_CAPABILITY_TOKEN=")) return false;
  if (blob.includes("BRIDGE_TOKEN")) return false;
  if (blob.includes("GEMINI_API_KEY")) return false;
  if (blob.includes("script.source")) return false;
  return true;
}

function otelAttr(
  key: string,
  value: AttrValue,
): { key: string; value: Record<string, unknown> } {
  if (typeof value === "string") {
    return { key, value: { stringValue: value } };
  }
  if (typeof value === "boolean") {
    return { key, value: { boolValue: value } };
  }
  return { key, value: { intValue: Math.trunc(value) } };
}

async function exportTrace(
  trace: ExecutionTrace,
  ok: boolean,
  errorMessage?: string,
): Promise<void> {
  if (!endpoint) return;
  const endMs = Date.now();
  const startNano = BigInt(trace.startMs) * 1_000_000n;
  const endNano = BigInt(endMs) * 1_000_000n;

  const rootAttrs = Object.entries(trace.attributes).map(([k, v]) =>
    otelAttr(k, v)
  );
  if (errorMessage) {
    rootAttrs.push(otelAttr("error.message", errorMessage.slice(0, 400)));
  }

  const spans: unknown[] = [
    {
      traceId: trace.traceId,
      spanId: trace.rootSpanId,
      name: trace.name,
      kind: 1,
      startTimeUnixNano: startNano.toString(),
      endTimeUnixNano: endNano.toString(),
      attributes: rootAttrs,
      events: trace.events.map((ev) => ({
        timeUnixNano: (BigInt(ev.timeMs) * 1_000_000n).toString(),
        name: ev.name,
        attributes: Object.entries(ev.attributes).map(([k, v]) =>
          otelAttr(k, v)
        ),
      })),
      status: {
        code: ok ? 1 : 2,
        message: errorMessage ?? "",
      },
    },
  ];

  for (const child of trace.children) {
    const cEnd = child.endMs ?? endMs;
    spans.push({
      traceId: trace.traceId,
      spanId: child.spanId,
      parentSpanId: trace.rootSpanId,
      name: child.name,
      kind: 1,
      startTimeUnixNano: (BigInt(child.startMs) * 1_000_000n).toString(),
      endTimeUnixNano: (BigInt(cEnd) * 1_000_000n).toString(),
      attributes: Object.entries(child.attributes).map(([k, v]) =>
        otelAttr(k, v)
      ),
      events: child.events.map((ev) => ({
        timeUnixNano: (BigInt(ev.timeMs) * 1_000_000n).toString(),
        name: ev.name,
        attributes: Object.entries(ev.attributes).map(([k, v]) =>
          otelAttr(k, v)
        ),
      })),
      status: {
        code: child.ok === false ? 2 : 1,
        message: "",
      },
    });
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
            spans,
          },
        ],
      },
    ],
  };

  try {
    const blob = JSON.stringify(body);
    if (!telemetryBlobLooksSafe(blob)) {
      console.warn("[otel] blocked unsafe telemetry payload");
      return;
    }
    const res = await fetch(`${endpoint}/v1/traces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: blob,
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) {
      console.warn(`[otel] export failed: ${res.status}`);
    }
    // Best-effort metrics as a tiny OTLP metrics export
    void exportCounters();
  } catch (err) {
    console.warn("[otel] export error (ignored):", (err as Error).message);
  }
}

async function exportCounters(): Promise<void> {
  if (!endpoint) return;
  const now = (BigInt(Date.now()) * 1_000_000n).toString();
  const metrics = Object.entries(counters).map(([name, value]) => ({
    name: `research.${name}`,
    sum: {
      dataPoints: [
        {
          asInt: String(value),
          timeUnixNano: now,
          attributes: [],
        },
      ],
      aggregationTemporality: 2,
      isMonotonic: true,
    },
  }));
  try {
    await fetch(`${endpoint}/v1/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceMetrics: [
          {
            resource: {
              attributes: [
                { key: "service.name", value: { stringValue: serviceName } },
              ],
            },
            scopeMetrics: [{ scope: { name: "research-api" }, metrics }],
          },
        ],
      }),
      signal: AbortSignal.timeout(2_000),
    });
  } catch (err) {
    console.warn("[otel] metrics export error (ignored):", (err as Error).message);
  }
}
