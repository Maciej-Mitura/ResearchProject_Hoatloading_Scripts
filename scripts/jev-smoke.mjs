/**
 * Small live Jev smoke test (3 scenarios × 1 call).
 * Frozen evidence only. Does not modify corpora/rules/policy/evidence.
 */

import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = process.env.API_URL || "http://localhost:3000";
const FROZEN = join(
  root,
  "research-results",
  "risk-comparison",
  "frozen-evidence-v1",
);
const SCENARIOS = ["SCN-001", "SCN-005", "SCN-011"];

const LEAK_MARKERS = [
  "scenarioId",
  "corpusType",
  "expectedResearchLabel",
  "referenceLabel",
  "referenceResearchLabel",
  "ruleMatches",
  "deterministicClassification",
  "scriptSource",
  "MUST_NOT",
  "JEV_API_KEY",
  "TYPESAFE_API_KEY",
  "HOST_CAPABILITY_TOKEN",
  "Authorization",
];

function fingerprintFrozenDir() {
  const files = readdirSync(FROZEN)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const h = createHash("sha256");
  for (const f of files) {
    h.update(f);
    h.update("\0");
    h.update(readFileSync(join(FROZEN, f)));
    h.update("\0");
  }
  return { fileCount: files.length, sha256: h.digest("hex"), files };
}

function parseRules(reasons) {
  if (!Array.isArray(reasons)) return [];
  return reasons
    .map((r) => {
      const m = /^\[([A-Z0-9]+)\]/.exec(String(r));
      return m ? m[1] : null;
    })
    .filter(Boolean);
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outRoot = join(
    root,
    "research-results",
    "risk-comparison",
    `smoke-${stamp}`,
  );
  mkdirSync(join(outRoot, "raw"), { recursive: true });

  const frozenBefore = fingerprintFrozenDir();

  // Credential presence only — never print values
  const probeHealth = await fetch(`${api}/health`).then((r) => r.json()).catch(
    () => null,
  );
  if (!probeHealth) {
    console.error("API not reachable");
    process.exit(1);
  }

  // Probe Jev with first frozen record (1 call counts toward smoke if we use SCN-001)
  const rows = [];
  let liveCalls = 0;
  let providerErrors = 0;

  for (const scenarioId of SCENARIOS) {
    const rec = JSON.parse(
      readFileSync(join(FROZEN, `${scenarioId}.json`), "utf8"),
    );
    if (!rec.evidence) throw new Error(`missing evidence ${scenarioId}`);

    // Dry-run integrity (no network to TypeSafe)
    const dry = await fetch(`${api}/api/research/jev-dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evidence: rec.evidence,
        scenarioId,
        corpusType: "MUST_NOT_APPEAR",
        referenceLabel: "MUST_NOT_APPEAR",
      }),
    }).then((r) => r.json());

    const reqBlob = JSON.stringify(dry.requestBody ?? {});
    const leaks = LEAK_MARKERS.filter((m) => reqBlob.includes(m));
    // scenarioId as JSON key in state is forbidden; evaluation envelope may have it
    const stateBlob = JSON.stringify(dry.requestBody?.state ?? {});
    const stateLeaks = [
      "scenarioId",
      "corpusType",
      "expectedResearchLabel",
      "referenceLabel",
      "ruleMatches",
      "MUST_NOT",
      "scriptSource",
      "stdout",
      "stderr",
    ].filter((m) => stateBlob.includes(`"${m}"`) || stateBlob.includes(m + "="));

    writeFileSync(
      join(outRoot, "raw", `${scenarioId}-dry-run.json`),
      JSON.stringify({
        ...dry,
        authorization: "REDACTED",
        requestLeakCheck: { payloadLeaks: leaks, stateLeaks },
      }, null, 2),
    );

    process.stdout.write(`${scenarioId} Jev classify … `);

    const started = Date.now();
    const cmp = await fetch(`${api}/api/research/risk-classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evidence: rec.evidence,
        analyzers: ["deterministic", "jev"],
        repetitions: 1,
        presentation: "canonical",
        // Evaluation envelope only
        scenarioId,
        corpusType: rec.corpusType,
        referenceLabel: rec.referenceLabel,
      }),
    }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json() }));
    liveCalls += 1;
    const wallMs = Date.now() - started;

    const det = cmp.body.deterministic;
    const jev = cmp.body.jev;
    const jevOk = jev?.status === "ok" &&
      ["low", "review", "high"].includes(jev?.classification);
    if (!jevOk) providerErrors += 1;

    const row = {
      scenario: scenarioId,
      referenceResearchLabel: rec.referenceLabel,
      deterministicClassification: det?.classification ?? null,
      deterministicRules: parseRules(det?.reasons),
      deterministicScore: det?.score ?? null,
      jevClassification: jev?.classification ?? null,
      jevConfidence: jev?.confidence ?? null,
      jevLatencyMs: jev?.latencyMs ?? null,
      wallClockMs: wallMs,
      jevStatus: jev?.status ?? null,
      jevFailureKind: jev?.failureKind ?? null,
      providerModel: jev?.providerMetadata?.responseModel ??
        jev?.providerMetadata?.requestedModel ??
        null,
      agreementWithReference: jev?.classification != null &&
        jev.classification === rec.referenceLabel,
      agreementWithDeterministic: jev?.classification != null &&
        det?.classification != null &&
        jev.classification === det.classification,
      requestIntegrity: {
        dryRunSafe: dry.integrity?.safe === true,
        stateLeaks,
        payloadLeaksExcludingCriteriaText: leaks.filter((l) =>
          !["low", "review", "high"].includes(l)
        ),
      },
      typedChoiceValid: jevOk,
    };

    rows.push(row);
    writeFileSync(
      join(outRoot, "raw", `${scenarioId}-classify.json`),
      JSON.stringify({
        comparisonMetadata: {
          scenarioId,
          referenceResearchLabel: rec.referenceLabel,
          corpusType: rec.corpusType,
          evidenceId: rec.executionId,
        },
        httpOk: cmp.ok,
        httpStatus: cmp.status,
        deterministic: det,
        jev: {
          ...jev,
          // Strip any accidental key-shaped fields if present
          providerMetadata: {
            ...(jev?.providerMetadata ?? {}),
            // ensure we don't persist secrets
          },
        },
        row,
      }, null, 2),
    );

    console.log(
      `status=${jev?.status} class=${jev?.classification} conf=${jev?.confidence} model=${row.providerModel} leaks=${stateLeaks.length}`,
    );
  }

  const frozenAfter = fingerprintFrozenDir();
  const frozenUnchanged = frozenBefore.sha256 === frozenAfter.sha256 &&
    frozenBefore.fileCount === frozenAfter.fileCount;

  const summary = {
    kind: "jev_live_smoke_test",
    createdAt: new Date().toISOString(),
    liveJevCalls: liveCalls,
    providerErrors,
    scenarios: SCENARIOS,
    frozenEvidenceDir: "research-results/risk-comparison/frozen-evidence-v1",
    frozenFingerprintBefore: frozenBefore.sha256,
    frozenFingerprintAfter: frozenAfter.sha256,
    frozenArtifactsUnchanged: frozenUnchanged,
    rows,
    notes: [
      "Smoke test only — not the full 140-call experiment.",
      "Confidence is TypeSafe Choice distribution confidence, not probability of maliciousness.",
      "scenarioId / reference / deterministic appear only in comparison metadata, not in Jev request state.",
    ],
  };

  writeFileSync(join(outRoot, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(outRoot, "results.csv"), [
    [
      "scenario",
      "reference",
      "deterministic",
      "jev",
      "jevConfidence",
      "latencyMs",
      "providerModel",
      "agreementWithReference",
      "agreementWithDeterministic",
      "jevStatus",
    ].join(","),
    ...rows.map((r) =>
      [
        r.scenario,
        r.referenceResearchLabel,
        r.deterministicClassification,
        r.jevClassification,
        r.jevConfidence,
        r.jevLatencyMs,
        r.providerModel,
        r.agreementWithReference,
        r.agreementWithDeterministic,
        r.jevStatus,
      ].join(",")
    ),
  ].join("\n"));

  console.log(`\nwrote ${outRoot}`);
  console.log(JSON.stringify({ liveCalls, providerErrors, frozenUnchanged }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
