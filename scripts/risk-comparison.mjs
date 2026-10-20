/**
 * Fair advisory comparison: DeterministicRiskAnalyzer v1 vs JevRiskAnalyzer.
 *
 * Prefer frozen evidence:
 *   npm run risk-freeze
 *   npm run risk-comparison -- --require-jev --evidence-dir research-results/risk-comparison/frozen-evidence-v1
 *
 * Safety:
 *   --require-jev  Fail hard if Jev credentials/results are unavailable.
 *                  Never silently substitute deterministic/mock as Jev.
 *   --resume DIR   Continue an interrupted run directory (skip completed keys).
 *   --dry-run      Print one sanitized System One request; do not call Jev.
 *
 * Each live experiment writes a new timestamp directory (never overwrites).
 */

import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = process.env.API_URL || "http://localhost:3000";
const LABELS = ["low", "review", "high"];
const DEFAULT_FROZEN = join(
  root,
  "research-results",
  "risk-comparison",
  "frozen-evidence-v1",
);

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
    reps: Number(process.env.JEV_REPS || 5),
    freezeOnly: false,
    skipHoldout: false,
    skipClosed: false,
    skipSensitivity: false,
    evidenceDir: null,
    requireJev: false,
    resumeDir: null,
    dryRun: false,
    scenario: null,
    filter: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--freeze-only") out.freezeOnly = true;
    else if (a === "--skip-holdout") out.skipHoldout = true;
    else if (a === "--skip-closed") out.skipClosed = true;
    else if (a === "--skip-sensitivity") out.skipSensitivity = true;
    else if (a === "--require-jev") out.requireJev = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--reps") out.reps = Number(argv[++i]);
    else if (a === "--evidence-dir") out.evidenceDir = argv[++i];
    else if (a === "--resume") out.resumeDir = argv[++i];
    else if (a === "--scenario") out.scenario = argv[++i];
    else if (!a.startsWith("-")) {
      // Positional scenario filters only (SCN-*/HOL-*). Paths are not filters.
      if (/^(SCN|HOL)-\d+/i.test(a)) out.filter.push(a);
      else {
        console.warn(`[risk-comparison] ignoring unexpected positional arg: ${a}`);
      }
    }
  }
  out.reps = Math.min(Math.max(out.reps || 5, 1), 10);
  return out;
}

async function waitExecution(id, timeoutMs = 90_000) {
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

async function runScenario(scn, manifestDir) {
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
  const scriptId = created.script?.id;
  if (!scriptId) throw new Error("script_create_failed");

  const exec = await fetch(`${api}/api/executions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scriptId,
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
    evidence: evidenceRes.evidence,
    status: detail.execution?.status,
  };
}

async function classifyFrozen(
  entry,
  corpusType,
  reps,
  presentation = "canonical",
) {
  const body = {
    evidence: entry.evidence,
    analyzers: ["deterministic", "jev"],
    repetitions: reps,
    presentation,
    scenarioId: entry.scenarioId,
    corpusType,
    referenceLabel: entry.referenceLabel,
  };
  const res = await fetch(`${api}/api/research/risk-classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

function runKey(scenario, presentation, jevRun) {
  return `${scenario}::${presentation}::${jevRun}`;
}

function loadCompletedKeys(resumeDir) {
  const path = join(resumeDir, "progress.json");
  if (!existsSync(path)) return new Set();
  const prog = JSON.parse(readFileSync(path, "utf8"));
  return new Set(prog.completedKeys ?? []);
}

function saveProgress(outRoot, completedKeys, meta = {}) {
  writeFileSync(
    join(outRoot, "progress.json"),
    JSON.stringify({
      ...meta,
      updatedAt: new Date().toISOString(),
      completedKeys: [...completedKeys],
    }, null, 2),
  );
}

function appendRaw(outRoot, record) {
  const rawDir = join(outRoot, "raw");
  mkdirSync(rawDir, { recursive: true });
  const name = `${record.scenario}_${record.presentation}_r${record.jevRun}.json`;
  writeFileSync(join(rawDir, name), JSON.stringify(record, null, 2));
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(nums, p) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1);
  return s[Math.max(0, idx)];
}

function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
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

function confusion(rows, predKey) {
  const matrix = {};
  for (const a of LABELS) {
    matrix[a] = {};
    for (const b of LABELS) matrix[a][b] = 0;
  }
  for (const row of rows) {
    const ref = row.referenceLabel;
    const act = row[predKey];
    if (LABELS.includes(ref) && LABELS.includes(act)) matrix[ref][act]++;
  }
  return matrix;
}

function perClass(matrix) {
  const stats = {};
  for (const label of LABELS) {
    let tp = matrix[label][label];
    let fp = 0;
    let fn = 0;
    for (const other of LABELS) {
      if (other !== label) {
        fp += matrix[other][label];
        fn += matrix[label][other];
      }
    }
    stats[label] = {
      tp,
      fp,
      fn,
      precision: tp + fp === 0 ? null : tp / (tp + fp),
      recall: tp + fn === 0 ? null : tp / (tp + fn),
    };
  }
  return stats;
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const health = await fetch(`${api}/health`).then((r) => r.json()).catch(
    () => null,
  );
  if (!health) {
    console.error(`API not reachable at ${api}`);
    process.exit(1);
  }

  const config = await fetch(`${api}/api/config/public`).then((r) => r.json())
    .catch(() => ({}));

  const closedManifest = JSON.parse(
    readFileSync(join(root, "fixtures", "scenarios", "manifest.json"), "utf8"),
  );
  const holdoutManifest = JSON.parse(
    readFileSync(
      join(root, "fixtures", "scenarios", "holdout-manifest.json"),
      "utf8",
    ),
  );
  const sensitivity = JSON.parse(
    readFileSync(
      join(root, "fixtures", "scenarios", "sensitivity.json"),
      "utf8",
    ),
  );

  // --- Dry-run only (no Jev network) ---
  if (args.dryRun) {
    const evidenceDir = resolve(args.evidenceDir || DEFAULT_FROZEN);
    const scenarioId = args.scenario || args.filter[0] || "SCN-005";
    const file = join(evidenceDir, `${scenarioId}.json`);
    if (!existsSync(file)) {
      console.error(
        `Frozen evidence missing for ${scenarioId} at ${file}. Run: npm run risk-freeze`,
      );
      process.exit(1);
    }
    const rec = JSON.parse(readFileSync(file, "utf8"));
    const dry = await fetch(`${api}/api/research/jev-dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evidence: rec.evidence,
        scenarioId,
        referenceLabel: "MUST_NOT_APPEAR",
        corpusType: "MUST_NOT_APPEAR",
      }),
    }).then((r) => r.json());
    console.log(JSON.stringify(dry, null, 2));
    console.log("\nJev evaluation not performed (dry-run).");
    return;
  }

  /** @type {Array<{scenarioId,name,executionId,referenceLabel,evidence,status,corpusType}>} */
  let frozen = [];

  if (args.evidenceDir || existsSync(DEFAULT_FROZEN)) {
    const dir = resolve(args.evidenceDir || DEFAULT_FROZEN);
    for (const file of readdirSync(dir).filter((f) =>
      f.endsWith(".json") && !f.endsWith(".ERROR.json")
    )) {
      const rec = JSON.parse(readFileSync(join(dir, file), "utf8"));
      if (args.filter.length && !args.filter.includes(rec.scenarioId)) continue;
      frozen.push(rec);
    }
    console.log(`Loaded ${frozen.length} frozen evidence files from ${dir}`);
  } else if (!args.freezeOnly) {
    console.error(
      "No frozen evidence. Run npm run risk-freeze first, or pass --evidence-dir / --freeze-only.",
    );
    process.exit(1);
  } else {
    const jobs = [];
    if (!args.skipClosed) {
      for (const scn of closedManifest.scenarios) {
        if (args.filter.length && !args.filter.includes(scn.id)) continue;
        jobs.push({
          scn,
          corpusType: "closed_development",
          dir: join(root, "fixtures", "scenarios"),
        });
      }
    }
    if (!args.skipHoldout) {
      for (const scn of holdoutManifest.scenarios) {
        if (args.filter.length && !args.filter.includes(scn.id)) continue;
        jobs.push({
          scn,
          corpusType: "holdout_variant",
          dir: join(root, "fixtures", "scenarios"),
        });
      }
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const evidenceOut = join(
      root,
      "research-results",
      "risk-comparison",
      stamp,
      "evidence",
    );
    mkdirSync(evidenceOut, { recursive: true });
    console.log(`Freezing evidence for ${jobs.length} scenarios…`);
    for (const job of jobs) {
      process.stdout.write(`${job.scn.id} … `);
      try {
        const entry = await runScenario(job.scn, job.dir);
        const rec = { ...entry, corpusType: job.corpusType };
        frozen.push(rec);
        writeFileSync(
          join(evidenceOut, `${job.scn.id}.json`),
          JSON.stringify(rec, null, 2),
        );
        console.log(`ok exec=${entry.executionId}`);
      } catch (err) {
        console.log(`FAIL ${err}`);
      }
    }
    if (args.freezeOnly) {
      console.log(`Freeze-only complete → ${evidenceOut}`);
      console.log("Jev evaluation not performed.");
      return;
    }
  }

  if (args.freezeOnly) {
    console.log("Freeze-only: Jev evaluation not performed.");
    return;
  }

  const usable = frozen.filter((f) => f.evidence);
  if (!usable.length) {
    console.error("No frozen evidence to classify.");
    process.exit(1);
  }

  // Probe Jev once before claiming a live experiment
  const probe = await classifyFrozen(usable[0], usable[0].corpusType, 1);
  const jevReady = probe.jev?.status === "ok";

  if (!jevReady) {
    console.error("\n=== Jev evaluation not performed ===");
    console.error(
      `Probe status=${probe.jev?.status} failure=${probe.jev?.failureKind}`,
    );
    console.error(
      "Configure JEV_API_KEY or TYPESAFE_API_KEY on the API, rebuild/restart, then re-run with --require-jev and --evidence-dir.",
    );
    if (args.requireJev) {
      process.exit(2);
    }
    // Without --require-jev, still refuse to write a "complete" comparison
    // that looks like Jev ran. Exit clearly.
    console.error(
      "Refusing to write a fake Jev comparison summary. Pass --require-jev after credentials are set.",
    );
    process.exit(2);
  }

  console.log(
    `\nJev live: model=${
      probe.jev?.providerMetadata?.responseModel ??
        probe.jev?.providerMetadata?.requestedModel
    } reps=${args.reps}`,
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outRoot = args.resumeDir
    ? resolve(args.resumeDir)
    : join(root, "research-results", "risk-comparison", stamp);
  mkdirSync(outRoot, { recursive: true });
  mkdirSync(join(outRoot, "raw"), { recursive: true });

  const completedKeys = loadCompletedKeys(outRoot);
  /** @type {any[]} */
  let runs = [];
  /** @type {any[]} */
  let resultRows = [];
  if (existsSync(join(outRoot, "runs.json"))) {
    runs = JSON.parse(readFileSync(join(outRoot, "runs.json"), "utf8"));
  }
  if (existsSync(join(outRoot, "results.csv"))) {
    // rebuild resultRows from runs for resume
    resultRows = runs.map((r) => ({ ...r }));
  }

  for (const entry of usable) {
    for (let rep = 1; rep <= args.reps; rep++) {
      const key = runKey(entry.scenarioId, "canonical", rep);
      if (completedKeys.has(key)) {
        process.stdout.write(`skip ${key}\n`);
        continue;
      }
      process.stdout.write(
        `classify ${entry.scenarioId} rep ${rep}/${args.reps} … `,
      );
      try {
        // One repetition per call so resume granularity is per-request.
        const cmp = await classifyFrozen(
          entry,
          entry.corpusType,
          1,
          "canonical",
        );
        const det = cmp.deterministic;
        const jev = cmp.jev;
        if (jev?.status !== "ok") {
          throw new Error(
            `jev_not_ok status=${jev?.status} failure=${jev?.failureKind}`,
          );
        }
        const detRules = parseRules(det?.reasons);
        const row = {
          scenario: entry.scenarioId,
          corpusType: entry.corpusType,
          referenceLabel: entry.referenceLabel,
          deterministicClassification: det?.classification ?? null,
          deterministicRules: detRules,
          deterministicLatencyMs: det?.latencyMs ?? null,
          jevRun: rep,
          jevClassification: jev?.classification ?? null,
          jevConfidence: jev?.confidence ?? null,
          jevLatencyMs: jev?.latencyMs ?? null,
          jevStatus: jev?.status ?? null,
          jevFailureKind: jev?.failureKind ?? null,
          agreementWithReference: jev?.classification != null &&
            jev.classification === entry.referenceLabel,
          agreementWithDeterministic: jev?.classification != null &&
            det?.classification != null &&
            jev.classification === det.classification,
          evidenceSchemaVersion: entry.evidence.evidenceSchemaVersion,
          ruleVersion: det?.analyzerVersion ?? "1",
          providerModel: jev?.providerMetadata?.responseModel ??
            jev?.providerMetadata?.requestedModel ??
            null,
          presentation: "canonical",
          timestamp: new Date().toISOString(),
          evidenceId: entry.executionId,
        };
        resultRows.push(row);
        const full = {
          ...row,
          deterministicReasons: det?.reasons ?? [],
          jevReasons: jev?.reasons ?? [],
          jevProviderMetadata: jev?.providerMetadata ?? {},
          rawJev: jev,
          rawDeterministic: det,
        };
        runs.push(full);
        appendRaw(outRoot, full);
        completedKeys.add(key);
        saveProgress(outRoot, completedKeys, {
          phase: "primary",
          evidenceDir: args.evidenceDir || DEFAULT_FROZEN,
        });
        writeFileSync(join(outRoot, "runs.json"), JSON.stringify(runs, null, 2));
        console.log(`det=${det?.classification} jev=${jev?.classification}`);
      } catch (err) {
        console.log(`FAIL ${err}`);
        saveProgress(outRoot, completedKeys, {
          phase: "primary",
          lastError: String(err),
        });
        if (args.requireJev) {
          console.error(
            `Interrupted. Resume with:\n  npm run risk-comparison -- --require-jev --evidence-dir ${
              args.evidenceDir || DEFAULT_FROZEN
            } --resume ${outRoot} --reps ${args.reps}`,
          );
          process.exit(3);
        }
      }
    }
  }

  const sensitivityRows = [];
  if (!args.skipSensitivity) {
    const sensIds = new Set(sensitivity.selectScenarioIds);
    const sensEntries = usable.filter((e) => sensIds.has(e.scenarioId));
    console.log(
      `\nSensitivity on ${sensEntries.length} records × ${sensitivity.variants.length} presentations…`,
    );
    for (const entry of sensEntries) {
      for (const variant of sensitivity.variants) {
        const key = runKey(entry.scenarioId, variant.presentation, 1);
        if (completedKeys.has(key)) {
          process.stdout.write(`skip ${key}\n`);
          continue;
        }
        const cmp = await classifyFrozen(
          entry,
          entry.corpusType,
          1,
          variant.presentation,
        );
        const row = {
          scenario: entry.scenarioId,
          presentation: variant.presentation,
          presentationId: variant.id,
          jevClassification: cmp.jev?.classification ?? null,
          jevConfidence: cmp.jev?.confidence ?? null,
          jevStatus: cmp.jev?.status ?? null,
          deterministicClassification: cmp.deterministic?.classification ??
            null,
          jevRun: 1,
          corpusType: entry.corpusType,
          referenceLabel: entry.referenceLabel,
          rawJev: cmp.jev,
        };
        sensitivityRows.push(row);
        appendRaw(outRoot, {
          ...row,
          scenario: entry.scenarioId,
          presentation: variant.presentation,
          jevRun: 1,
        });
        completedKeys.add(key);
        saveProgress(outRoot, completedKeys, { phase: "sensitivity" });
        writeFileSync(
          join(outRoot, "sensitivity.json"),
          JSON.stringify(sensitivityRows, null, 2),
        );
      }
    }
  }

  const closedRows = resultRows.filter((r) =>
    r.corpusType === "closed_development" && r.jevRun === 1 &&
    r.presentation === "canonical"
  );
  const holdoutRows = resultRows.filter((r) =>
    r.corpusType === "holdout_variant" && r.jevRun === 1 &&
    r.presentation === "canonical"
  );
  const allFirst = resultRows.filter((r) =>
    r.jevRun === 1 && r.presentation === "canonical" && r.jevStatus
  );

  const jevLatencies = resultRows
    .filter((r) => typeof r.jevLatencyMs === "number")
    .map((r) => r.jevLatencyMs);
  const detLatencies = resultRows
    .filter((r) =>
      typeof r.deterministicLatencyMs === "number" && r.jevRun === 1
    )
    .map((r) => r.deterministicLatencyMs);

  const byScenario = new Map();
  for (const r of resultRows) {
    if (!r.scenario || r.jevStatus !== "ok" || r.presentation !== "canonical") {
      continue;
    }
    if (!byScenario.has(r.scenario)) byScenario.set(r.scenario, []);
    byScenario.get(r.scenario).push(r.jevClassification);
  }
  const repeatability = [];
  for (const [scenario, classes] of byScenario) {
    const unique = [...new Set(classes)];
    repeatability.push({
      scenario,
      runs: classes.length,
      uniqueClassifications: unique,
      stable: unique.length === 1,
    });
  }

  const confCorrect = [];
  const confIncorrect = [];
  for (const r of allFirst) {
    if (r.jevStatus !== "ok" || typeof r.jevConfidence !== "number") continue;
    if (r.agreementWithReference) confCorrect.push(r.jevConfidence);
    else confIncorrect.push(r.jevConfidence);
  }

  const failures = resultRows.filter((r) =>
    r.jevStatus && r.jevStatus !== "ok"
  );

  const summary = {
    kind: "advisory_risk_comparison_jev_vs_deterministic",
    timestamp: new Date().toISOString(),
    gitCommit: gitCommit(),
    apiUrl: api,
    executionProvider: config.executionProvider ?? null,
    riskAnalyzerConfigured: config.riskAnalyzer ?? null,
    evidenceSchemaVersion: 1,
    ruleVersion: "1",
    jevPolicyVersion: "1",
    jevAnalyzerVersion: "1",
    repetitionsRequested: args.reps,
    jevLive: true,
    outRoot,
    product: {
      api: "TypeSafe System One",
      endpoint: "https://api.typesafe.ai/v1/systemone",
      questionType: "choice",
      options: ["low", "review", "high"],
      docs: "https://docs.typesafe.ai/api",
      confidenceSemantics:
        "Choice confidence is derived from the probability distribution across options; NOT a probability the script is malicious.",
    },
    warnings: [
      "Closed corpus was used to develop deterministic v1 — not independent generalization.",
      "Do not tune deterministic ruleVersion 1 after holdout/Jev results; create ruleVersion 2 if needed.",
      "Pipeline validation only — not production accuracy.",
      "Jev is advisory only and cannot authorize Deno/Docker/Host Gateway actions.",
    ],
    corpora: {
      closed_development: {
        n: closedRows.length,
        jevAgreementWithReference: closedRows.filter((r) =>
          r.agreementWithReference
        ).length,
        detAgreementWithReference: closedRows.filter((r) =>
          r.deterministicClassification === r.referenceLabel
        ).length,
        jevAgreementWithDeterministic: closedRows.filter((r) =>
          r.agreementWithDeterministic
        ).length,
        confusionJevVsReference: confusion(closedRows, "jevClassification"),
        perClassJev: perClass(confusion(closedRows, "jevClassification")),
      },
      holdout_variant: {
        n: holdoutRows.length,
        jevAgreementWithReference: holdoutRows.filter((r) =>
          r.agreementWithReference
        ).length,
        detAgreementWithReference: holdoutRows.filter((r) =>
          r.deterministicClassification === r.referenceLabel
        ).length,
        jevAgreementWithDeterministic: holdoutRows.filter((r) =>
          r.agreementWithDeterministic
        ).length,
        confusionJevVsReference: confusion(holdoutRows, "jevClassification"),
        perClassJev: perClass(confusion(holdoutRows, "jevClassification")),
      },
    },
    latency: {
      jev: {
        n: jevLatencies.length,
        min: jevLatencies.length ? Math.min(...jevLatencies) : null,
        max: jevLatencies.length ? Math.max(...jevLatencies) : null,
        mean: mean(jevLatencies),
        median: median(jevLatencies),
        p95: percentile(jevLatencies, 95),
      },
      deterministic: {
        n: detLatencies.length,
        min: detLatencies.length ? Math.min(...detLatencies) : null,
        max: detLatencies.length ? Math.max(...detLatencies) : null,
        mean: mean(detLatencies),
        median: median(detLatencies),
        p95: percentile(detLatencies, 95),
      },
    },
    repeatability: {
      scenarios: repeatability,
      fullyStableCount: repeatability.filter((r) => r.stable).length,
      unstableCount: repeatability.filter((r) => !r.stable).length,
    },
    confidenceExploratory: {
      note:
        "Distribution-derived confidence; Brier omitted as misleading for research labels.",
      meanConfidenceWhenCorrect: mean(confCorrect),
      meanConfidenceWhenIncorrect: mean(confIncorrect),
      nCorrectWithConfidence: confCorrect.length,
      nIncorrectWithConfidence: confIncorrect.length,
      brierScore: null,
    },
    failures: {
      count: failures.length,
      byKind: failures.reduce((acc, r) => {
        const k = r.jevFailureKind || r.jevStatus || "unknown";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    },
    sensitivity: {
      rows: sensitivityRows,
      note: sensitivity.description,
    },
  };

  writeFileSync(join(outRoot, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(outRoot, "runs.json"), JSON.stringify(runs, null, 2));

  const csvHeader = [
    "scenario",
    "corpusType",
    "referenceLabel",
    "deterministicClassification",
    "deterministicRules",
    "jevRun",
    "jevClassification",
    "jevConfidence",
    "jevLatencyMs",
    "jevStatus",
    "agreementWithReference",
    "agreementWithDeterministic",
    "evidenceSchemaVersion",
    "ruleVersion",
    "providerModel",
    "presentation",
    "timestamp",
  ];
  const csvLines = [
    csvHeader.join(","),
    ...resultRows.map((r) =>
      [
        r.scenario,
        r.corpusType,
        r.referenceLabel,
        r.deterministicClassification,
        (r.deterministicRules ?? []).join("|"),
        r.jevRun,
        r.jevClassification,
        r.jevConfidence,
        r.jevLatencyMs,
        r.jevStatus,
        r.agreementWithReference,
        r.agreementWithDeterministic,
        r.evidenceSchemaVersion,
        r.ruleVersion,
        r.providerModel,
        r.presentation,
        r.timestamp,
      ].map(csvEscape).join(",")
    ),
  ];
  writeFileSync(join(outRoot, "results.csv"), csvLines.join("\n"));
  saveProgress(outRoot, completedKeys, { phase: "complete" });

  console.log("\n--- advisory risk comparison ---");
  console.log(`wrote ${outRoot}`);
  console.log(
    `closed: jev↔ref ${summary.corpora.closed_development.jevAgreementWithReference}/${summary.corpora.closed_development.n}`,
  );
  console.log(
    `holdout: jev↔ref ${summary.corpora.holdout_variant.jevAgreementWithReference}/${summary.corpora.holdout_variant.n}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
