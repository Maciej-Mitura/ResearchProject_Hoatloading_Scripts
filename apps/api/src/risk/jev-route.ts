/**
 * Explicit Jev / TypeSafe provider routes.
 *
 * Credentials are NOT interchangeable across providers.
 * JEV_PROVIDER must be set explicitly — we do not guess from which secret exists.
 */

export type JevProviderKind = "typesafe" | "vercel";

export type JevCredentialSource =
  | "TYPESAFE_API_KEY"
  | "JEV_API_KEY"
  | "AI_GATEWAY_API_KEY";

export const TYPESAFE_BASE_URL = "https://api.typesafe.ai";
export const VERCEL_TYPESAFE_BASE_URL = "https://ai-gateway.vercel.sh/typesafe";

export const TYPESAFE_DEFAULT_MODEL = "jev-latest";
/**
 * Vercel AI Gateway model id for Jev (docs.vercel.com/ai-gateway/sdks-and-apis/typesafe).
 * Pinned to 1.14.0 for research reproducibility — not the moving `typesafe-ai/jev` alias.
 * Models list may show short name `jev-1.14.0`; System One request body uses the gateway id.
 */
export const VERCEL_DEFAULT_MODEL = "typesafe-ai/jev-1.14.0";
/** Short name as returned by GET …/typesafe/v1/models (mapping only; not used as request id). */
export const VERCEL_JEV_114_LIST_NAME = "jev-1.14.0";

export interface ResolvedJevRoute {
  provider: JevProviderKind;
  baseURL: string;
  systemOneUrl: string;
  modelsUrl: string;
  apiKey: string | null;
  credentialSource: JevCredentialSource | null;
  keyLength: number;
  model: string;
  /** Human-readable missing-credential hint (no secrets). */
  missingCredentialHint: string;
}

function envNonEmpty(name: string): string | null {
  const v = Deno.env.get(name);
  return v != null && v !== "" ? v : null;
}

/**
 * Resolve JEV_PROVIDER. Default `typesafe` for backward compatibility.
 * Does not infer provider from which API key is present.
 */
export function resolveJevProvider(
  explicit?: JevProviderKind | string | null,
): JevProviderKind {
  const raw = (explicit ?? Deno.env.get("JEV_PROVIDER") ?? "typesafe")
    .trim()
    .toLowerCase();
  if (raw === "vercel" || raw === "ai-gateway" || raw === "gateway") {
    return "vercel";
  }
  if (raw === "typesafe" || raw === "direct" || raw === "jev") {
    return "typesafe";
  }
  // Unknown value → typesafe (safe default); callers may log a warning.
  return "typesafe";
}

/**
 * Resolve route + credential for the selected provider.
 *
 * - typesafe → TYPESAFE_API_KEY or legacy JEV_API_KEY; base api.typesafe.ai
 * - vercel   → AI_GATEWAY_API_KEY only; base ai-gateway.vercel.sh/typesafe
 *
 * Never cross-wires credentials between providers.
 */
export function resolveJevRoute(opts: {
  provider?: JevProviderKind | string | null;
  apiKey?: string | null;
  /** When true, explicit apiKey:null disables credentials even if env is set. */
  apiKeyExplicit?: boolean;
  model?: string | null;
  /** Optional full System One URL override (advanced). */
  systemOneUrlOverride?: string | null;
  modelsUrlOverride?: string | null;
} = {}): ResolvedJevRoute {
  const provider = resolveJevProvider(opts.provider);

  if (provider === "vercel") {
    const baseURL = VERCEL_TYPESAFE_BASE_URL;
    let apiKey: string | null = null;
    let credentialSource: JevCredentialSource | null = null;

    if (opts.apiKeyExplicit) {
      apiKey = opts.apiKey != null && opts.apiKey !== "" ? opts.apiKey : null;
      credentialSource = apiKey ? "AI_GATEWAY_API_KEY" : null;
    } else if (opts.apiKey != null && opts.apiKey !== "") {
      apiKey = opts.apiKey;
      credentialSource = "AI_GATEWAY_API_KEY";
    } else {
      const gw = envNonEmpty("AI_GATEWAY_API_KEY");
      if (gw) {
        apiKey = gw;
        credentialSource = "AI_GATEWAY_API_KEY";
      }
    }

    const model = opts.model?.trim() ||
      envNonEmpty("JEV_MODEL") ||
      VERCEL_DEFAULT_MODEL;

    return {
      provider: "vercel",
      baseURL,
      systemOneUrl: opts.systemOneUrlOverride?.trim() ||
        `${baseURL}/v1/systemone`,
      modelsUrl: opts.modelsUrlOverride?.trim() || `${baseURL}/v1/models`,
      apiKey,
      credentialSource,
      keyLength: apiKey?.length ?? 0,
      model,
      missingCredentialHint:
        "JEV_PROVIDER=vercel requires AI_GATEWAY_API_KEY (do not use TYPESAFE_API_KEY / JEV_API_KEY on this route)",
    };
  }

  // Direct TypeSafe
  const baseURL = TYPESAFE_BASE_URL;
  let apiKey: string | null = null;
  let credentialSource: JevCredentialSource | null = null;

  if (opts.apiKeyExplicit) {
    apiKey = opts.apiKey != null && opts.apiKey !== "" ? opts.apiKey : null;
    credentialSource = apiKey ? "TYPESAFE_API_KEY" : null;
  } else if (opts.apiKey != null && opts.apiKey !== "") {
    apiKey = opts.apiKey;
    credentialSource = "TYPESAFE_API_KEY";
  } else {
    const ts = envNonEmpty("TYPESAFE_API_KEY");
    const jev = envNonEmpty("JEV_API_KEY");
    if (ts) {
      apiKey = ts;
      credentialSource = "TYPESAFE_API_KEY";
    } else if (jev) {
      // Legacy alias for direct TypeSafe only — never used for Vercel.
      apiKey = jev;
      credentialSource = "JEV_API_KEY";
    }
  }

  const model = opts.model?.trim() ||
    envNonEmpty("JEV_MODEL") ||
    TYPESAFE_DEFAULT_MODEL;

  return {
    provider: "typesafe",
    baseURL,
    systemOneUrl: opts.systemOneUrlOverride?.trim() ||
      `${baseURL}/v1/systemone`,
    modelsUrl: opts.modelsUrlOverride?.trim() || `${baseURL}/v1/models`,
    apiKey,
    credentialSource,
    keyLength: apiKey?.length ?? 0,
    model,
    missingCredentialHint:
      "JEV_PROVIDER=typesafe requires TYPESAFE_API_KEY or JEV_API_KEY (do not use AI_GATEWAY_API_KEY on this route)",
  };
}

/** Assert a credential source is valid for a provider (tests / guards). */
export function credentialAllowedForProvider(
  provider: JevProviderKind,
  source: JevCredentialSource | null,
): boolean {
  if (!source) return false;
  if (provider === "vercel") return source === "AI_GATEWAY_API_KEY";
  return source === "TYPESAFE_API_KEY" || source === "JEV_API_KEY";
}
