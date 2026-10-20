/**
 * Controlled scenario corpus runner — real execution pipeline + deterministic labels.
 *
 * Usage: npm run scenarios
 * Requires API up with EXECUTION_PROVIDER=docker and RISK_ANALYZER=deterministic.
 *
 * Does NOT pass expectedResearchLabel / scenarioId into the classifier.
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = process.env.API_URL || "http://localhost:3000";
const manifestPath = join(root, "fixtures", "scenarios", "manifest.json");
const outDir = join(root, "research-results", "scenarios");

const LABELS = ["low", "review", "high"];

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

function parseReasons(reasons) {
  if (!Array.isArray(reasons)) return [];
  return reasons
    .map((r) => {
      const m = /^\[([A-Z0-9]+)\]/.exec(String(r));
      return m ? m[1] : null;
    })
    .filter(Boolean);
}

function confusionMatrix(rows) {
  const matrix = {};
  for (const a of LABELS) {
    matrix[a] = {};
    for (const b of LABELS) matrix[a][b] = 0;
  }
  for (const row of rows) {
    const ref = row.referenceLabel;
    const act = row.actualClassification;
    if (LABELS.includes(ref) && LABELS.includes(act)) {
      matrix[ref][act]++;
    }
  }
  return matrix;
}

function perClassStats(matrix) {
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
    const precision = tp + fp === 0 ? null : tp / (tp + fp);
    const recall = tp + fn === 0 ? null : tp / (tp + fn);
    stats[label] = { tp, fp, fn, precision, recall };
  }
  return stats;
}

async function main() {
  const filter = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  let scenarios = manifest.scenarios;
  if (filter.length) {
    scenarios = scenarios.filter((s) => filter.includes(s.id));
  }

  const health = await fetch(`${api}/health`).then((r) => r.json()).catch(
    () => null,
  );
  if (!health) {
    console.error(`API not reachable at ${api}`);
    process.exit(1);
  }

  const config = await fetch(`${api}/api/config/public`).then((r) => r.json())
    .catch(() => ({}));

  const runMeta = {
    kind: "controlled_poc_scenario_evaluation",
    timestamp: new Date().toISOString(),
    gitCommit: gitCommit(),
    apiUrl: api,
    corpusVersion: manifest.corpusVersion,
    evidenceSchemaVersion: 1,
    ruleVersion: "1",
    executionProvider: config.executionProvider ?? null,
    riskAnalyzer: config.riskAnalyzer ?? null,
    warning:
      "Controlled PoC scenario evaluation — not production accuracy or statistical generalization.",
  };

  console.log(
    `Running ${scenarios.length} scenarios against ${api} (provider=${runMeta.executionProvider}, risk=${runMeta.riskAnalyzer})`,
  );

  const results = [];

  for (const scn of scenarios) {
    const scriptPath = resolve(dirname(manifestPath), scn.scriptFile);
    if (!existsSync(scriptPath)) {
      console.error(`Missing script ${scriptPath}`);
      process.exit(1);
    }
    const source = readFileSync(scriptPath, "utf8");
    const referenceLabel = scn.expectedResearchLabel;

    process.stdout.write(`${scn.id} ${scn.name} ... `);

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
    if (!scriptId) {
      console.log("FAIL create");
      results.push({
        scenarioId: scn.id,
        error: "script_create_failed",
        referenceLabel,
      });
      continue;
    }

    const exec = await fetch(`${api}/api/executions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scriptId,
        permissionProfile: scn.permissionProfile,
      }),
    }).then((r) => r.json());

    if (!exec.id) {
      console.log("FAIL start");
      results.push({
        scenarioId: scn.id,
        error: "execution_start_failed",
        referenceLabel,
      });
      continue;
    }

    const detail = await waitExecution(exec.id);
    const e = detail.execution;
    const risks = await fetch(
      `${api}/api/risk-assessments?executionId=${encodeURIComponent(e.id)}`,
    )
      .then((r) => r.json())
      .catch(() => ({ items: [] }));

    const risk = (risks.items ?? []).find((r) => r.executionId === e.id) ??
      (risks.items ?? [])[0] ??
      null;

    const actualClassification = risk?.classification ?? "unknown";
    const matchedRules = parseReasons(risk?.reasons ?? []);
    const correct = actualClassification === referenceLabel;

    // Documented acceptable elevations (still controlled PoC evaluation):
    // - SCN-009: REVIEW reference; HIGH if R002 (run audit) appears
    // - SCN-012: REVIEW reference; HIGH if wall-clock timeout also hit (R006)
    const acceptable = correct ||
      (scn.id === "SCN-009" && actualClassification === "high" &&
        matchedRules.includes("R002")) ||
      (scn.id === "SCN-012" && actualClassification === "high" &&
        matchedRules.includes("R006") && matchedRules.includes("R007"));

    const row = {
      scenarioId: scn.id,
      name: scn.name,
      executionId: e.id,
      traceId: e.result?.traceId ?? detail.traceId ?? null,
      referenceLabel,
      actualClassification,
      matchedRules,
      score: risk?.score ?? null,
      analyzer: risk?.provider ?? null,
      durationMs: e.result?.durationMs ?? null,
      status: e.status,
      permissionProfile: scn.permissionProfile,
      permissionAccessCount: e.result?.permissionEvents?.length ?? 0,
      hostApiAllowedCount:
        (e.result?.hostApiEvents ?? []).filter((h) =>
          h.eventType === "host_api.allowed"
        ).length,
      hostApiDeniedCount:
        (e.result?.hostApiEvents ?? []).filter((h) =>
          h.eventType === "host_api.denied"
        ).length,
      timedOut: Boolean(e.result?.timedOut),
      outputTruncated: Boolean(e.result?.outputTruncated),
      failureCategory: e.result?.failureCategory ?? null,
      match: acceptable,
      exactMatch: correct,
    };
    results.push(row);
    console.log(
      `${e.status} risk=${actualClassification} rules=${matchedRules.join(",") || "-"} ${
        acceptable ? "OK" : "MISMATCH"
      }`,
    );
  }

  const evaluated = results.filter((r) => r.actualClassification);
  const exactCorrect = evaluated.filter((r) => r.exactMatch).length;
  const acceptableCorrect = evaluated.filter((r) => r.match).length;
  const matrix = confusionMatrix(evaluated);
  const classStats = perClassStats(matrix);

  const report = {
    ...runMeta,
    totals: {
      scenarios: evaluated.length,
      exactCorrect,
      exactIncorrect: evaluated.length - exactCorrect,
      acceptableCorrect,
      exactAccuracy: evaluated.length
        ? exactCorrect / evaluated.length
        : null,
      acceptableAccuracy: evaluated.length
        ? acceptableCorrect / evaluated.length
        : null,
    },
    confusionMatrix: matrix,
    perClass: classStats,
    results: evaluated,
  };

  mkdirSync(outDir, { recursive: true });
  const stamp = runMeta.timestamp.replace(/[:.]/g, "-");
  const jsonPath = join(outDir, `${stamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const csvHeader = [
    "scenarioId",
    "executionId",
    "referenceLabel",
    "actualClassification",
    "matchedRules",
    "score",
    "durationMs",
    "status",
    "permissionProfile",
    "permissionAccessCount",
    "hostApiAllowedCount",
    "hostApiDeniedCount",
    "timedOut",
    "outputTruncated",
    "exactMatch",
  ].join(",");
  const csvRows = evaluated.map((r) =>
    [
      r.scenarioId,
      r.executionId,
      r.referenceLabel,
      r.actualClassification,
      (r.matchedRules ?? []).join("|"),
      r.score ?? "",
      r.durationMs ?? "",
      r.status,
      r.permissionProfile,
      r.permissionAccessCount,
      r.hostApiAllowedCount,
      r.hostApiDeniedCount,
      r.timedOut,
      r.outputTruncated,
      r.exactMatch,
    ].join(",")
  );
  const csvPath = join(outDir, `${stamp}.csv`);
  writeFileSync(csvPath, [csvHeader, ...csvRows].join("\n"));

  console.log("\n--- controlled PoC scenario evaluation ---");
  console.log(
    `exact ${exactCorrect}/${evaluated.length} (${
      ((report.totals.exactAccuracy ?? 0) * 100).toFixed(1)
    }%)`,
  );
  console.log(
    `acceptable ${acceptableCorrect}/${evaluated.length} (${
      ((report.totals.acceptableAccuracy ?? 0) * 100).toFixed(1)
    }%)`,
  );
  console.log(`wrote ${jsonPath}`);
  console.log(`wrote ${csvPath}`);
  console.log(
    "Do NOT treat this accuracy as production accuracy or statistical generalization.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
