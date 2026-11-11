/** Frozen-input experiment driver. Prepare is offline; smoke is explicitly live. */
import { buildJevSystemOneRequest, JevRiskAnalyzer, sanitizeProviderText } from "../apps/api/src/risk/jev.ts";
import { classifyEvidence } from "../apps/api/src/risk/deterministic.ts";
import { sha256 } from "../apps/api/src/risk/jev-policy.ts";
import { resolveJevRoute } from "../apps/api/src/risk/jev-route.ts";
import { validateFrozenInputs } from "./validate-jev-inputs.ts";

const root = new URL("../", import.meta.url);
// Load credentials only into the trusted experiment process, never into a job.
for (const line of Deno.readTextFileSync(new URL(".env", root)).split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m && /^(JEV_|TYPESAFE_API_KEY$|AI_GATEWAY_API_KEY$)/.test(m[1])) Deno.env.set(m[1], m[2].replace(/^['"]|['"]$/g, ""));
}
const route = resolveJevRoute();
if (route.provider !== "vercel" || route.model !== "typesafe-ai/jev-1.14.0") throw Error("Unexpected experiment route/model");
const secrets = ["AI_GATEWAY_API_KEY", "TYPESAFE_API_KEY", "JEV_API_KEY"].map((k) => Deno.env.get(k) ?? "").filter((v) => v.length >= 8);
function sanitize(v: unknown): unknown {
  if (typeof v === "string") { for (const secret of secrets) v = (v as string).replaceAll(secret, "REDACTED"); return sanitizeProviderText(v as string, 5000); }
  if (Array.isArray(v)) return v.map(sanitize);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sanitize(x)]));
  return v;
}
const existing = Deno.args.find((a) => a.startsWith("--run="))?.slice(6);
const directory = existing ? new URL(existing.endsWith("/") ? existing : existing + "/", root) : new URL(`research-results/phase3-jev/${new Date().toISOString().replaceAll(":", "-")}/`, root);
Deno.mkdirSync(directory, { recursive: true });
const save = (name: string, data: unknown) => Deno.writeTextFileSync(new URL(name, directory), JSON.stringify(sanitize(data), null, 2) + "\n");
const corpus = new URL("research-results/risk-comparison/frozen-evidence-v1/", root);
const names = [...Deno.readDirSync(corpus)].filter((e) => e.isFile && e.name.endsWith(".json")).map((e) => e.name).sort();
const cases = names.map((name) => ({ file: name, ...JSON.parse(Deno.readTextFileSync(new URL(name, corpus))) }));
const hashes: Record<string, string> = {};
function fingerprint(dir: URL, prefix: string) {
  for (const e of Deno.readDirSync(dir)) {
    if (prefix === "research-results/" && e.name === "phase3-jev") continue;
    if (e.isDirectory) fingerprint(new URL(e.name + "/", dir), prefix + e.name + "/");
    else if (e.isFile) hashes[prefix + e.name] = sha256(Deno.readTextFileSync(new URL(e.name, dir)));
  }
}
fingerprint(new URL("research-results/", root), "research-results/");
for (const path of ["fixtures/scenarios/manifest.json", "fixtures/scenarios/holdout-manifest.json", "fixtures/scenarios/sensitivity.json", "config/jev-risk-policy-v2.md", "config/jev-risk-policy.md", "apps/api/src/risk/rules.ts", "apps/api/src/risk/deterministic.ts", "apps/api/src/risk/evidence.ts", "apps/api/src/risk/jev.ts", "apps/api/src/risk/jev-input.ts", "apps/api/src/risk/jev-route.ts", "scripts/phase3-jev.ts"]) hashes[path] = sha256(Deno.readTextFileSync(new URL(path, root)));
const validation = validateFrozenInputs();
if (validation.length !== 25 || validation.some((r) => !r.valid)) throw Error("STOP: frozen input validation failed");
for (const c of cases) {
  const request = buildJevSystemOneRequest(c.evidence);
  if (!request.integrity.safe || JSON.stringify(request.body.state).match(/"(?:stdout|stderr|scriptSource|referenceLabel|scenarioId|ruleMatches|deterministic)"/)) throw Error("STOP: unexpected request fields");
}
const replay = cases.map((c) => ({ caseId: c.scenarioId, partition: c.corpusType, reference: c.referenceLabel, classification: classifyEvidence(c.evidence).classification, reasons: classifyEvidence(c.evidence).reasons }));
const plan = JSON.parse(Deno.readTextFileSync(new URL("research-results/risk-comparison/experiment-manifest.json", root)));
const sensitivity = JSON.parse(Deno.readTextFileSync(new URL("fixtures/scenarios/sensitivity.json", root)));
const first = buildJevSystemOneRequest(cases[0].evidence);
if (!existing) {
  const git = await new Deno.Command("C:/Program Files/Git/cmd/git.exe", { args: ["rev-parse", "HEAD"], cwd: root, stdout: "piped", stderr: "null" }).output();
  save("manifest.json", { experimentVersion: "phase3-current-policy2", frozenAt: new Date().toISOString(), toolingRuntime: Deno.version, gitCommit: new TextDecoder().decode(git.stdout).trim(), sourceIdentity: "Uncommitted implementation identified by hashes below", provenance: first.provenance, corpusCount: cases.length, partitions: { development: 15, holdout: 10 }, corpusHash: sha256(JSON.stringify(Object.fromEntries(names.map((n) => [n, hashes['research-results/risk-comparison/frozen-evidence-v1/' + n]])))), referenceHashes: { development: hashes['fixtures/scenarios/manifest.json'], holdout: hashes['fixtures/scenarios/holdout-manifest.json'] }, ruleHash: hashes['apps/api/src/risk/rules.ts'], hashes, repetitions: plan.repetitionsPlanned, primaryCalls: 125, smokeCalls: 3, sensitivityCalls: 15, totalPlannedCalls: 143, maxAttempts: 150, order: "smoke SCN-001/005/011; five rounds, lexically ordered cases per round; then predefined sensitivity", maxRetries: 2, sensitivity, historicalDifference: "Historical manifest used policy1/direct jev-latest; this additive experiment uses current policy2 and pinned Vercel model. Old manifest untouched." });
  save("local-validation.json", validation);
  save("deterministic-replay.json", replay);
  save("requests.json", cases.map((c) => ({ caseId: c.scenarioId, request: buildJevSystemOneRequest(c.evidence) })));
}
console.log("Results:", directory.pathname, "local inputs 25/25; baseline", replay.filter((r) => r.reference === r.classification).length + "/25");
if (!Deno.args.includes("--smoke")) Deno.exit(0);
const health = await fetch("http://localhost:13000/health", { signal: AbortSignal.timeout(5000) }).then((r) => r.json());
if (health.db !== "ok" || !route.apiKey) throw Error("STOP: database/credential preflight failed");
save("health-preflight.json", { ...health, matchingCredentialConfigured: true, credentialScope: "Trusted experiment process; no Docker executions performed" });
const attempts: unknown[] = [];
let smokeStatus = "passed";
for (const id of ["SCN-001", "SCN-005", "SCN-011"]) {
  const c = cases.find((c) => c.scenarioId === id);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const timestamp = new Date().toISOString();
    let httpStatus: number | null = null;
    let providerDiagnostic: unknown = null;
    let transmitted = false;
    const request = buildJevSystemOneRequest(c.evidence);
    // Write-ahead intent ensures an interrupted transmitted request is never silently retried.
    save(`intent-${id}-${attempt}.json`, { caseId: id, attempt, timestamp, evidenceHash: hashes['research-results/risk-comparison/frozen-evidence-v1/' + c.file], provenance: request.provenance });
    const analyzer = new JevRiskAnalyzer({ provider: route.provider, model: route.model, apiKey: route.apiKey, fetchImpl: async (url, init) => {
      transmitted = true;
      const response = await fetch(url, init);
      httpStatus = response.status;
      const text = await response.text();
      if (!response.ok) providerDiagnostic = sanitizeProviderText(text, 2000);
      return new Response(text, { status: response.status, headers: response.headers });
    } });
    const result = await analyzer.classify(c.evidence);
    const model = result.providerMetadata.responseModel;
    const valid = result.status === "ok" && [route.model, "jev-1.14.0"].includes(String(model));
    const row = { caseId: id, partition: c.corpusType, round: "smoke", attempt, timestamp, transmitted, httpStatus, providerDiagnostic, parsingStatus: result.status === "ok" ? "valid" : "not_successfully_classified", modelProvenanceValid: valid, evidenceHash: hashes['research-results/risk-comparison/frozen-evidence-v1/' + c.file], provenance: request.provenance, result };
    attempts.push(row); save(`smoke-${id}-${attempt}.json`, row); save("smoke-attempts.json", attempts);
    console.log(id, "attempt", attempt, "HTTP", httpStatus, "status", result.status, "failure", result.failureKind ?? null, "classification", result.classification);
    if (valid) break;
    const transient = [429, 500, 502, 503, 504].includes(httpStatus ?? 0) || httpStatus === null && transmitted;
    if (!transient || attempt === 3) { smokeStatus = "blocked"; break; }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
  if (smokeStatus === "blocked") break;
}
const unchanged = Object.entries(hashes).every(([p, h]) => sha256(Deno.readTextFileSync(new URL(p, root))) === h);
save("integrity-after.json", { unchanged, checked: Object.keys(hashes).length });
save("summary.json", { status: smokeStatus, plannedCalls: 143, primaryPlanned: 125, smokePlanned: 3, providerAttempts: (attempts as {transmitted: boolean}[]).filter((a) => a.transmitted).length, successfulClassifications: (attempts as {result: {status: string}}[]).filter((a) => a.result.status === "ok").length, attemptsRecorded: attempts.length, primaryRun: false, sensitivityRun: false, unchanged });
console.log("Smoke gate:", smokeStatus, "primary batch NOT started");
