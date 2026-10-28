/**
 * Provider-aware TypeSafe / Jev authentication preflight.
 *
 * Uses GET {baseURL}/v1/models — never System One classification.
 * Never prints API keys.
 *
 * Usage:
 *   npm run jev:preflight
 *   node scripts/jev-preflight.mjs
 *   node scripts/jev-preflight.mjs --direct
 *
 * Env:
 *   JEV_PROVIDER=typesafe|vercel
 *   typesafe → TYPESAFE_API_KEY or JEV_API_KEY + api.typesafe.ai
 *   vercel   → AI_GATEWAY_API_KEY + ai-gateway.vercel.sh/typesafe
 */

const api = process.env.API_URL || "http://localhost:3000";
const direct = process.argv.includes("--direct");

function redact(s) {
  return String(s ?? "")
    .replace(/(Bearer\s+)[^\s"']+/gi, "$1REDACTED")
    .replace(
      /((?:JEV_API_KEY|TYPESAFE_API_KEY|AI_GATEWAY_API_KEY)\s*[=:]\s*)\S+/gi,
      "$1REDACTED",
    )
    .replace(/(?:sk-|vck_)[A-Za-z0-9_-]{8,}/g, "REDACTED");
}

function resolveDirectRoute() {
  const provider = (process.env.JEV_PROVIDER || "typesafe").trim().toLowerCase();
  const isVercel = provider === "vercel" || provider === "ai-gateway" ||
    provider === "gateway";
  if (isVercel) {
    const key = process.env.AI_GATEWAY_API_KEY || "";
    return {
      provider: "vercel",
      baseURL: "https://ai-gateway.vercel.sh/typesafe",
      modelsUrl: "https://ai-gateway.vercel.sh/typesafe/v1/models",
      systemOneEndpoint: "https://ai-gateway.vercel.sh/typesafe/v1/systemone",
      configuredModel: process.env.JEV_MODEL || "typesafe-ai/jev-1.14.0",
      key,
      credentialSource: key ? "AI_GATEWAY_API_KEY" : null,
      missing:
        "JEV_PROVIDER=vercel requires AI_GATEWAY_API_KEY (not TYPESAFE_API_KEY / JEV_API_KEY)",
    };
  }
  const key = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY || "";
  const source = process.env.TYPESAFE_API_KEY
    ? "TYPESAFE_API_KEY"
    : process.env.JEV_API_KEY
    ? "JEV_API_KEY"
    : null;
  return {
    provider: "typesafe",
    baseURL: "https://api.typesafe.ai",
    modelsUrl: "https://api.typesafe.ai/v1/models",
    systemOneEndpoint: "https://api.typesafe.ai/v1/systemone",
    configuredModel: process.env.JEV_MODEL || "jev-latest",
    key,
    credentialSource: key ? source : null,
    missing:
      "JEV_PROVIDER=typesafe requires TYPESAFE_API_KEY or JEV_API_KEY (not AI_GATEWAY_API_KEY)",
  };
}

async function viaApi() {
  const res = await fetch(`${api}/api/research/jev-preflight`);
  const body = await res.json().catch(() => ({}));
  return { httpOk: res.ok, status: res.status, body };
}

async function viaDirect() {
  const route = resolveDirectRoute();
  if (!route.key) {
    return {
      httpOk: false,
      status: 0,
      body: {
        ok: false,
        authentication: "missing_credentials",
        httpStatus: null,
        provider: route.provider,
        baseURL: route.baseURL,
        modelsUrl: route.modelsUrl,
        systemOneEndpoint: route.systemOneEndpoint,
        configuredModel: route.configuredModel,
        credentialSource: null,
        keyLength: 0,
        providerMessage: route.missing,
        note: "Set the provider-specific credential for --direct.",
      },
    };
  }
  const started = Date.now();
  const res = await fetch(route.modelsUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${route.key}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  const requestId = res.headers.get("x-request-id") ||
    res.headers.get("request-id") ||
    res.headers.get("cf-ray") ||
    null;
  let providerMessage = null;
  let modelNames = null;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.message === "string") {
      providerMessage = redact(parsed.message);
    } else if (parsed.error) {
      providerMessage = redact(
        typeof parsed.error === "string"
          ? parsed.error
          : JSON.stringify(parsed.error),
      );
    }
    if (Array.isArray(parsed.models)) {
      modelNames = parsed.models.map((m) => m.name).filter(Boolean);
    }
  } catch {
    if (text) providerMessage = redact(text).slice(0, 400);
  }
  const authentication = res.status === 200
    ? "ok"
    : res.status === 401 || res.status === 403
    ? "rejected"
    : res.status === 402
    ? "billing"
    : "error";
  return {
    httpOk: res.status === 200,
    status: res.status,
    body: {
      ok: res.status === 200,
      authentication,
      httpStatus: res.status,
      provider: route.provider,
      baseURL: route.baseURL,
      modelsUrl: route.modelsUrl,
      systemOneEndpoint: route.systemOneEndpoint,
      configuredModel: route.configuredModel,
      requestId,
      providerMessage,
      modelNames,
      latencyMs: Date.now() - started,
      credentialSource: route.credentialSource,
      keyLength: route.key.length,
      note: "Direct preflight. No System One classification call was made.",
    },
  };
}

async function main() {
  let result;
  try {
    result = direct ? await viaDirect() : await viaApi();
  } catch (err) {
    console.error("Preflight failed to reach API/provider:");
    console.error(redact(String(err)));
    if (!direct) {
      console.error(
        `\nIs the API up? Try: docker compose up -d api\nOr: node scripts/jev-preflight.mjs --direct`,
      );
    }
    process.exit(1);
  }

  const b = result.body;
  console.log("--- Jev authentication preflight ---");
  console.log(`provider:          ${b.provider ?? "-"}`);
  console.log(`baseURL:           ${b.baseURL ?? "-"}`);
  console.log(`modelsUrl:         ${b.modelsUrl ?? "-"}`);
  console.log(`systemOne:         ${b.systemOneEndpoint ?? "-"}`);
  console.log(`configuredModel:   ${b.configuredModel ?? "-"}`);
  console.log(`credentialSource:  ${b.credentialSource ?? "none"}`);
  console.log(`keyLength:         ${b.keyLength ?? 0} (value not shown)`);
  console.log(`authentication:    ${b.authentication}`);
  console.log(`httpStatus:        ${b.httpStatus}`);
  console.log(`requestId:         ${b.requestId ?? "-"}`);
  console.log(`latencyMs:         ${b.latencyMs ?? "-"}`);
  if (b.providerMessage) {
    console.log(`providerMessage:   ${redact(b.providerMessage)}`);
  }
  if (Array.isArray(b.modelNames) && b.modelNames.length) {
    console.log(`models:            ${b.modelNames.join(", ")}`);
  }
  console.log(`note:              ${b.note ?? ""}`);
  console.log("\nNo System One classification / evaluation calls were made.");
  console.log(
    "Credentials are provider-specific — do not copy the same key across routes.",
  );

  if (b.authentication === "ok") process.exit(0);
  if (b.authentication === "rejected") process.exit(2);
  if (b.authentication === "missing_credentials") process.exit(3);
  if (b.authentication === "billing") process.exit(4);
  process.exit(1);
}

main();
