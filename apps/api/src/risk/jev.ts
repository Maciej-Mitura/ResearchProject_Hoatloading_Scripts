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

export const JEV_ANALYZER_VERSION = "1" as const;
export const JEV_DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_DEFAULT_MODEL = "jev-latest";
export const JEV_CHOICE_OPTIONS = ["low", "review", "high"] as const;

export type JevFailureKind =
  | "missing_credentials"
  | "timeout"
  | "http_error"
  | "rate_limited"
  | "auth_failure"
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
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
  /** Injected for tests — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  policyText?: string;
  presentation?: JevStatePresentation;
}

function readApiKey(explicit?: string | null): string | null {
  if (explicit != null && explicit !== "") return explicit;
  return (
    Deno.env.get("JEV_API_KEY") ??
      Deno.env.get("TYPESAFE_API_KEY") ??
      null
  );
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
  const model = opts.model ?? Deno.env.get("JEV_MODEL") ?? JEV_DEFAULT_MODEL;
  const endpoint = Deno.env.get("JEV_API_URL") ?? JEV_DEFAULT_ENDPOINT;
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
  private readonly cfg: Required<
    Pick<
      JevClientConfig,
      "endpoint" | "model" | "timeoutMs" | "presentation"
    >
  > & {
    apiKey: string | null;
    fetchImpl: typeof fetch;
    policyText: string;
  };

  constructor(config: JevClientConfig = {}) {
    this.cfg = {
      apiKey: readApiKey(config.apiKey),
      endpoint: config.endpoint ??
        Deno.env.get("JEV_API_URL") ??
        JEV_DEFAULT_ENDPOINT,
      model: config.model ?? Deno.env.get("JEV_MODEL") ?? JEV_DEFAULT_MODEL,
      timeoutMs: config.timeoutMs ??
        Number(Deno.env.get("JEV_TIMEOUT_MS") ?? "30000"),
      fetchImpl: config.fetchImpl ?? fetch,
      policyText: config.policyText ?? DEFAULT_JEV_POLICY,
      presentation: config.presentation ?? "canonical",
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
        "JEV_API_KEY / TYPESAFE_API_KEY not configured",
        { endpoint: this.cfg.endpoint, model: this.cfg.model },
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
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        return failureResult(
          "parse_failure",
          latencyMs,
          `Non-JSON response HTTP ${res.status}`,
          { httpStatus: res.status },
          schemaVer,
        );
      }

      if (res.status === 401 || res.status === 403) {
        return failureResult(
          "auth_failure",
          latencyMs,
          `HTTP ${res.status}`,
          { httpStatus: res.status },
          schemaVer,
        );
      }
      if (res.status === 429 || res.status === 529) {
        return failureResult(
          "rate_limited",
          latencyMs,
          `HTTP ${res.status}`,
          { httpStatus: res.status },
          schemaVer,
        );
      }
      if (!res.ok) {
        return failureResult(
          "http_error",
          latencyMs,
          `HTTP ${res.status}`,
          { httpStatus: res.status },
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
        return failureResult(kind, latencyMs, msg, { httpStatus: res.status }, schemaVer);
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
          endpoint: this.cfg.endpoint,
          requestedModel: this.cfg.model,
          responseModel: parsedAnswer.model,
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
