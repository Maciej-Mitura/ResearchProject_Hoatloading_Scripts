/**
 * Freeze & verify the Jev-vs-deterministic research experiment.
 *
 * Does NOT call Jev. Does NOT change rules/labels/schemas.
 *
 * Usage:
 *   npm run risk-freeze
 *   npm run risk-freeze -- --dry-run --scenario SCN-005
 *   npm run risk-freeze -- --cost-preview
 *   npm run risk-freeze -- --validate-only --evidence-dir <path>
 */

import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = process.env.API_URL || "http://localhost:3000";
const REPS_PLANNED = Number(process.env.JEV_REPS || 5);
const STABLE_EVIDENCE_DIR = join(
  root,
  "research-results",
  "risk-comparison",
  "frozen-evidence-v1",
);
const MANIFEST_PATH = join(
  root,
  "research-results",
  "risk-comparison",
  "experiment-manifest.json",
);

function sha256File(path) {
  const h = createHash("sha256");
  h.update(readFileSync(path));
  return h.digest("hex");
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function gitCommit() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const out = {
    dryRun: false,
    costPreview: false,
    validateOnly: false,
    freezeOnly: true,
    scenario: null,
    evidenceDir: null,
    skipFreeze: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--cost-preview") out.costPreview = true;
    else if (a === "--validate-only") out.validateOnly = true;
    else if (a === "--skip-freeze") out.skipFreeze = true;
    else if (a === "--scenario") out.scenario = argv[++i];
    else if (a === "--evidence-dir") out.evidenceDir = argv[++i];
    else if (!a.startsWith("-") && !out.scenario) out.scenario = a;
  }
  return out;
}

function loadCorpora() {
  const closedPath = join(root, "fixtures", "scenarios", "manifest.json");
  const holdoutPath = join(
    root,
    "fixtures",
    "scenarios",
    "holdout-manifest.json",
  );
  const sensPath = join(root, "fixtures", "scenarios", "sensitivity.json");
  const closed = JSON.parse(readFileSync(closedPath, "utf8"));
  const holdout = JSON.parse(readFileSync(holdoutPath, "utf8"));
  const sensitivity = JSON.parse(readFileSync(sensPath, "utf8"));
  return { closed, holdout, sensitivity, closedPath, holdoutPath, sensPath };
}

function inventoryScenarios(manifest, corpusType, manifestDir) {
  const rows = [];
  const discrepancies = [];
  const ids = new Set();
  for (const scn of manifest.scenarios) {
    if (ids.has(scn.id)) {
      discrepancies.push(`duplicate scenario id: ${scn.id}`);
    }
    ids.add(scn.id);
    const scriptPath = resolve(manifestDir, scn.scriptFile);
    if (!existsSync(scriptPath)) {
      discrepancies.push(`${scn.id}: missing script ${scn.scriptFile}`);
    }
    if (!["low", "review", "high"].includes(scn.expectedResearchLabel)) {
      discrepancies.push(
        `${scn.id}: unexpected label ${scn.expectedResearchLabel}`,
      );
    }
    // Report (do not fix): holdout host-chat rows omit hostCapability field
    // that closed corpus documents explicitly.
    if (
      scn.permissionProfile === "host-chat" &&
      !("hostCapability" in scn)
    ) {
      discrepancies.push(
        `${scn.id}: host-chat profile but hostCapability field absent in manifest (inferred chat.broadcast via profile; closed corpus documents hostCapability explicitly)`,
      );
    }
    rows.push({
      id: scn.id,
      corpusType,
      name: scn.name,
      expectedResearchLabel: scn.expectedResearchLabel,
      scriptFile: scn.scriptFile,
      scriptExists: existsSync(scriptPath),
      language: scn.language,
      permissionProfile: scn.permissionProfile,
      hostCapability: scn.hostCapability ??
        (scn.permissionProfile === "host-chat" ? "(inferred chat.broadcast)" : null),
    });
  }
  return { rows, discrepancies, ids };
}

function computeFingerprints() {
  const rulesPath = join(root, "apps", "api", "src", "risk", "rules.ts");
  const evidencePath = join(root, "apps", "api", "src", "risk", "evidence.ts");
  const policyPath = join(root, "config", "jev-risk-policy.md");
  const closedPath = join(root, "fixtures", "scenarios", "manifest.json");
  const holdoutPath = join(
    root,
    "fixtures",
    "scenarios",
    "holdout-manifest.json",
  );
  const sensPath = join(root, "fixtures", "scenarios", "sensitivity.json");
  const rulesSrc = readFileSync(rulesPath, "utf8");
  const ruleVersionMatch = /RULE_VERSION\s*=\s*"([^"]+)"/.exec(rulesSrc);
  const evidenceSrc = readFileSync(evidencePath, "utf8");
  const schemaMatch = /EVIDENCE_SCHEMA_VERSION\s*=\s*(\d+)/.exec(evidenceSrc);

  return {
    deterministicRuleVersion: ruleVersionMatch?.[1] ?? "unknown",
    evidenceSchemaVersion: schemaMatch
      ? Number(schemaMatch[1])
      : null,
    fingerprints: {
      rules: sha256File(rulesPath),
      evidenceSchema: sha256File(evidencePath),
      jevPolicy: sha256File(policyPath),
      scenarioManifestClosed: sha256File(closedPath),
      scenarioManifestHoldout: sha256File(holdoutPath),
      sensitivity: sha256File(sensPath),
      scenarioManifest: sha256Text(
        readFileSync(closedPath) + "\n" + readFileSync(holdoutPath),
      ),
    },
    paths: {
      rules: "apps/api/src/risk/rules.ts",
      evidenceSchema: "apps/api/src/risk/evidence.ts",
      jevPolicy: "config/jev-risk-policy.md",
      scenarioManifestClosed: "fixtures/scenarios/manifest.json",
      scenarioManifestHoldout: "fixtures/scenarios/holdout-manifest.json",
    },
  };
}

function costPreview(closedCount, holdoutCount, sensitivity) {
  const evidenceCount = closedCount + holdoutCount;
  const primary = evidenceCount * REPS_PLANNED;
  const sensScenarios = sensitivity.selectScenarioIds?.length ?? 0;
  const sensVariants = sensitivity.variants?.length ?? 0;
  const sensitivityCalls = sensScenarios * sensVariants; // 1 call each
  return {
    evidenceRecords: evidenceCount,
    repetitionsPlanned: REPS_PLANNED,
    primaryClassificationRequests: primary,
    sensitivityScenarioCount: sensScenarios,
    sensitivityVariantCount: sensVariants,
    sensitivityRequests: sensitivityCalls,
    totalPlannedJevRequests: primary + sensitivityCalls,
    note:
      "Sensitivity includes the canonical presentation as a separate call (may overlap first primary rep for those scenarios).",
  };
}

async function waitExecution(id, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const detail = await fetch(`${api}/api/executions/${id}`).then((r) =>
      r.json()
    );
    const status = detail.execution?.status;
    if (["completed", "failed", "terminated", "blocked"].includes(status)) {
      return detail;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timeout waiting for execution ${id}`);
}

async function freezeScenario(scn, manifestDir, corpusType) {
  const scriptPath = resolve(manifestDir, scn.scriptFile);
  const source = readFileSync(scriptPath, "utf8");
  const created = await fetch(`${api}/api/scripts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${scn.id} ${scn.name}`,
      description: scn.description,
      language: scn.language,
      source,
      status: "ready",
    }),
  }).then((r) => r.json());
  if (!created.script?.id) throw new Error("script_create_failed");

  const exec = await fetch(`${api}/api/executions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scriptId: created.script.id,
      permissionProfile: scn.permissionProfile,
    }),
  }).then((r) => r.json());
  if (!exec.id) throw new Error("execution_start_failed");

  const detail = await waitExecution(exec.id);
  const evidenceRes = await fetch(
    `${api}/api/research/evidence/${encodeURIComponent(exec.id)}`,
  ).then((r) => r.json());
  if (!evidenceRes.evidence) throw new Error("evidence_rebuild_failed");

  return {
    scenarioId: scn.id,
    name: scn.name,
    executionId: exec.id,
    referenceLabel: scn.expectedResearchLabel,
    corpusType,
    status: detail.execution?.status,
    evidence: evidenceRes.evidence,
    frozenAt: new Date().toISOString(),
  };
}

const SECRET_PATTERNS = [
  /JEV_API_KEY/i,
  /TYPESAFE_API_KEY/i,
  /HOST_CAPABILITY_TOKEN\s*=/,
  /BRIDGE_TOKEN\s*=/,
  /Bearer\s+[A-Za-z0-9._\-]+/,
  /sk-[A-Za-z0-9]{10,}/,
];

function validateFrozenRecord(rec) {
  const issues = [];
  if (!rec.scenarioId) issues.push("missing scenarioId (wrapper)");
  if (!rec.executionId) issues.push("missing executionId");
  if (!rec.evidence) {
    issues.push("missing evidence");
    return issues;
  }
  const ev = rec.evidence;
  if (ev.evidenceSchemaVersion !== 1) {
    issues.push(`evidenceSchemaVersion=${ev.evidenceSchemaVersion} (want 1)`);
  }
  if (!ev.executionId) issues.push("evidence.executionId missing");
  if (!ev.termination?.status) issues.push("termination.status missing");
  if (!ev.runtime || typeof ev.runtime !== "object") {
    issues.push("runtime metadata missing");
  } else {
    if (ev.runtime.provider == null) issues.push("runtime.provider missing");
    if (typeof ev.runtime.timedOut !== "boolean") {
      issues.push("runtime.timedOut missing");
    }
  }
  if (!ev.permissions || !Array.isArray(ev.permissions.accesses)) {
    issues.push("permissions.accesses not structured");
  } else {
    for (const [i, a] of ev.permissions.accesses.entries()) {
      if (!a.permission) issues.push(`permissions.accesses[${i}].permission`);
    }
  }
  if (!ev.hostApi) issues.push("hostApi missing");
  if (!Array.isArray(ev.provenance) || ev.provenance.length === 0) {
    issues.push("provenance empty");
  }
  const blob = JSON.stringify(ev);
  if (blob.includes('"expectedResearchLabel"') ||
    blob.includes('"referenceLabel"') ||
    blob.includes('"scenarioId"')) {
    issues.push("evidence contains research label/scenarioId fields");
  }
  if (
    blob.includes('"ruleMatches"') ||
    blob.includes('"deterministicClassification"')
  ) {
    issues.push("evidence contains deterministic result fields");
  }
  for (const pat of SECRET_PATTERNS) {
    if (pat.test(blob)) issues.push(`possible secret match: ${pat}`);
  }
  // Wrapper may hold referenceLabel for evaluation — evidence must not.
  return issues;
}

async function dryRunPayload(evidence, scenarioId, presentation = "canonical") {
  const res = await fetch(`${api}/api/research/jev-dry-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      evidence,
      presentation,
      scenarioId,
      // Labels in envelope only — API must not put them in requestBody.
      referenceLabel: "MUST_NOT_APPEAR_IN_REQUEST",
      corpusType: "MUST_NOT_APPEAR_IN_REQUEST",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { closed, holdout, sensitivity } = loadCorpora();
  const manifestDir = join(root, "fixtures", "scenarios");

  const closedInv = inventoryScenarios(
    closed,
    "closed_development",
    manifestDir,
  );
  const holdoutInv = inventoryScenarios(
    holdout,
    "holdout_variant",
    manifestDir,
  );
  const allIds = new Set([...closedInv.ids, ...holdoutInv.ids]);
  const idCollision = [...closedInv.ids].filter((id) => holdoutInv.ids.has(id));

  const fp = computeFingerprints();
  const cost = costPreview(
    closed.scenarios.length,
    holdout.scenarios.length,
    sensitivity,
  );

  console.log("=== corpus inventory ===");
  console.log(`closed/development: ${closed.scenarios.length}`);
  console.log(`holdout: ${holdout.scenarios.length}`);
  console.log(`unique IDs across both: ${allIds.size}`);
  if (idCollision.length) {
    console.log(`ID collisions: ${idCollision.join(", ")}`);
  }
  console.log("\nClosed:");
  for (const r of closedInv.rows) {
    console.log(
      `  ${r.id}  label=${r.expectedResearchLabel}  profile=${r.permissionProfile}  host=${r.hostCapability}  script=${r.scriptFile}`,
    );
  }
  console.log("\nHoldout:");
  for (const r of holdoutInv.rows) {
    console.log(
      `  ${r.id}  label=${r.expectedResearchLabel}  profile=${r.permissionProfile}  host=${r.hostCapability}  script=${r.scriptFile}`,
    );
  }

  const discrepancies = [
    ...closedInv.discrepancies,
    ...holdoutInv.discrepancies,
  ];
  if (idCollision.length) {
    discrepancies.push(`ID collision across corpora: ${idCollision.join(",")}`);
  }
  if (closed.scenarios.length !== 15) {
    discrepancies.push(
      `closed count ${closed.scenarios.length} != expected 15`,
    );
  }
  if (holdout.scenarios.length !== 10) {
    discrepancies.push(
      `holdout count ${holdout.scenarios.length} != expected 10`,
    );
  }
  if (fp.deterministicRuleVersion !== "1") {
    discrepancies.push(
      `RULE_VERSION is ${fp.deterministicRuleVersion}, expected 1`,
    );
  }
  if (fp.evidenceSchemaVersion !== 1) {
    discrepancies.push(
      `EVIDENCE_SCHEMA_VERSION is ${fp.evidenceSchemaVersion}, expected 1`,
    );
  }

  console.log("\n=== discrepancies (reported, not auto-fixed) ===");
  if (!discrepancies.length) console.log("  (none)");
  else for (const d of discrepancies) console.log(`  - ${d}`);

  console.log("\n=== fingerprints (research metadata only) ===");
  console.log(`  ruleVersion: ${fp.deterministicRuleVersion}`);
  console.log(`  evidenceSchemaVersion: ${fp.evidenceSchemaVersion}`);
  console.log(`  rules sha256: ${fp.fingerprints.rules}`);
  console.log(`  evidenceSchema sha256: ${fp.fingerprints.evidenceSchema}`);
  console.log(`  jevPolicy sha256: ${fp.fingerprints.jevPolicy}`);
  console.log(
    `  scenarioManifest (closed+holdout) sha256: ${fp.fingerprints.scenarioManifest}`,
  );

  console.log("\n=== planned Jev call count (NOT executed) ===");
  console.log(JSON.stringify(cost, null, 2));

  if (args.costPreview && !args.dryRun && args.skipFreeze) {
    return;
  }

  // Health check for freeze / dry-run against API
  const health = await fetch(`${api}/health`).then((r) => r.json()).catch(
    () => null,
  );
  if (!health && (args.dryRun || !args.validateOnly)) {
    console.error(
      `\nAPI not reachable at ${api}. Start stack with EXECUTION_PROVIDER=docker before freezing.`,
    );
    if (!args.validateOnly && !existsSync(STABLE_EVIDENCE_DIR)) {
      process.exit(1);
    }
  }

  const config = health
    ? await fetch(`${api}/api/config/public`).then((r) => r.json()).catch(
      () => ({}),
    )
    : {};

  let evidenceDir = args.evidenceDir
    ? resolve(args.evidenceDir)
    : STABLE_EVIDENCE_DIR;

  if (!args.validateOnly && !args.skipFreeze && health) {
    mkdirSync(STABLE_EVIDENCE_DIR, { recursive: true });
    const jobs = [
      ...closed.scenarios.map((scn) => ({
        scn,
        corpusType: "closed_development",
      })),
      ...holdout.scenarios.map((scn) => ({
        scn,
        corpusType: "holdout_variant",
      })),
    ];
    console.log(
      `\n=== freezing evidence (${jobs.length} scenarios, no Jev) ===`,
    );
    for (const job of jobs) {
      process.stdout.write(`${job.scn.id} … `);
      try {
        const rec = await freezeScenario(job.scn, manifestDir, job.corpusType);
        writeFileSync(
          join(STABLE_EVIDENCE_DIR, `${job.scn.id}.json`),
          JSON.stringify(rec, null, 2),
        );
        console.log(
          `ok schema=${rec.evidence.evidenceSchemaVersion} status=${rec.status}`,
        );
      } catch (err) {
        console.log(`FAIL ${err}`);
        writeFileSync(
          join(STABLE_EVIDENCE_DIR, `${job.scn.id}.ERROR.json`),
          JSON.stringify({
            scenarioId: job.scn.id,
            error: String(err),
            corpusType: job.corpusType,
          }, null, 2),
        );
      }
    }
    evidenceDir = STABLE_EVIDENCE_DIR;
  }

  // Load + validate frozen evidence
  const frozen = [];
  if (existsSync(evidenceDir)) {
    for (const file of readdirSync(evidenceDir).filter((f) =>
      f.endsWith(".json") && !f.endsWith(".ERROR.json")
    )) {
      frozen.push(JSON.parse(readFileSync(join(evidenceDir, file), "utf8")));
    }
  }

  console.log("\n=== frozen evidence validation ===");
  console.log(`directory: ${evidenceDir}`);
  console.log(`records: ${frozen.length}`);
  const expectedCount = closed.scenarios.length + holdout.scenarios.length;
  if (frozen.length !== expectedCount) {
    console.log(
      `DISCREPANCY: frozen count ${frozen.length} != scenario count ${expectedCount}`,
    );
  }
  const malformed = [];
  for (const rec of frozen) {
    const issues = validateFrozenRecord(rec);
    if (issues.length) {
      malformed.push({ scenarioId: rec.scenarioId, issues });
      console.log(`  MALFORMED ${rec.scenarioId}: ${issues.join("; ")}`);
    } else {
      console.log(
        `  OK ${rec.scenarioId} schema=${rec.evidence.evidenceSchemaVersion} status=${rec.status}`,
      );
    }
  }
  if (!malformed.length) console.log("  all loaded records structurally OK");

  // Dry-run one sanitized payload
  let dryRunExample = null;
  if (args.dryRun || health) {
    const targetId = args.scenario || "SCN-005";
    let rec = frozen.find((f) => f.scenarioId === targetId);
    if (!rec && health) {
      // freeze single on demand for dry-run if missing
      const scn = [...closed.scenarios, ...holdout.scenarios].find((s) =>
        s.id === targetId
      );
      if (scn) {
        console.log(`\nFreezing ${targetId} for dry-run only…`);
        const corpusType = targetId.startsWith("HOL")
          ? "holdout_variant"
          : "closed_development";
        rec = await freezeScenario(scn, manifestDir, corpusType);
      }
    }
    if (rec?.evidence && health) {
      console.log(`\n=== Jev dry-run (NOT SENT) scenario=${targetId} ===`);
      dryRunExample = await dryRunPayload(rec.evidence, targetId);
      const reqBlob = JSON.stringify(dryRunExample.requestBody);
      const leaks = [
        "MUST_NOT_APPEAR_IN_REQUEST",
        "expectedResearchLabel",
        "referenceLabel",
        "scenarioId",
        "corpusType",
        "R003",
        "ruleMatches",
        "Authorization",
        "JEV_API_KEY",
      ].filter((k) => reqBlob.includes(k));
      console.log(`endpoint: ${dryRunExample.endpoint}`);
      console.log(`model: ${dryRunExample.model}`);
      console.log(`integrity.safe: ${dryRunExample.integrity?.safe}`);
      console.log(
        `authorization: ${dryRunExample.authorization}`,
      );
      console.log(
        `requestBody leak check: ${
          leaks.length ? `FAIL ${leaks.join(",")}` : "PASS (no leaks)"
        }`,
      );
      console.log(
        "Choice options:",
        Object.keys(dryRunExample.requestBody.questions.risk_class.criteria),
      );
      const dryPath = join(
        root,
        "research-results",
        "risk-comparison",
        `jev-dry-run-${targetId}.json`,
      );
      mkdirSync(dirname(dryPath), { recursive: true });
      writeFileSync(dryPath, JSON.stringify(dryRunExample, null, 2));
      console.log(`wrote ${dryPath}`);
    } else if (args.dryRun) {
      console.error(
        `Cannot dry-run: no frozen evidence for ${targetId} and API unavailable.`,
      );
      process.exit(1);
    }
  }

  // Write experiment manifest
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  const sampleRuntime = frozen.find((f) => f.evidence)?.evidence?.runtime;
  const manifest = {
    experimentVersion: "1",
    kind: "jev_vs_deterministic_advisory_comparison",
    status: "frozen_pre_live",
    createdAt: new Date().toISOString(),
    gitCommit: gitCommit(),
    evidenceSchemaVersion: fp.evidenceSchemaVersion,
    deterministicRuleVersion: fp.deterministicRuleVersion,
    jevPolicyVersion: "1",
    closedScenarioCount: closed.scenarios.length,
    holdoutScenarioCount: holdout.scenarios.length,
    frozenEvidenceCount: frozen.length,
    frozenEvidenceDir: "research-results/risk-comparison/frozen-evidence-v1",
    repetitionsPlanned: REPS_PLANNED,
    denoVersion: sampleRuntime?.runtimeVersion ??
      process.env.SANDBOX_DENO_VERSION ??
      "2.9.7",
    sandboxImage: sampleRuntime
      ? null
      : (process.env.SANDBOX_IMAGE ?? "research-poc-sandbox:local"),
    executionProvider: config.executionProvider ??
      process.env.EXECUTION_PROVIDER ??
      null,
    containerRuntime: sampleRuntime?.containerRuntime ?? null,
    jevModelConfigured: process.env.JEV_MODEL ?? "jev-latest",
    jevEndpointConfigured: process.env.JEV_API_URL ??
      "https://api.typesafe.ai/v1/systemone",
    plannedCalls: cost,
    fingerprints: fp.fingerprints,
    fingerprintPaths: fp.paths,
    discrepancies,
    malformedFrozenRecords: malformed,
    integrityNotes: [
      "Deterministic ruleVersion 1 is frozen for this experiment; any logic change requires ruleVersion 2.",
      "Jev repetitions must use frozen-evidence-v1 records — do not re-execute sandboxes per repetition.",
      "Labels / corpusType / deterministic outputs must never appear in System One requestBody.state.",
      "Live Jev run requires JEV_API_KEY or TYPESAFE_API_KEY; npm run risk-comparison -- --require-jev --evidence-dir …",
    ],
    liveCommand:
      "npm run risk-comparison -- --require-jev --evidence-dir research-results/risk-comparison/frozen-evidence-v1 --reps 5",
    resumeCommand:
      "npm run risk-comparison -- --require-jev --evidence-dir research-results/risk-comparison/frozen-evidence-v1 --resume research-results/risk-comparison/<run-dir> --reps 5",
  };
  // Prefer sandbox image from a frozen record if present on result later —
  // evidence runtime may not include image name; keep env default.
  if (frozen[0]?.evidence?.runtime) {
    manifest.sampleRuntime = {
      runtime: frozen[0].evidence.runtime.runtime,
      runtimeVersion: frozen[0].evidence.runtime.runtimeVersion,
      containerRuntime: frozen[0].evidence.runtime.containerRuntime,
      provider: frozen[0].evidence.runtime.provider,
    };
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nwrote ${MANIFEST_PATH}`);
  console.log("\nJev evaluation not performed.");
  console.log(`Planned total Jev requests: ${cost.totalPlannedJevRequests}`);
  console.log(`Live command:\n  ${manifest.liveCommand}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
