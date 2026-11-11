/** Additive orchestration only: uses the frozen Phase 3 builder and adapter unchanged. */
import { buildJevSystemOneRequest, JevRiskAnalyzer, sanitizeProviderText } from "../apps/api/src/risk/jev.ts";
import { sha256 } from "../apps/api/src/risk/jev-policy.ts";
import { resolveJevRoute } from "../apps/api/src/risk/jev-route.ts";
import { classifyEvidence } from "../apps/api/src/risk/deterministic.ts";
import { validateFrozenInputs } from "./validate-jev-inputs.ts";
import type { JevStatePresentation } from "../apps/api/src/risk/jev-input.ts";

const root = new URL("../", import.meta.url);
const dir = new URL("research-results/phase3-jev/resume-after-credit-2026-11-09/", root);
const read = (path: string) => JSON.parse(Deno.readTextFileSync(new URL(path, dir)));
const manifest = read("manifest.json");
const context = read("resume-context.json");
const secretValues: string[] = [];
for (const line of Deno.readTextFileSync(new URL(".env", root)).split(/\r?\n/)) {
  const match = /^([A-Z_]+)=(.*)$/.exec(line);
  if (!match) continue;
  const value = match[2].replace(/^['"]|['"]$/g, "");
  if (/^(JEV_|TYPESAFE_API_KEY$|AI_GATEWAY_API_KEY$)/.test(match[1])) Deno.env.set(match[1], value);
  if (/(?:KEY|TOKEN|PASSWORD|SECRET)$/.test(match[1]) && value.length >= 8) secretValues.push(value);
}
const route = resolveJevRoute();
if (route.provider !== "vercel" || route.model !== "typesafe-ai/jev-1.14.0" || route.systemOneUrl !== "https://ai-gateway.vercel.sh/typesafe/v1/systemone" || !route.apiKey) throw Error("STOP: route/model/credential mismatch");
const clean = (value: unknown): unknown => {
  if (typeof value === "string") {
    for (const secret of secretValues) value = (value as string).replaceAll(secret, "REDACTED");
    return sanitizeProviderText(value as string, 5000);
  }
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
  return value;
};
const save = (name: string, value: unknown) => Deno.writeTextFileSync(new URL(name, dir), JSON.stringify(clean(value), null, 2) + "\n");
function verifyFrozen() {
  for (const [path, hash] of Object.entries(manifest.hashes)) if (sha256(Deno.readTextFileSync(new URL(path, root))) !== hash) throw Error("STOP: frozen hash mismatch: " + path);
  for (const [path, hash] of Object.entries(context.previousResultsHashes)) if (sha256(Deno.readTextFileSync(new URL(path, root))) !== hash) throw Error("STOP: historical hash mismatch: " + path);
}
verifyFrozen();
const validations = validateFrozenInputs();
if (validations.length !== 25 || validations.some((row) => !row.valid)) throw Error("STOP: input validation");
const corpus = new URL("research-results/risk-comparison/frozen-evidence-v1/", root);
const cases = [...Deno.readDirSync(corpus)].filter((f) => f.isFile && f.name.endsWith(".json")).map((f) => ({ file: f.name, ...JSON.parse(Deno.readTextFileSync(new URL(f.name, corpus))) })).sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
const baseline = cases.map((c) => ({ caseId: c.scenarioId, partition: c.corpusType, reference: c.referenceLabel, classification: classifyEvidence(c.evidence).classification }));
if (baseline.filter((c) => c.reference === c.classification).length !== 24 || baseline.filter((c) => c.partition === "closed_development" && c.reference === c.classification).length !== 15 || baseline.filter((c) => c.partition === "holdout_variant" && c.reference === c.classification).length !== 9 || baseline.find((c) => c.caseId === "HOL-008")?.classification === baseline.find((c) => c.caseId === "HOL-008")?.reference) throw Error("STOP: baseline changed");
const smoke = read("smoke-attempts.json");
if (read("summary.json").status !== "passed" || smoke.length !== 3 || smoke.some((row: any, i: number) => row.caseId !== ["SCN-001", "SCN-005", "SCN-011"][i] || row.result.status !== "ok" || !row.modelProvenanceValid || row.httpStatus !== 200)) throw Error("STOP: smoke gate");
const prepared = read("requests.json");
const sensitivity = JSON.parse(Deno.readTextFileSync(new URL("fixtures/scenarios/sensitivity.json", root)));
const jobs: { stage: string; caseId: string; round: number | null; presentation: JevStatePresentation; variant: string | null }[] = [];
for (let round = 1; round <= 5; round++) for (const c of cases) jobs.push({ stage: "primary", caseId: c.scenarioId, round, presentation: "canonical", variant: null });
for (const caseId of sensitivity.selectScenarioIds) for (const variant of sensitivity.variants) jobs.push({ stage: "sensitivity", caseId, round: null, presentation: variant.presentation, variant: variant.id });
const build = (caseId: string, presentation: JevStatePresentation) => buildJevSystemOneRequest(cases.find((c) => c.scenarioId === caseId).evidence, { provider: route.provider, model: route.model, endpoint: route.systemOneUrl, presentation, secretValues });
const requestSet = [...cases.map((c) => ({ caseId: c.scenarioId, presentation: "canonical" as JevStatePresentation })), ...jobs.filter((j) => j.stage === "sensitivity")].map((j) => ({ caseId: j.caseId, presentation: j.presentation, request: build(j.caseId, j.presentation) }));
for (const row of requestSet) {
  const serialized = JSON.stringify(row.request.body);
  if (!row.request.integrity.safe || secretValues.some((s) => serialized.includes(s)) || /"(?:stdout|stderr|scriptSource|referenceLabel|scenarioId|ruleMatches|deterministic)"/.test(serialized)) throw Error("STOP: payload guard");
  if (row.request.provenance.policyHash !== "4220afc83059cd6449e864ff09d43f1fcb610872ea4d344f7ced6c28f4a102f8") throw Error("STOP: policy hash");
  if (row.presentation === "canonical" && prepared.find((p: any) => p.caseId === row.caseId).request.provenance.requestHash !== row.request.provenance.requestHash) throw Error("STOP: prepared request changed");
}
for (const row of smoke) if (row.provenance.requestHash !== build(row.caseId, "canonical").provenance.requestHash) throw Error("STOP: smoke request provenance");
const batchPlan = { sourceHash: sha256(Deno.readTextFileSync(new URL(import.meta.url))), methodology: "Existing frozen plan; orchestration added after successful smoke, without changing builder/adapter/policy", priorAttempts: context.previousProviderAttempts, smokeAttempts: smoke.length, maximumTotalAttempts: 150, jobs, requests: requestSet };
if (Deno.args.includes("--prepare")) {
  if (await exists("batch-plan.json")) throw Error("STOP: batch plan already exists");
  save("batch-plan.json", batchPlan);
  console.log("Prepared 125 primary and 15 predefined sensitivity jobs; all gates pass. No provider calls.");
  Deno.exit(0);
}
if (!Deno.args.includes("--execute")) throw Error("Use --prepare or --execute");
if (JSON.stringify(read("batch-plan.json")) !== JSON.stringify(clean(batchPlan))) throw Error("STOP: batch plan changed");
if (await exists("batch-state.json")) throw Error("STOP: batch already started; inspect persisted intents/results before any recovery");
async function exists(name: string) { try { await Deno.stat(new URL(name, dir)); return true; } catch (e) { if (e instanceof Deno.errors.NotFound) return false; throw e; } }
const rows: any[] = [];
let attempts = context.previousProviderAttempts + smoke.filter((r: any) => r.transmitted).length;
let stopped: string | null = null;
let completedJobs = 0;
save("batch-state.json", { status: "started", timestamp: new Date().toISOString(), totalAttempts: attempts });
try {
  for (let index = 0; index < jobs.length; index++) {
    const job = jobs[index];
    const c = cases.find((c) => c.scenarioId === job.caseId);
    const request = build(job.caseId, job.presentation);
    verifyFrozen();
    if (index % 25 === 0 || index === 125) {
      const health = await fetch("http://localhost:13000/health", { signal: AbortSignal.timeout(5000) }).then((r) => r.json());
      if (health.db !== "ok") throw Error("STOP: local persistence unhealthy");
      save(`batch-health-${index}.json`, { timestamp: new Date().toISOString(), health });
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempts >= 150) throw Error("STOP: total attempt ceiling");
      const timestamp = new Date().toISOString();
      const identity = `${job.stage}-${String(index + 1).padStart(3, "0")}-${job.caseId}-${attempt}`;
      const common = { ...job, jobIndex: index + 1, attempt, retryCount: attempt - 1, timestamp, partition: c.corpusType, evidenceHash: manifest.hashes['research-results/risk-comparison/frozen-evidence-v1/' + c.file], provenance: request.provenance };
      save(`intent-${identity}.json`, { ...common, maximumAttemptOrdinal: attempts + 1 });
      let httpStatus: number | null = null;
      let providerDiagnostic: string | null = null;
      let transmitted = false;
      const analyzer = new JevRiskAnalyzer({ provider: route.provider, endpoint: route.systemOneUrl, model: route.model, apiKey: route.apiKey, presentation: job.presentation, fetchImpl: async (url, init) => {
        if (String(url) !== route.systemOneUrl || sha256(String((init as { body?: unknown })?.body)) !== request.provenance.requestHash) throw Error("STOP: actual request mismatch");
        transmitted = true;
        attempts++;
        const response = await fetch(url, init);
        httpStatus = response.status;
        const text = await response.text();
        if (!response.ok) providerDiagnostic = sanitizeProviderText(text, 2000);
        return new Response(text, { status: response.status, headers: response.headers });
      } });
      const result = await analyzer.classify(c.evidence);
      const valid = result.status === "ok" && [route.model, "jev-1.14.0"].includes(String(result.providerMetadata.responseModel)) && result.providerMetadata.requestHash === request.provenance.requestHash;
      const row = { ...common, transmitted, totalAttemptOrdinal: attempts, httpStatus, providerDiagnostic, parsingStatus: result.status === "ok" ? "valid" : "not_successfully_classified", modelProvenanceValid: valid, technicallyValid: valid, result };
      rows.push(row);
      save(`result-${identity}.json`, row);
      save("batch-attempts.json", rows);
      save("batch-state.json", { status: "running", completedJobs, totalAttempts: attempts, lastJob: job, lastAttempt: attempt });
      console.log(`${index + 1}/140 ${job.stage} ${job.caseId} round=${job.round} variant=${job.variant} attempt=${attempt} HTTP=${httpStatus} status=${result.status} class=${result.classification} total=${attempts}`);
      if (valid) { completedJobs++; break; }
      const transient = [429, 500, 502, 503, 504].includes(httpStatus ?? 0) || httpStatus === null && transmitted;
      if (!transient || attempt === 3) throw Error(`STOP: ${job.stage} ${job.caseId} job ${index + 1}, ${result.failureKind ?? "provenance_or_technical_failure"}, HTTP ${httpStatus}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  verifyFrozen();
} catch (error) { stopped = error instanceof Error ? error.message : String(error); }
save("batch-state.json", { status: stopped ? "stopped" : "complete", completedJobs, totalAttempts: attempts, stopped, timestamp: new Date().toISOString(), primarySuccessful: rows.filter((r) => r.stage === "primary" && r.technicallyValid).length, sensitivitySuccessful: rows.filter((r) => r.stage === "sensitivity" && r.technicallyValid).length });
console.log("Batch", stopped ?? "complete", "completed jobs", completedJobs, "total attempts including previous blocked smoke", attempts);
