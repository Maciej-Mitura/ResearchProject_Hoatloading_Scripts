import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildJevSystemOneRequest,
  JevRiskAnalyzer,
  parseJevChoiceAnswer,
} from "../src/risk/jev.ts";
import { jevStateLooksSafe } from "../src/risk/jev-input.ts";
import { resolveJevRoute } from "../src/risk/jev-route.ts";
import { validateFrozenInputs } from "../../../scripts/validate-jev-inputs.ts";
import { buildExecutionEvidenceRecord } from "../src/risk/evidence.ts";
import type { ExecutionEvidenceRecord } from "../src/risk/evidence.ts";
function evidence(): ExecutionEvidenceRecord {
  return buildExecutionEvidenceRecord({
    executionId: "test",
    status: "completed",
    language: "javascript",
    permissionProfile: "host-chat",
    result: {
      provider: "docker",
      exitCode: 0,
      runtimeVersion: "2.9.7",
      permissionEvents: [{
        permission: "env",
        target: "HOST_CAPABILITY_TOKEN",
      }],
      manifest: { permissionProfile: "host-chat", dockerRuntime: "runc" },
    },
  });
}
Deno.test("env secret NAME is allowed, actual secret VALUES and forbidden fields are rejected", () => {
  const e = evidence();
  const built = buildJevSystemOneRequest(e);
  assertEquals(built.integrity.safe, true);
  assertEquals(
    JSON.stringify(built.body.state).includes("HOST_CAPABILITY_TOKEN"),
    true,
  );
  assertEquals(
    jevStateLooksSafe({ ...built.body.state, stdout: "secret" }),
    false,
  );
  assertEquals(
    jevStateLooksSafe({ ...built.body.state, token: "opaque-credential" }),
    false,
  );
  assertEquals(
    jevStateLooksSafe({
      note: "HOST_CAPABILITY_TOKEN is an environment variable name",
    }),
    true,
  );
  assertEquals(
    jevStateLooksSafe({ note: "HOST_CAPABILITY_TOKEN=actual-secret-value" }),
    false,
  );
  assertEquals(
    jevStateLooksSafe({ note: "opaque-known-value" }, ["opaque-known-value"]),
    false,
  );
  for (const secret of ["a".repeat(64), "sk-provider-key-material-123456789"]) {
    e.permissions.accesses.push({
      permission: "env",
      target: secret,
      source: "deno_permission_audit",
    });
    assertEquals(buildJevSystemOneRequest(e).integrity.safe, false);
    e.permissions.accesses.pop();
  }
});
Deno.test("current requests carry stable policy/schema/model/transform provenance and do not truncate observations", () => {
  const e = evidence();
  const built = buildJevSystemOneRequest(e, { provider: "vercel" });
  assertEquals(built.provenance.policySource, "config/jev-risk-policy-v2.md");
  assertEquals(built.provenance.policyHash.length, 64);
  assertEquals(built.provenance.inputSchemaVersion, 2);
  assertEquals(built.provenance.transformationVersion, "2");
  assertEquals(built.provenance.requestedModel, "typesafe-ai/jev-1.14.0");
  assertEquals(
    built.provenance.transformation.auditCollection.status,
    "legacy_unknown",
  );
  e.permissions.accesses = Array.from(
    { length: 60 },
    () => ({
      permission: "read",
      target: "/fixtures/allowed.txt",
      source: "deno_permission_audit",
    }),
  );
  assertEquals(
    buildJevSystemOneRequest(e).provenance.transformation
      .sentPermissionAccessCount,
    60,
  );
});
Deno.test("Jev configuration rejects moving model, unknown provider and credential-route mismatch", () => {
  assertThrows(() => resolveJevRoute({ provider: "unknown" }));
  assertThrows(() =>
    resolveJevRoute({ provider: "typesafe", model: "jev-latest" })
  );
  assertThrows(() =>
    resolveJevRoute({ provider: "vercel", model: "jev-1.14.0" })
  );
  assertThrows(() =>
    resolveJevRoute({
      provider: "vercel",
      systemOneUrlOverride: "https://api.typesafe.ai/v1/systemone",
    })
  );
});
Deno.test("invalid confidence/probability outputs are rejected", () => {
  const answer = (confidence: number, probabilities: unknown) => ({
    answers: {
      risk_class: { type: "choice", choice: "high", confidence, probabilities },
    },
  });
  assertThrows(() =>
    parseJevChoiceAnswer(answer(2, { low: 0, review: 0, high: 1 }))
  );
  assertThrows(() =>
    parseJevChoiceAnswer(answer(0.5, { low: 0.2, review: 0.2, high: 0.2 }))
  );
  assertThrows(() =>
    parseJevChoiceAnswer(answer(0.5, { low: 0.9, review: 0.1, high: 0 }))
  );
});
let frozenAvailable = false;
try {
  frozenAvailable = Deno.statSync(
    new URL(
      "../../../research-results/risk-comparison/frozen-evidence-v1/SCN-001.json",
      import.meta.url,
    ),
  ).isFile;
} catch { /* separately retained corpus */ }
Deno.test({
  name:
    "full current builder validates all 25 frozen records without provider calls",
  ignore: !frozenAvailable,
  fn: () => {
    const records = validateFrozenInputs();
    assertEquals(records.length, 25);
    assertEquals(records.filter((r) => r.valid).length, 25);
  },
});
Deno.test("live adapter uses same request builder and measures through body consumption (mock fetch only)", async () => {
  const e = evidence();
  let sent: unknown;
  const analyzer = new JevRiskAnalyzer({
    apiKey: "test-only-opaque-provider-credential",
    provider: "vercel",
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(String((init as RequestInit).body));
      return new Response(
        new ReadableStream({
          async start(controller) {
            await new Promise((resolve) => setTimeout(resolve, 30));
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify({
                  model: "typesafe-ai/jev-1.14.0",
                  answers: {
                    risk_class: {
                      type: "choice",
                      choice: "low",
                      confidence: 1,
                      probabilities: { low: 1, review: 0, high: 0 },
                    },
                  },
                }),
              ),
            );
            controller.close();
          },
        }),
      );
    },
  });
  const result = await analyzer.classify(e);
  assertEquals(result.status, "ok");
  assertEquals(result.latencyMs >= 25, true);
  assertEquals(sent, buildJevSystemOneRequest(e, { provider: "vercel" }).body);
  assertEquals(
    result.providerMetadata.policyHash,
    buildJevSystemOneRequest(e).provenance.policyHash,
  );
});
