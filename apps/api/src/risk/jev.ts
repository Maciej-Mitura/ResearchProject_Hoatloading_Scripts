/**
 * JevRiskAnalyzer — TypeSafe System One advisory classifier.
 *
 * Official HTTP API (docs.typesafe.ai/api):
 *   POST https://api.typesafe.ai/v1/systemone
 *   Authorization: Bearer <API_KEY>
 *
 * Uses typed Choice with options low|review|high.
 * Never grants permissions, never blocks execution, never sees deterministic output.
 *
 * Confidence semantics (TypeSafe docs): derived from the Choice probability
 * distribution — NOT a calibrated probability that the script is malicious.
 */

import type { RiskClassification } from "../domain/types.ts";
import type {
  RiskAnalyzeInput,
  RiskAnalyzeResult,
  RiskAnalyzer,
} from "../providers/risk.ts";
import type { ExecutionEvidenceRecord } from "./evidence.ts";
import {
  buildJevRiskState,
  evidenceFactReasons,
  JEV_POLICY_VERSION,
  jevStateLooksSafe,
  presentJevState,
  type JevStatePresentation,
} from "./jev-input.ts";
import {
  resolveJevProvider,
  resolveJevRoute,
  TYPESAFE_DEFAULT_MODEL,
  type JevCredentialSource,
  type JevProviderKind,
  type ResolvedJevRoute,
} from "./jev-route.ts";

export {
  resolveJevProvider,
  resolveJevRoute,
  credentialAllowedForProvider,
  TYPESAFE_BASE_URL,
  VERCEL_TYPESAFE_BASE_URL,
  TYPESAFE_DEFAULT_MODEL,
  VERCEL_DEFAULT_MODEL,
} from "./jev-route.ts";
export type {
  JevCredentialSource,
  JevProviderKind,
  ResolvedJevRoute,
} from "./jev-route.ts";

export const JEV_ANALYZER_VERSION = "1" as const;
/** @deprecated use resolveJevRoute().systemOneUrl */
export const JEV_DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
/** @deprecated use resolveJevRoute().modelsUrl */
export const JEV_DEFAULT_MODELS_URL = "https://api.typesafe.ai/v1/models";
export const JEV_DEFAULT_MODEL = TYPESAFE_DEFAULT_MODEL;
export const JEV_CHOICE_OPTIONS = ["low", "review", "high"] as const;

const SECRET_REDACT =
  /(Bearer\s+)[^\s"']+|((?:JEV_API_KEY|TYPESAFE_API_KEY|AI_GATEWAY_API_KEY)\s*[=:]\s*)\S+|(?:sk-|vck_)[A-Za-z0-9_-]{8,}/gi;

/** Redact credentials / bearer tokens from provider text for safe logging. */
export function sanitizeProviderText(text: string, maxLen = 800): string {
  const redacted = text.replace(SECRET_REDACT, (_m, g1, g2) => {
    if (typeof g1 === "string") return `${g1}REDACTED`;
    if (typeof g2 === "string") return `${g2}REDACTED`;
    return "REDACTED";
  });
  return redacted.length > maxLen
    ? `${redacted.slice(0, maxLen)}…[truncated]`
    : redacted;
}

/** Extract a provider request id from response headers if present. */
export function extractProviderRequestId(
  headers: Headers | { get(name: string): string | null },
): string | null {
  const names = [
    "x-request-id",
    "request-id",
    "x-typesafe-request-id",
    "cf-ray",
  ];
  for (const n of names) {
    const v = headers.get(n);
    if (v && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Build sanitized diagnostics for a non-2xx TypeSafe response.
 * Never includes Authorization, API keys, or the request evidence payload.
 */
export function buildProviderHttpFailureMeta(input: {
  httpStatus: number;
  endpoint: string;
  model: string;
  responseText: string;
  headers: Headers | { get(name: string): string | null };
}): Record<string, unknown> {
  const requestId = extractProviderRequestId(input.headers);
  let providerError: unknown = null;
  let providerMessage: string | null = null;
  const raw = input.responseText?.trim() ?? "";
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      providerError = parsed;
      let msg: unknown = parsed.message ?? parsed.detail ?? parsed.error;
      // Prefer nested .message when error is an object (common API shape).
      if (
        msg != null && typeof msg === "object" &&
        typeof (msg as { message?: unknown }).message === "string"
      ) {
        msg = (msg as { message: string }).message;
      }
      if (typeof msg === "string") {
        providerMessage = sanitizeProviderText(msg);
      } else if (msg != null) {
        providerMessage = sanitizeProviderText(JSON.stringify(msg));
      } else if (typeof parsed.error_type === "string") {
        providerMessage = sanitizeProviderText(String(parsed.error_type));
      }
    } catch {
      providerMessage = sanitizeProviderText(raw);
    }
  }
  let sanitizedError: unknown = null;
  if (providerError != null) {
    const errText = sanitizeProviderText(JSON.stringify(providerError), 2000);
    try {
      sanitizedError = JSON.parse(errText);
    } catch {
      sanitizedError = errText;
    }
  }
  return {
    httpStatus: input.httpStatus,
    endpoint: input.endpoint,
    model: input.model,
    requestId,
    providerMessage,
    providerError: sanitizedError,
    // Explicit: never persisted
    authorization: "REDACTED",
  };
}

export type JevFailureKind =
  | "missing_credentials"
  | "timeout"
  | "http_error"
  | "rate_limited"
  | "auth_failure"
  | "billing_failure"
  | "invalid_output"
  | "unknown_classification"
  | "parse_failure"
  | "unsafe_state"
  | "missing_evidence";

export interface JevAnalyzeResult extends RiskAnalyzeResult {
  analyzer: "jev";
  analyzerVersion: string;
  latencyMs: number;
  status: "ok" | "failed" | "unavailable";
  failureKind?: JevFailureKind;
  providerMetadata: Record<string, unknown>;
  evidenceSchemaVersion: number;
}

export interface JevClientConfig {
  apiKey?: string | null;
  /** Explicit provider: typesafe | vercel. Defaults to JEV_PROVIDER env / typesafe. */
  provider?: JevProviderKind | string | null;
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
  /** Injected for tests — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  policyText?: string;
  presentation?: JevStatePresentation;
}

function routeFromClientConfig(config: JevClientConfig): ResolvedJevRoute {
  const apiKeyExplicit = Object.prototype.hasOwnProperty.call(config, "apiKey");
  return resolveJevRoute({
    provider: config.provider,
    apiKey: config.apiKey,
    apiKeyExplicit,
    model: config.model,
    systemOneUrlOverride: config.endpoint ?? Deno.env.get("JEV_API_URL"),
    modelsUrlOverride: Deno.env.get("JEV_MODELS_URL"),
  });
}

/** Map HTTP status to failure kind (auth vs billing vs other). */
export function failureKindFromHttpStatus(status: number): JevFailureKind {
  if (status === 401) return "auth_failure";
  if (status === 402) return "billing_failure";
  // 403: usually auth, but Vercel AI Gateway uses 403 for account/billing gates
  // (e.g. customer_verification_required / credit card) while the same key
  // still authenticates GET /v1/models — see failureKindFromProviderResponse.
  if (status === 403) return "auth_failure";
  if (status === 429 || status === 529) return "rate_limited";
  return "http_error";
}

/**
 * Refine failure kind using sanitized provider body (no secrets).
 * Distinguishes invalid credentials from Gateway billing/verification gates.
 */
export function failureKindFromProviderResponse(
  status: number,
  providerMessage: string | null | undefined,
  providerError: unknown,
): JevFailureKind {
  const base = failureKindFromHttpStatus(status);
  const blob = `${providerMessage ?? ""} ${
    typeof providerError === "string"
      ? providerError
      : JSON.stringify(providerError ?? "")
  }`.toLowerCase();
  const billingGate =
    blob.includes("customer_verification_required") ||
    blob.includes("credit card") ||
    blob.includes("insufficient credit") ||
    blob.includes("insufficient budget") ||
    blob.includes("free credits") ||
    (status === 402);
  if (billingGate) return "billing_failure";
  return base;
}

/** Credential presence for the active provider only — never returns the secret. */
export function jevCredentialStatus(provider?: JevProviderKind | string | null): {
  configured: boolean;
  source: JevCredentialSource | null;
  keyLength: number;
  provider: JevProviderKind;
} {
  const route = resolveJevRoute({ provider });
  return {
    configured: route.apiKey != null,
    source: route.credentialSource,
    keyLength: route.keyLength,
    provider: route.provider,
  };
}

export interface JevPreflightResult {
  ok: boolean;
  authentication: "ok" | "rejected" | "missing_credentials" | "billing" | "error";
  httpStatus: number | null;
  provider: JevProviderKind;
  baseURL: string;
  modelsUrl: string;
  systemOneEndpoint: string;
  configuredModel: string;
  requestId: string | null;
  providerMessage: string | null;
  modelNames: string[] | null;
  latencyMs: number;
  credentialSource: JevCredentialSource | null;
  keyLength: number;
  note: string;
}

/**
 * Authenticated connectivity check: GET {baseURL}/v1/models.
 * Does NOT call System One / spend classification tokens.
 * Provider-aware: typesafe → api.typesafe.ai; vercel → ai-gateway.vercel.sh/typesafe.
 */
export async function preflightJevAuth(
  config: JevClientConfig = {},
): Promise<JevPreflightResult> {
  const route = routeFromClientConfig(config);
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ??
    Number(Deno.env.get("JEV_TIMEOUT_MS") ?? "30000");

  const base = {
    provider: route.provider,
    baseURL: route.baseURL,
    modelsUrl: route.modelsUrl,
    systemOneEndpoint: route.systemOneUrl,
    configuredModel: route.model,
    credentialSource: route.credentialSource,
    keyLength: route.keyLength,
  };

  if (!route.apiKey) {
    return {
      ...base,
      ok: false,
      authentication: "missing_credentials",
      httpStatus: null,
      requestId: null,
      providerMessage: route.missingCredentialHint,
      modelNames: null,
      latencyMs: 0,
      note:
        "No System One classification request was made. Configure the credential for JEV_PROVIDER and retry.",
    };
  }

  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(route.modelsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${route.apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - started);
    const text = await res.text();
    const requestId = extractProviderRequestId(res.headers);
    const meta = buildProviderHttpFailureMeta({
      httpStatus: res.status,
      endpoint: route.modelsUrl,
      model: route.model,
      responseText: text,
      headers: res.headers,
    });

    if (res.status === 200) {
      let modelNames: string[] | null = null;
      try {
        const parsed = JSON.parse(text) as { models?: Array<{ name?: string }> };
        if (Array.isArray(parsed.models)) {
          modelNames = parsed.models
            .map((m) => m.name)
            .filter((n): n is string => typeof n === "string");
        }
      } catch {
        modelNames = null;
      }
      return {
        ...base,
        ok: true,
        authentication: "ok",
        httpStatus: 200,
        requestId,
        providerMessage: null,
        modelNames,
        latencyMs,
        note:
          `Authentication OK via GET ${route.modelsUrl}. No System One classification call was made.`,
      };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ...base,
        ok: false,
        authentication: "rejected",
        httpStatus: res.status,
        requestId,
        providerMessage: (meta.providerMessage as string | null) ??
          `HTTP ${res.status}`,
        modelNames: null,
        latencyMs,
        note:
          "Authentication rejected. No System One classification call was made.",
      };
    }

    if (res.status === 402) {
      return {
        ...base,
        ok: false,
        authentication: "billing",
        httpStatus: 402,
        requestId,
        providerMessage: (meta.providerMessage as string | null) ??
          "HTTP 402",
        modelNames: null,
        latencyMs,
        note:
          "Billing/credits failure (not auth). No System One classification call was made.",
      };
    }

    return {
      ...base,
      ok: false,
      authentication: "error",
      httpStatus: res.status,
      requestId,
      providerMessage: (meta.providerMessage as string | null) ??
        `HTTP ${res.status}`,
      modelNames: null,
      latencyMs,
      note:
        "Models endpoint returned a non-auth error. No System One classification call was made.",
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return {
      ...base,
      ok: false,
      authentication: "error",
      httpStatus: null,
      requestId: null,
      providerMessage: sanitizeProviderText(
        aborted ? `timeout after ${timeoutMs}ms` : String(err),
      ),
      modelNames: null,
      latencyMs,
      note:
        "Preflight network error. No System One classification call was made.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export const DEFAULT_JEV_POLICY = `Classify observed sandbox execution evidence into exactly one of: low, review, high.

Semantics:
- low: No predefined evidence in this controlled model that clearly requires review. low does NOT mean safe.
- review: Observed behavior warrants human/research review.
- high: Strong evidence of resource abuse, repeated authorization denial, or other high-priority behavior in the controlled model. high does NOT mean malicious.

Base the decision only on the supplied evidence state. Do not speculate about developer intent. Do not invent facts.`;

export const CHOICE_CRITERIA = {
  low:
    "No predefined evidence in this controlled model that clearly requires review. Not a claim of safety.",
  review:
    "Observed behavior warrants human/research review (e.g. restricted permission activity, single host denial, output truncation).",
  high:
    "Strong evidence of resource abuse, repeated authorization denial/budget exhaustion, subprocess/FFI probes, or wall-clock timeout in this controlled model. Not a claim of malice.",
} as const;

/**
 * Build the exact System One JSON body that would be POSTed — never sends.
 * Used for research dry-run inspection and integrity assertions.
 */
export function buildJevSystemOneRequest(
  evidence: ExecutionEvidenceRecord,
  opts: {
    model?: string;
    policyText?: string;
    presentation?: JevStatePresentation;
  } = {},
): {
  endpoint: string;
  model: string;
  body: {
    state: Record<string, unknown>;
    model: string;
    questions: {
      risk_class: {
        type: "choice";
        instructions: string;
        criteria: typeof CHOICE_CRITERIA;
      };
    };
  };
  integrity: { safe: boolean; forbiddenHits: string[] };
} {
  const route = resolveJevRoute({
    model: opts.model,
    systemOneUrlOverride: Deno.env.get("JEV_API_URL"),
  });
  const model = route.model;
  const endpoint = route.systemOneUrl;
  const compact = buildJevRiskState(evidence);
  const state = presentJevState(compact, opts.presentation ?? "canonical");
  const blob = JSON.stringify(state);
  const forbiddenKeys = [
    "scenarioId",
    "expectedResearchLabel",
    "referenceLabel",
    "corpusType",
    "holdout",
    "deterministic",
    "ruleId",
    "ruleMatches",
    "scriptSource",
    "HOST_CAPABILITY_TOKEN",
    "BRIDGE_TOKEN",
    "JEV_API_KEY",
    "TYPESAFE_API_KEY",
    "AI_GATEWAY_API_KEY",
  ];
  const forbiddenHits = forbiddenKeys.filter((k) =>
    blob.includes(`"${k}"`) || blob.includes(`${k}=`)
  );
  return {
    endpoint,
    model,
    body: {
      state,
      model,
      questions: {
        risk_class: {
          type: "choice",
          instructions: opts.policyText ?? DEFAULT_JEV_POLICY,
          criteria: { ...CHOICE_CRITERIA },
        },
      },
    },
    integrity: {
      safe: jevStateLooksSafe(state) && forbiddenHits.length === 0,
      forbiddenHits,
    },
  };
}

export function mapChoiceToClassification(
  choice: string,
): RiskClassification | null {
  const c = choice.trim().toLowerCase();
  if (c === "low" || c === "review" || c === "high") return c;
  return null;
}

export function parseJevChoiceAnswer(
  body: unknown,
): {
  classification: RiskClassification;
  confidence: number | null;
  probabilities: Record<string, number>;
  model: string | null;
  usage: unknown;
} {
  if (!body || typeof body !== "object") {
    throw new Error("parse_failure: empty body");
  }
  const root = body as Record<string, unknown>;
  const model = typeof root.model === "string" ? root.model : null;
  const answers = root.answers;
  if (!answers || typeof answers !== "object") {
    throw new Error("parse_failure: missing answers");
  }
  const risk = (answers as Record<string, unknown>).risk_class;
  if (!risk || typeof risk !== "object") {
    throw new Error("parse_failure: missing answers.risk_class");
  }
  const ans = risk as Record<string, unknown>;
  if (ans.type !== "choice") {
    throw new Error(`invalid_output: expected type=choice got ${ans.type}`);
  }
  if (typeof ans.choice !== "string") {
    throw new Error("invalid_output: missing choice");
  }
  const classification = mapChoiceToClassification(ans.choice);
  if (!classification) {
    throw new Error(`unknown_classification: ${ans.choice}`);
  }
  let confidence: number | null = null;
  if (typeof ans.confidence === "number" && Number.isFinite(ans.confidence)) {
    confidence = ans.confidence;
  }
  const probabilities =
    ans.probabilities && typeof ans.probabilities === "object"
      ? (ans.probabilities as Record<string, number>)
      : {};
  return {
    classification,
    confidence,
    probabilities,
    model,
    usage: root.usage ?? null,
  };
}

function failureResult(
  kind: JevFailureKind,
  latencyMs: number,
  message: string,
  meta: Record<string, unknown> = {},
  evidenceSchemaVersion = 1,
): JevAnalyzeResult {
  return {
    analyzer: "jev",
    classification: null,
    score: 0,
    confidence: null,
    reasons: [
      `Jev unavailable: ${message}`,
      "Deterministic result is stored separately when available — this row is not a deterministic substitute.",
    ],
    provider: "jev",
    analyzerVersion: JEV_ANALYZER_VERSION,
    latencyMs,
    status: kind === "missing_credentials" ? "unavailable" : "failed",
    failureKind: kind,
    providerMetadata: {
      ...meta,
      failureKind: kind,
      policyVersion: JEV_POLICY_VERSION,
      confidenceSemantics:
        "TypeSafe Choice confidence is derived from the probability distribution across options; it is NOT a probability that the script is malicious.",
    },
    evidenceSchemaVersion,
  };
}

export class JevRiskAnalyzer implements RiskAnalyzer {
  readonly name = "jev";
  private readonly cfg: {
    apiKey: string | null;
    endpoint: string;
    model: string;
    timeoutMs: number;
    fetchImpl: typeof fetch;
    policyText: string;
    presentation: JevStatePresentation;
    provider: JevProviderKind;
    baseURL: string;
    credentialSource: JevCredentialSource | null;
    missingCredentialHint: string;
  };

  constructor(config: JevClientConfig = {}) {
    const route = routeFromClientConfig(config);
    this.cfg = {
      apiKey: route.apiKey,
      endpoint: route.systemOneUrl,
      model: route.model,
      timeoutMs: config.timeoutMs ??
        Number(Deno.env.get("JEV_TIMEOUT_MS") ?? "30000"),
      fetchImpl: config.fetchImpl ?? fetch,
      policyText: config.policyText ?? DEFAULT_JEV_POLICY,
      presentation: config.presentation ?? "canonical",
      provider: route.provider,
      baseURL: route.baseURL,
      credentialSource: route.credentialSource,
      missingCredentialHint: route.missingCredentialHint,
    };
  }

  /** Classify from evidence only — preferred entry for research tooling. */
  async classify(
    evidence: ExecutionEvidenceRecord,
    opts: { presentation?: JevStatePresentation } = {},
  ): Promise<JevAnalyzeResult> {
    return await this.analyzeEvidence(evidence, opts.presentation);
  }

  async analyze(input: RiskAnalyzeInput): Promise<RiskAnalyzeResult> {
    // Explicitly ignore any research/label fields if callers attach them.
    void (input as { scenarioId?: string }).scenarioId;
    void (input as { referenceLabel?: string }).referenceLabel;
    void (input as { expectedResearchLabel?: string }).expectedResearchLabel;
    void input.source;

    if (!input.evidence) {
      return failureResult(
        "missing_evidence",
        0,
        "No ExecutionEvidenceRecord supplied",
      );
    }
    return await this.analyzeEvidence(input.evidence);
  }

  private async analyzeEvidence(
    evidence: ExecutionEvidenceRecord,
    presentation?: JevStatePresentation,
  ): Promise<JevAnalyzeResult> {
    const started = performance.now();
    const schemaVer = evidence.evidenceSchemaVersion;

    if (!this.cfg.apiKey) {
      return failureResult(
        "missing_credentials",
        Math.round(performance.now() - started),
        this.cfg.missingCredentialHint,
        {
          endpoint: this.cfg.endpoint,
          model: this.cfg.model,
          provider: this.cfg.provider,
          baseURL: this.cfg.baseURL,
        },
        schemaVer,
      );
    }

    const compact = buildJevRiskState(evidence);
    const state = presentJevState(
      compact,
      presentation ?? this.cfg.presentation,
    );
    if (!jevStateLooksSafe(state)) {
      return failureResult(
        "unsafe_state",
        Math.round(performance.now() - started),
        "Refusing to send state containing forbidden fields",
        {},
        schemaVer,
      );
    }

    const body = {
      state,
      model: this.cfg.model,
      questions: {
        risk_class: {
          type: "choice",
          instructions: this.cfg.policyText,
          criteria: { ...CHOICE_CRITERIA },
        },
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const res = await this.cfg.fetchImpl(this.cfg.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.cfg.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const latencyMs = Math.round(performance.now() - started);
      const text = await res.text();
      const httpMeta: Record<string, unknown> = {
        ...buildProviderHttpFailureMeta({
          httpStatus: res.status,
          endpoint: this.cfg.endpoint,
          model: this.cfg.model,
          responseText: text,
          headers: res.headers,
        }),
        provider: this.cfg.provider,
        baseURL: this.cfg.baseURL,
        credentialSource: this.cfg.credentialSource,
      };

      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        if (!res.ok) {
          const kind = failureKindFromProviderResponse(
            res.status,
            httpMeta.providerMessage as string | null,
            httpMeta.providerError,
          );
          const detail = httpMeta.providerMessage
            ? `${httpMeta.providerMessage}`
            : `Non-JSON response HTTP ${res.status}`;
          return failureResult(
            kind,
            latencyMs,
            detail,
            { ...httpMeta, failureKind: kind },
            schemaVer,
          );
        }
        return failureResult(
          "parse_failure",
          latencyMs,
          `Non-JSON response HTTP ${res.status}`,
          httpMeta,
          schemaVer,
        );
      }

      if (!res.ok) {
        const kind = failureKindFromProviderResponse(
          res.status,
          httpMeta.providerMessage as string | null,
          httpMeta.providerError,
        );
        const detail = httpMeta.providerMessage
          ? `HTTP ${res.status}: ${httpMeta.providerMessage}`
          : `HTTP ${res.status}`;
        return failureResult(
          kind,
          latencyMs,
          detail,
          { ...httpMeta, failureKind: kind },
          schemaVer,
        );
      }

      let parsedAnswer;
      try {
        parsedAnswer = parseJevChoiceAnswer(parsed);
      } catch (err) {
        const msg = String(err);
        const kind: JevFailureKind = msg.includes("unknown_classification")
          ? "unknown_classification"
          : msg.includes("invalid_output")
          ? "invalid_output"
          : "parse_failure";
        return failureResult(kind, latencyMs, msg, {
          httpStatus: res.status,
          endpoint: this.cfg.endpoint,
          model: this.cfg.model,
          requestId: httpMeta.requestId,
        }, schemaVer);
      }

      const facts = evidenceFactReasons(evidence);
      const reasons = [
        `Jev Choice → ${parsedAnswer.classification.toUpperCase()}`,
        ...facts.slice(0, 16),
        "Reasons above are local evidence facts; TypeSafe Choice does not return free-text rationales.",
      ];

      // score mirrors peak option probability when available, else confidence.
      const peak =
        typeof parsedAnswer.probabilities[parsedAnswer.classification] ===
            "number"
          ? parsedAnswer.probabilities[parsedAnswer.classification]
          : parsedAnswer.confidence ?? 0;

      return {
        analyzer: "jev",
        classification: parsedAnswer.classification,
        score: peak,
        confidence: parsedAnswer.confidence,
        reasons,
        provider: "jev",
        analyzerVersion: JEV_ANALYZER_VERSION,
        latencyMs,
        status: "ok",
        providerMetadata: {
          provider: this.cfg.provider,
          baseURL: this.cfg.baseURL,
          endpoint: this.cfg.endpoint,
          requestedModel: this.cfg.model,
          responseModel: parsedAnswer.model,
          credentialSource: this.cfg.credentialSource,
          policyVersion: JEV_POLICY_VERSION,
          probabilities: parsedAnswer.probabilities,
          usage: parsedAnswer.usage,
          presentation: presentation ?? this.cfg.presentation,
          confidenceSemantics:
            "TypeSafe Choice confidence is derived from the probability distribution across options (see docs.typesafe.ai/confidence). It is NOT a calibrated probability of maliciousness.",
        },
        evidenceSchemaVersion: schemaVer,
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - started);
      const aborted = err instanceof DOMException && err.name === "AbortError";
      return failureResult(
        aborted ? "timeout" : "http_error",
        latencyMs,
        aborted ? `timeout after ${this.cfg.timeoutMs}ms` : String(err),
        {},
        schemaVer,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
