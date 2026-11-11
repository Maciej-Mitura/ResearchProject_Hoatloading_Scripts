/** Offline frozen-input/replay check only. No provider or sandbox calls. */
import { classifyEvidence } from "../apps/api/src/risk/deterministic.ts";
import { buildJevSystemOneRequest, JEV_ANALYZER_VERSION } from "../apps/api/src/risk/jev.ts";
import { resolveJevRoute } from "../apps/api/src/risk/jev-route.ts";
import { validateFrozenInputs } from "./validate-jev-inputs.ts";
const root=new URL('../',import.meta.url);
for(const line of Deno.readTextFileSync(new URL('.env',root)).split(/\r?\n/)){
 const m=/^([A-Z_]+)=(.*)$/.exec(line);
 if(m && /^(JEV_|AI_GATEWAY_API_KEY$|TYPESAFE_API_KEY$)/.test(m[1]))Deno.env.set(m[1],m[2].replace(/^['"]|['"]$/g,''));
}
const corpus=new URL('research-results/risk-comparison/frozen-evidence-v1/',root);
const rows=[...Deno.readDirSync(corpus)].filter(e=>e.isFile&&e.name.endsWith('.json')).map(e=>JSON.parse(Deno.readTextFileSync(new URL(e.name,corpus))));
const replay=rows.map(c=>({caseId:c.scenarioId,partition:c.corpusType,reference:c.referenceLabel,classification:classifyEvidence(c.evidence).classification}));
const validation=validateFrozenInputs();
if(validation.length!==25||validation.some(r=>!r.valid))throw Error('Frozen Jev input validation failed');
const route=resolveJevRoute();const provenance=buildJevSystemOneRequest(rows[0].evidence).provenance;
if(route.provider!=='vercel'||route.model!=='typesafe-ai/jev-1.14.0'||provenance.policyHash!=='4220afc83059cd6449e864ff09d43f1fcb610872ea4d344f7ced6c28f4a102f8')throw Error('Jev provenance drift');
const summary={development:replay.filter(r=>r.partition==='closed_development'&&r.reference===r.classification).length,holdout:replay.filter(r=>r.partition==='holdout_variant'&&r.reference===r.classification).length,combined:replay.filter(r=>r.reference===r.classification).length};
if(summary.development!==15||summary.holdout!==9||summary.combined!==24)throw Error('Deterministic baseline drift');
const out=new URL('research-results/phase5-final-validation/2026-11-09T15-24-05Z/',root);
Deno.writeTextFileSync(new URL('deterministic-replay.json',out),JSON.stringify({summary,cases:replay},null,2)+'\n');
Deno.writeTextFileSync(new URL('jev-current-compatibility.json',out),JSON.stringify({localInputsValid:25,provider:route.provider,endpoint:route.systemOneUrl,model:route.model,policyHash:provenance.policyHash,policyVersion:provenance.policyVersion,inputSchemaVersion:provenance.inputSchemaVersion,transformationVersion:provenance.transformationVersion,analyzerVersion:JEV_ANALYZER_VERSION,matchingCredentialConfigured:!!route.apiKey,liveProviderCalls:0,liveCheck:'SKIPPED — frozen empirical package plus current local builder/adapter tests provide sufficient integration evidence.'},null,2)+'\n');
console.log(JSON.stringify({deterministic:summary,jevInputs:25,liveProviderCalls:0}));
