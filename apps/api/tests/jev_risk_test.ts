/**
 * JevRiskAnalyzer adapter tests — mocked network only (no credits).
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { EVIDENCE_SCHEMA_VERSION, type ExecutionEvidenceRecord } from "../src/risk/evidence.ts";
import {
  buildJevRiskState,
  evidenceFactReasons,
  jevStateLooksSafe,
  presentJevState,
} from "../src/risk/jev-input.ts";
import {
  buildJevSystemOneRequest,
  buildProviderHttpFailureMeta,
  credentialAllowedForProvider,
  failureKindFromHttpStatus,
  JevRiskAnalyzer,
  mapChoiceToClassification,
  parseJevChoiceAnswer,
  preflightJevAuth,
  resolveJevRoute,
  sanitizeProviderText,
  TYPESAFE_BASE_URL,
  VERCEL_TYPESAFE_BASE_URL,
} from "../src/risk/jev.ts";
import { classifyEvidence } from "../src/risk/deterministic.ts";
import { classifyEvidenceComparison } from "../src/risk/comparison.ts";
import { createRiskAnalyzer } from "../src/providers/risk.ts";

function baseEvidence(
  overrides: Partial<ExecutionEvidenceRecord> = {},
): ExecutionEvidenceRecord {
  return {
    evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
    executionId: "exec-jev-1",
    traceId: "b".repeat(32),
    script: { language: "javascript", permissionProfile: "none" },
    runtime: {
      runtime: "deno",
      runtimeVersion: "2.9.7",
      containerRuntime: "runc",
      provider: "docker",
      durationMs: 40,
      exitCode: 0,
      timedOut: false,
      outputTruncated: false,
    },
    permissions: {
      accesses: [{
        permission: "ffi",
        target: null,
        source: "deno_permission_audit",
      }],
      failureCategory: "deno_permission",
      auditTruncated: false,
    },
    hostApi: { requested: [], allowed: [], denied: [], queued: [] },
    resources: { timedOut: false, outputTruncated: false },
    termination: { status: "failed", reason: "deno_permission" },
    provenance: ["application", "deno_permission_audit"],
    untrustedContext: {
      stdoutPreview: "should-not-appear-in-jev-state",
      stderrPreview: "secret-looking",
    },
    ...overrides,
  };
}

Deno.test("createRiskAnalyzer(jev) returns JevRiskAnalyzer (not silent deterministic)", () => {
  const a = createRiskAnalyzer("jev");
  assertEquals(a.name, "jev");
});

Deno.test("Jev state excludes untrusted stdout and forbidden research fields", () => {
  const ev = baseEvidence();
  const wider = {
    ...ev,
    scenarioId: "SCN-010",
    expectedResearchLabel: "high",
    holdout: true,
  } as ExecutionEvidenceRecord;
  const state = buildJevRiskState(wider);
  const blob = JSON.stringify(state);
  assertEquals(blob.includes("SCN-010"), false);
  assertEquals(blob.includes("expectedResearchLabel"), false);
  assertEquals(blob.includes("should-not-appear"), false);
  assertEquals(blob.includes("secret-looking"), false);
  assertEquals(jevStateLooksSafe(state), true);
  assertEquals(state.permissions.accesses[0].permission, "ffi");
});

Deno.test("deterministic classification is not part of Jev state", () => {
  const ev = baseEvidence();
  const det = classifyEvidence(ev);
  const state = buildJevRiskState(ev);
  const blob = JSON.stringify(state);
  assertEquals(det.classification != null, true);
  assertEquals(blob.includes(String(det.classification)), false);
  assertEquals(blob.includes("R003"), false);
  assertEquals(blob.includes("ruleMatches"), false);
});

Deno.test("parseJevChoiceAnswer accepts valid Choice and rejects unknown", () => {
  const ok = parseJevChoiceAnswer({
    model: "jev-1.14.0",
    answers: {
      risk_class: {
        type: "choice",
        choice: "high",
        probabilities: { low: 0.05, review: 0.1, high: 0.85 },
        confidence: 0.775,
      },
    },
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  assertEquals(ok.classification, "high");
  assertEquals(ok.confidence, 0.775);
  assertEquals(ok.model, "jev-1.14.0");

  let threw = false;
  try {
    parseJevChoiceAnswer({
      answers: {
        risk_class: { type: "choice", choice: "malicious", confidence: 0.9 },
      },
    });
  } catch (e) {
    threw = true;
    assertStringIncludes(String(e), "unknown_classification");
  }
  assertEquals(threw, true);
  assertEquals(mapChoiceToClassification("REVIEW"), "review");
  assertEquals(mapChoiceToClassification("evil"), null);
});

Deno.test("Jev unavailable without credentials does not invent classification", async () => {
  const analyzer = new JevRiskAnalyzer({ apiKey: null });
  const r = await analyzer.classify(baseEvidence());
  assertEquals(r.provider, "jev");
  assertEquals(r.status, "unavailable");
  assertEquals(r.classification, null);
  assertEquals(r.confidence, null);
  assertEquals(r.failureKind, "missing_credentials");
  assertStringIncludes(
    String(r.providerMetadata.confidenceSemantics),
    "NOT a probability",
  );
});

Deno.test("sanitizeProviderText redacts bearer and key material", () => {
  const s = sanitizeProviderText(
    'Authorization Bearer sk-abc123SECRET and JEV_API_KEY=supersecret value',
  );
  assertEquals(s.includes("sk-abc123SECRET"), false);
  assertEquals(s.includes("supersecret"), false);
  assertStringIncludes(s, "REDACTED");
});

Deno.test("auth_failure includes sanitized provider detail and request id", async () => {
  const analyzer = new JevRiskAnalyzer({
    apiKey: "test-key-not-real",
    endpoint: "https://api.typesafe.ai/v1/systemone",
    model: "jev-latest",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          message: "Invalid API key",
          error: "unauthorized",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "x-request-id": "req-test-123",
          },
        },
      ),
  });
  const r = await analyzer.classify(baseEvidence());
  assertEquals(r.failureKind, "auth_failure");
  assertEquals(r.status, "failed");
  assertEquals(r.providerMetadata.httpStatus, 401);
  assertEquals(r.providerMetadata.requestId, "req-test-123");
  assertEquals(r.providerMetadata.endpoint, "https://api.typesafe.ai/v1/systemone");
  assertEquals(r.providerMetadata.model, "jev-latest");
  assertStringIncludes(String(r.reasons[0]), "Invalid API key");
  assertEquals(JSON.stringify(r).includes("test-key-not-real"), false);
  assertEquals(JSON.stringify(r.providerMetadata).includes("Bearer"), false);
});

Deno.test("buildProviderHttpFailureMeta never embeds Authorization secrets", () => {
  const meta = buildProviderHttpFailureMeta({
    httpStatus: 401,
    endpoint: "https://api.typesafe.ai/v1/systemone",
    model: "jev-latest",
    responseText: JSON.stringify({
      message: "Bearer sk-leakytoken was bad",
    }),
    headers: { get: (n: string) => n === "x-request-id" ? "abc" : null },
  });
  assertEquals(meta.requestId, "abc");
  assertEquals(String(meta.providerMessage).includes("sk-leakytoken"), false);
  assertEquals(meta.authorization, "REDACTED");
});

Deno.test("preflightJevAuth reports 200 as ok without System One body", async () => {
  const r = await preflightJevAuth({
    apiKey: "test-key",
    fetchImpl: async (url) => {
      assertStringIncludes(String(url), "/v1/models");
      return new Response(
        JSON.stringify({
          models: [{ name: "jev-latest", description: "x", release_date: "2026" }],
        }),
        { status: 200 },
      );
    },
  });
  assertEquals(r.ok, true);
  assertEquals(r.authentication, "ok");
  assertEquals(r.httpStatus, 200);
  assertEquals(r.modelNames?.[0], "jev-latest");
});

Deno.test("preflightJevAuth reports 401 as rejected", async () => {
  const r = await preflightJevAuth({
    apiKey: "bad-key",
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "Invalid API key" }), {
        status: 401,
        headers: { "x-request-id": "pf-1" },
      }),
  });
  assertEquals(r.ok, false);
  assertEquals(r.authentication, "rejected");
  assertEquals(r.httpStatus, 401);
  assertEquals(r.requestId, "pf-1");
  assertStringIncludes(String(r.providerMessage), "Invalid API key");
});

Deno.test("invalid Jev output is rejected (mocked fetch)", async () => {
  const analyzer = new JevRiskAnalyzer({
    apiKey: "test-key-not-real",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          model: "jev-1.14.0",
          answers: {
            risk_class: {
              type: "choice",
              choice: "probably_fine",
              confidence: 0.5,
            },
          },
        }),
        { status: 200 },
      ),
  });
  const r = await analyzer.classify(baseEvidence());
  assertEquals(r.status, "failed");
  assertEquals(r.classification, null);
  assertEquals(r.failureKind, "unknown_classification");
});

Deno.test("timeout is handled as provider failure", async () => {
  const analyzer = new JevRiskAnalyzer({
    apiKey: "test-key-not-real",
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
  });
  const r = await analyzer.classify(baseEvidence());
  assertEquals(r.status, "failed");
  assertEquals(r.failureKind, "timeout");
  assertEquals(r.classification, null);
});

Deno.test("serialized System One request excludes labels and deterministic output", () => {
  const ev = baseEvidence();
  const det = classifyEvidence(ev);
  const built = buildJevSystemOneRequest(ev, { presentation: "canonical" });
  const stateBlob = JSON.stringify(built.body.state);
  const payload = JSON.stringify(built.body);
  assertEquals(built.integrity.safe, true);
  assertEquals(built.integrity.forbiddenHits.length, 0);
  for (const leak of [
    "scenarioId",
    "expectedResearchLabel",
    "referenceLabel",
    "corpusType",
    "holdout",
    "ruleMatches",
    "R003",
    "should-not-appear",
    "HOST_CAPABILITY_TOKEN",
    "JEV_API_KEY",
  ]) {
    assertEquals(payload.includes(leak), false, `leak=${leak}`);
  }
  // Deterministic reasons / rule IDs must not appear in state.
  for (const reason of det.reasons) {
    assertEquals(stateBlob.includes(reason), false);
  }
  assertEquals(built.body.questions.risk_class.type, "choice");
  assertEquals(
    Object.keys(built.body.questions.risk_class.criteria).sort().join(","),
    "high,low,review",
  );
});

Deno.test("comparison runs analyzers independently; Jev never sees det output", async () => {
  let capturedBody: string | null = null;
  const analyzerFetch: typeof fetch = async (_url, init) => {
    capturedBody = String(init?.body ?? "");
    return new Response(
      JSON.stringify({
        model: "jev-1.14.0",
        answers: {
          risk_class: {
            type: "choice",
            choice: "high",
            probabilities: { low: 0, review: 0.1, high: 0.9 },
            confidence: 0.85,
          },
        },
      }),
      { status: 200 },
    );
  };

  const cmp = await classifyEvidenceComparison(baseEvidence(), {
    jev: { apiKey: "k", fetchImpl: analyzerFetch },
  });
  assertEquals(cmp.deterministic.classification, "high");
  assertEquals(cmp.jev.classification, "high");
  assertEquals(capturedBody != null, true);
  assertEquals(capturedBody!.includes("deterministic"), false);
  assertEquals(capturedBody!.includes("R003"), false);
  assertEquals(capturedBody!.includes("ruleMatches"), false);
  assertEquals(capturedBody!.includes("expectedResearchLabel"), false);
  assertEquals(capturedBody!.includes("scenarioId"), false);
});

Deno.test("evidence fact reasons reference observables only", () => {
  const facts = evidenceFactReasons(baseEvidence());
  assertEquals(facts.some((f) => f.includes("ffi")), true);
  assertEquals(facts.some((f) => /malware|intent|malicious/i.test(f)), false);
});

Deno.test("sensitivity presentations preserve factual values", () => {
  const state = buildJevRiskState(baseEvidence());
  const reordered = presentJevState(state, "reordered");
  const notes = presentJevState(state, "compact_notes");
  assertEquals(
    JSON.stringify(reordered.permissions),
    JSON.stringify(state.permissions),
  );
  assertEquals(
    JSON.stringify((notes as { evidence: unknown }).evidence),
    JSON.stringify(state),
  );
});

Deno.test("repeated classifications stay separate objects", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls++;
    const choice = calls === 1 ? "review" : "high";
    return new Response(
      JSON.stringify({
        model: "jev-1.14.0",
        answers: {
          risk_class: {
            type: "choice",
            choice,
            probabilities: { low: 0.1, review: 0.4, high: 0.5 },
            confidence: 0.25,
          },
        },
      }),
      { status: 200 },
    );
  };
  const analyzer = new JevRiskAnalyzer({ apiKey: "k", fetchImpl });
  const a = await analyzer.classify(baseEvidence());
  const b = await analyzer.classify(baseEvidence());
  assertEquals(a.classification, "review");
  assertEquals(b.classification, "high");
  assertEquals(calls, 2);
});

Deno.test("vercel provider uses AI_GATEWAY_API_KEY and gateway baseURL", () => {
  const prev = {
    provider: Deno.env.get("JEV_PROVIDER"),
    gw: Deno.env.get("AI_GATEWAY_API_KEY"),
    ts: Deno.env.get("TYPESAFE_API_KEY"),
    jev: Deno.env.get("JEV_API_KEY"),
    model: Deno.env.get("JEV_MODEL"),
  };
  try {
    Deno.env.set("JEV_PROVIDER", "vercel");
    Deno.env.set("AI_GATEWAY_API_KEY", "vck_test_gateway_only_key_xxxx");
    Deno.env.delete("TYPESAFE_API_KEY");
    Deno.env.delete("JEV_API_KEY");
    Deno.env.delete("JEV_MODEL");
    const route = resolveJevRoute();
    assertEquals(route.provider, "vercel");
    assertEquals(route.baseURL, VERCEL_TYPESAFE_BASE_URL);
    assertEquals(route.baseURL, "https://ai-gateway.vercel.sh/typesafe");
    assertEquals(route.systemOneUrl, `${VERCEL_TYPESAFE_BASE_URL}/v1/systemone`);
    assertEquals(route.modelsUrl, `${VERCEL_TYPESAFE_BASE_URL}/v1/models`);
    assertEquals(route.credentialSource, "AI_GATEWAY_API_KEY");
    assertEquals(route.apiKey, "vck_test_gateway_only_key_xxxx");
    assertEquals(route.model, "typesafe-ai/jev-1.14.0");
    assertEquals(
      credentialAllowedForProvider("vercel", route.credentialSource),
      true,
    );
  } finally {
    restoreEnv(prev);
  }
});

Deno.test("typesafe provider uses TypeSafe credential and api.typesafe.ai", () => {
  const prev = {
    provider: Deno.env.get("JEV_PROVIDER"),
    gw: Deno.env.get("AI_GATEWAY_API_KEY"),
    ts: Deno.env.get("TYPESAFE_API_KEY"),
    jev: Deno.env.get("JEV_API_KEY"),
    model: Deno.env.get("JEV_MODEL"),
  };
  try {
    Deno.env.set("JEV_PROVIDER", "typesafe");
    Deno.env.set("TYPESAFE_API_KEY", "ts_direct_key_xxxx");
    Deno.env.set("AI_GATEWAY_API_KEY", "vck_must_not_be_used");
    Deno.env.delete("JEV_API_KEY");
    Deno.env.delete("JEV_MODEL");
    const route = resolveJevRoute();
    assertEquals(route.provider, "typesafe");
    assertEquals(route.baseURL, TYPESAFE_BASE_URL);
    assertEquals(route.baseURL, "https://api.typesafe.ai");
    assertEquals(route.systemOneUrl, `${TYPESAFE_BASE_URL}/v1/systemone`);
    assertEquals(route.credentialSource, "TYPESAFE_API_KEY");
    assertEquals(route.apiKey, "ts_direct_key_xxxx");
    assertEquals(route.apiKey?.includes("vck_"), false);
    assertEquals(route.model, "jev-latest");
  } finally {
    restoreEnv(prev);
  }
});

Deno.test("credentials cannot cross provider routes", () => {
  const prev = {
    provider: Deno.env.get("JEV_PROVIDER"),
    gw: Deno.env.get("AI_GATEWAY_API_KEY"),
    ts: Deno.env.get("TYPESAFE_API_KEY"),
    jev: Deno.env.get("JEV_API_KEY"),
    model: Deno.env.get("JEV_MODEL"),
  };
  try {
    // Vercel must ignore TypeSafe / legacy JEV keys
    Deno.env.set("JEV_PROVIDER", "vercel");
    Deno.env.delete("AI_GATEWAY_API_KEY");
    Deno.env.set("TYPESAFE_API_KEY", "ts_only");
    Deno.env.set("JEV_API_KEY", "jev_only");
    const vercel = resolveJevRoute();
    assertEquals(vercel.provider, "vercel");
    assertEquals(vercel.apiKey, null);
    assertEquals(vercel.credentialSource, null);
    assertEquals(vercel.baseURL, VERCEL_TYPESAFE_BASE_URL);
    assertEquals(
      credentialAllowedForProvider("vercel", "TYPESAFE_API_KEY"),
      false,
    );
    assertEquals(credentialAllowedForProvider("vercel", "JEV_API_KEY"), false);

    // TypeSafe must ignore AI_GATEWAY_API_KEY
    Deno.env.set("JEV_PROVIDER", "typesafe");
    Deno.env.set("AI_GATEWAY_API_KEY", "vck_gateway_only");
    Deno.env.delete("TYPESAFE_API_KEY");
    Deno.env.delete("JEV_API_KEY");
    const ts = resolveJevRoute();
    assertEquals(ts.provider, "typesafe");
    assertEquals(ts.apiKey, null);
    assertEquals(ts.credentialSource, null);
    assertEquals(ts.baseURL, TYPESAFE_BASE_URL);
    assertEquals(
      credentialAllowedForProvider("typesafe", "AI_GATEWAY_API_KEY"),
      false,
    );
  } finally {
    restoreEnv(prev);
  }
});

Deno.test("vercel analyzer POSTs System One to gateway URL only", async () => {
  let postedUrl = "";
  const analyzer = new JevRiskAnalyzer({
    provider: "vercel",
    apiKey: "vck_test_key",
    fetchImpl: async (url) => {
      postedUrl = String(url);
      return new Response(
        JSON.stringify({
          model: "typesafe-ai/jev-1.14.0",
          answers: {
            risk_class: {
              type: "choice",
              choice: "low",
              probabilities: { low: 0.9, review: 0.05, high: 0.05 },
              confidence: 0.8,
            },
          },
        }),
        { status: 200 },
      );
    },
  });
  const r = await analyzer.classify(baseEvidence());
  assertEquals(r.status, "ok");
  assertEquals(postedUrl, "https://ai-gateway.vercel.sh/typesafe/v1/systemone");
  assertEquals(r.providerMetadata.provider, "vercel");
  assertEquals(r.providerMetadata.baseURL, VERCEL_TYPESAFE_BASE_URL);
  assertEquals(r.providerMetadata.requestedModel, "typesafe-ai/jev-1.14.0");
  assertEquals(r.providerMetadata.responseModel, "typesafe-ai/jev-1.14.0");
  assertEquals(JSON.stringify(r).includes("vck_test_key"), false);
});

Deno.test("typesafe analyzer POSTs System One to api.typesafe.ai only", async () => {
  let postedUrl = "";
  const analyzer = new JevRiskAnalyzer({
    provider: "typesafe",
    apiKey: "ts_test_key",
    fetchImpl: async (url) => {
      postedUrl = String(url);
      return new Response(
        JSON.stringify({
          model: "jev-latest",
          answers: {
            risk_class: {
              type: "choice",
              choice: "review",
              probabilities: { low: 0.2, review: 0.7, high: 0.1 },
              confidence: 0.5,
            },
          },
        }),
        { status: 200 },
      );
    },
  });
  const r = await analyzer.classify(baseEvidence());
  assertEquals(r.status, "ok");
  assertEquals(postedUrl, "https://api.typesafe.ai/v1/systemone");
  assertEquals(r.providerMetadata.provider, "typesafe");
  assertEquals(JSON.stringify(r).includes("ts_test_key"), false);
});

Deno.test("401 maps to auth_failure; 402 maps to billing_failure", async () => {
  assertEquals(failureKindFromHttpStatus(401), "auth_failure");
  assertEquals(failureKindFromHttpStatus(403), "auth_failure");
  assertEquals(failureKindFromHttpStatus(402), "billing_failure");
  assertEquals(failureKindFromHttpStatus(500), "http_error");

  const auth = new JevRiskAnalyzer({
    provider: "vercel",
    apiKey: "k",
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "Invalid API key" }), {
        status: 401,
      }),
  });
  const authR = await auth.classify(baseEvidence());
  assertEquals(authR.failureKind, "auth_failure");
  assertEquals(authR.providerMetadata.httpStatus, 401);

  const bill = new JevRiskAnalyzer({
    provider: "vercel",
    apiKey: "k",
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "Insufficient credits" }), {
        status: 402,
      }),
  });
  const billR = await bill.classify(baseEvidence());
  assertEquals(billR.failureKind, "billing_failure");
  assertEquals(billR.providerMetadata.httpStatus, 402);
  // 401 must never be treated as billing
  assertEquals(authR.failureKind === "billing_failure", false);

  // Vercel Gateway: same key can list models but System One needs card/credits
  const verify = new JevRiskAnalyzer({
    provider: "vercel",
    apiKey: "k",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "AI Gateway requires a valid credit card on file",
            type: "customer_verification_required",
          },
        }),
        { status: 403 },
      ),
  });
  const verifyR = await verify.classify(baseEvidence());
  assertEquals(verifyR.failureKind, "billing_failure");
  assertEquals(verifyR.providerMetadata.httpStatus, 403);
});

Deno.test("preflight vercel uses gateway models URL; typesafe uses direct", async () => {
  let vercelUrl = "";
  const v = await preflightJevAuth({
    provider: "vercel",
    apiKey: "gw",
    fetchImpl: async (url) => {
      vercelUrl = String(url);
      return new Response(JSON.stringify({ models: [] }), { status: 200 });
    },
  });
  assertEquals(v.provider, "vercel");
  assertEquals(v.baseURL, VERCEL_TYPESAFE_BASE_URL);
  assertEquals(vercelUrl, `${VERCEL_TYPESAFE_BASE_URL}/v1/models`);
  assertEquals(v.credentialSource, "AI_GATEWAY_API_KEY");

  let tsUrl = "";
  const t = await preflightJevAuth({
    provider: "typesafe",
    apiKey: "ts",
    fetchImpl: async (url) => {
      tsUrl = String(url);
      return new Response(JSON.stringify({ models: [] }), { status: 200 });
    },
  });
  assertEquals(t.provider, "typesafe");
  assertEquals(t.baseURL, TYPESAFE_BASE_URL);
  assertEquals(tsUrl, `${TYPESAFE_BASE_URL}/v1/models`);
});

Deno.test("sanitizeProviderText redacts Vercel gateway-style keys", () => {
  const s = sanitizeProviderText(
    "AI_GATEWAY_API_KEY=vck_52o5yfLgIrEOWLFfaKELHEB59qe and Bearer vck_abcdefghi1234567890",
  );
  assertEquals(s.includes("vck_52o5yfLg"), false);
  assertEquals(s.includes("vck_abcdefghi"), false);
  assertStringIncludes(s, "REDACTED");
});

function restoreEnv(prev: {
  provider: string | undefined;
  gw: string | undefined;
  ts: string | undefined;
  jev: string | undefined;
  model: string | undefined;
}) {
  const apply = (name: string, v: string | undefined) => {
    if (v === undefined) Deno.env.delete(name);
    else Deno.env.set(name, v);
  };
  apply("JEV_PROVIDER", prev.provider);
  apply("AI_GATEWAY_API_KEY", prev.gw);
  apply("TYPESAFE_API_KEY", prev.ts);
  apply("JEV_API_KEY", prev.jev);
  apply("JEV_MODEL", prev.model);
}
