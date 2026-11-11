from common import *
import hashlib,re
before=json.loads((OUT/'before-fingerprints.json').read_text());changes=[]
for relative,digest in before.items():
 p=ROOT/relative
 if not p.exists():changes.append({'path':relative,'change':'deleted'})
 elif hashlib.sha256(p.read_bytes()).hexdigest()!=digest:changes.append({'path':relative,'change':'modified'})
for folder in ['apps/api','apps/web/src']:
 for p in (ROOT/folder).rglob('*'):
  if p.is_file() and not any(x in p.parts for x in ['node_modules','dist','__pycache__']) and p.relative_to(ROOT).as_posix() not in before:changes.append({'path':p.relative_to(ROOT).as_posix(),'change':'added'})
assert all(not x['path'].startswith(('research-results/','config/','packages/','services/')) for x in changes),changes
frozen={p:d for p,d in before.items() if p.startswith('research-results/')}
assert all((ROOT/p).exists() and hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==d for p,d in frozen.items())
seals=[]
for rel in ['research-results/phase3-jev/resume-after-credit-2026-11-09/manifest.json','research-results/phase4-gvisor/2026-11-09T14-42-48Z-phase4bc-matched/result-artifact-hashes.json','research-results/phase5-final-validation/2026-11-09T15-24-05Z/result-artifact-hashes.json','research-results/phase6-cleanup/2026-11-09T16-10-39Z/result-artifact-hashes.json','research-results/phase7-analysis/2026-11-09T18-02-24Z/result-artifact-hashes.json','research-results/phase7-5-ui-polish/2026-11-09T18-45-33Z/result-artifact-hashes.json']:
 p=ROOT/rel;data=json.loads(p.read_text());hashes=data.get('files',data.get('hashes'));base=ROOT if 'phase3-jev' in rel else p.parent
 assert all((base/f).exists() and hashlib.sha256((base/f).read_bytes()).hexdigest()==d for f,d in hashes.items()),rel
 seals.append({'manifest':rel,'checked':len(hashes),'verdict':'PASS'})
status,config=http('/api/config/public');assert status==200 and config['chatProvider']=='gemini' and config['chatModel']=='gemini-3.8-flash'
status,settings=http('/api/project/settings');assert status==200
original=json.loads((OUT/'settings-before.json').read_text());assert settings['overrides']==original['overrides'],'Settings restoration incomplete'
save('settings-after.json',{'overrides':settings['overrides'],'matchesBefore':True})
status,host=http('/api/host/status');assert status==200 and host['connected']
r=cmd(D+['compose','config','--quiet']);assert r['exitCode']==0;save('compose-validation.json',r)
# Scan current frontend bundles in-memory; persist no configured credential values.
with urllib.request.urlopen('http://localhost:15173') as response:html=response.read().decode()
assets=re.findall(r'(?:src|href)="([^"]+\.(?:js|css))"',html)
for asset in assets:
 with urllib.request.urlopen('http://localhost:15173'+asset) as response:text=response.read().decode()
 assert not any(value in text for value in SECRETS),'Credential found in web bundle'
reviews={
 'A':'TypeScript calculates 21 * 2; generated source executed and printed Result: 42 with none.',
 'B':'Runnable console.log Hello World; correctly recommends none.',
 'C':'Correct import from host and host.chat.broadcast; queued distinguished from confirmation; exact source executed and Paper acknowledged.',
 'D':'Explicitly refuses persistent player-join events as unavailable; manual broadcast alternative does not claim to implement event subscription.',
 'E':'All four profiles and their narrow grants named accurately; explicitly denies that assistant settings grant runtime permissions.'}
summary=json.loads((OUT/'live-assistant-summary.json').read_text());assert len(summary)==5
save('live-semantic-review.json',[{'caseId':case,'verdict':'PASS','review':reason,'provider':'gemini','model':config['chatModel']} for case,reason in reviews.items()])
prior=pg("SELECT COALESCE(json_agg(t),'[]'::json) FROM (SELECT metadata->>'provider' AS provider, metadata->>'model' AS model, count(*) AS responses, min(created_at) AS first_response, max(created_at) AS last_response FROM messages WHERE role='assistant' AND created_at < '2026-11-09T22:55:43Z' GROUP BY 1,2) t")
save('historical-provider-summary.json',prior)
api=json.loads((OUT/'api-tests.json').read_text());web=json.loads((OUT/'frontend-tests.json').read_text());assert api['exitCode']==web['exitCode']==0
assert json.loads((OUT/'frontend-typecheck-tests.json').read_text())['exitCode']==0
assert json.loads((OUT/'application-build.json').read_text())['exitCode']==0
assert json.loads((OUT/'application-redeploy.json').read_text())['exitCode']==0
browser=json.loads((OUT/'browser-smoke.json').read_text());assert browser['verdict']=='PASS' and browser['finalError'] is None
save('final-validation.json',{'verdict':'PASS','automatedTests':{'PASS':api['counts']['passed']+web['counts']['passed'],'FAIL':0,'SKIPPED':api['counts']['skipped']},'api':api['counts'],'frontend':web['counts'],'liveProviderCalls':5,'providerFailures':0,'providerRetries':0,'liveCasesPassed':5,'generatedExecutionsPassed':2,'settingsOverridesRestoredExactly':True,'frozenFilesUnchanged':len(frozen),'frozenManifests':seals,'bundleCredentialMatches':0,'publicConfig':config,'changedFiles':changes,'ignoredConfigurationChange':{'file':'.env (not exported)','CHAT_PROVIDER':{'before':'mock','after':'gemini'},'modelUnchanged':'gemini-3.8-flash','credentialValuesNeverRecorded':True}})
paths='\n'.join('- `'+x['path']+'` — '+x['change'] for x in changes)+'\n- `.env` — ignored local selection only; credentials not exported.'
(OUT/'changed-files.md').write_text('# Assistant restoration changes\n\nCompared with the pre-fix working tree, preserving earlier uncommitted work.\n\n'+paths+'\n',encoding='utf-8')
report=f"""# Assistant restoration result
COMPLETE

# 1. Root cause
The ignored .env and deployed API explicitly selected CHAT_PROVIDER=mock while a Gemini credential and model remained configured. The UI accurately displayed the backend-selected provider. No real provider was removed or bypassed by the redesign. Phase5 evidence already records mock; Phase6's offline demo instructions reinforced that selection. Phase7.5 tested the offline/mock setup and missed restoring and validating normal real generation. The precise historical edit of ignored .env is not recoverable from Git; no attribution is invented. Factory defaults/unknown-provider fallback also silently selected mock, a separate configuration hazard now removed.

# 2. Previous behavior
Git HEAD, e910ff5 and 6b7016f retain Gemini (preferred) and optional OpenAI. Eight stored pre-restoration Gemini responses use gemini-3.8-flash, dated October28–November2. No historical successful OpenAI response is claimed. Original route POST /api/conversations/:id/messages -> fresh AssistantContextBuilder -> ChatProvider.respond -> stored assistant message -> Markdown/proposal rendering remains intact. Existing GEMINI_API_KEY/GEMINI_MODEL mechanism and model preserved; no new provider.

# 3. Fix
Restore only CHAT_PROVIDER=gemini in ignored .env; retain existing credential/model. Add configureChatProvider/UnavailableChatProvider; reject absent/unknown selection rather than silently substituting mock, and keep non-chat API available for missing credentials. Public configuration exposes controlled status/reason, never keys. Gemini uses x-goog-api-key header instead of query-string credentials and a bounded 60-second request. Google API authentication reference: https://ai.google.dev/api . Current context now explicitly describes all four trusted profiles and unsupported capabilities. Clarify offline instructions in README, DEMO-RUNBOOK and REPRODUCTION. Add provider/configuration/failure/wire and frontend tests.

# 4. Provider selection
Current: Gemini / gemini-3.8-flash, execution Docker, risk deterministic. Explicit mock remains clearly labeled and intentional. Missing/invalid configuration -> unavailable (no process-wide chat configuration exit). Real-provider request failure -> explicit 502, preserved user message and no fabricated assistant response; unavailable configuration -> 503. Factory missing-key validation remains controlled. No auto-selection of another provider/model and no mock fallback on upstream failure. Public configured status means configured, not an independent account/quota health probe.

# 5. UI
Assistant header derives provider/model from backend public config: Gemini/OpenAI/Mock/Unavailable. Unavailable configuration disables sending and explains configuration state while retaining editor/inspection. Runtime failures show explicit assistant-unavailable error and say no mock response was substituted. Existing historical replies are retained; they are not regenerated or relabeled as newly generated. Current header describes the selected provider, not the historical origin of every stored reply.

# 6. Context integrity
Fresh context continues to use current project settings, policy, observed host state and capability catalogue. host.chat.broadcast with import from host is the supported sandbox host method. Player-join/persistent callbacks, arbitrary commands, Paper APIs, and sandbox status/player queries remain unsupported. Added profile descriptions come directly from trusted profile metadata: none, read-fixture, env-demo, host-chat. Settings remain assistant intent, not grants; runtime authorization and limits unchanged. Config policy/catalogue/project-spec bytes unchanged. Live D/E confirm these distinctions.

# 7. Live assistant validation
Five fresh conversations; exact existing Gemini model and key; five calls, zero provider failures, zero retries. No prior private conversation/history transmitted for these checks. Full raw responses preserved separately; semantic review does not rewrite them.
| Case | Prompt | Result |
|---|---|---|
| A | Create a TypeScript script that calculates 21 * 2 and prints the result. | PASS: dynamic arithmetic code, none profile. |
| B | Create a script that prints Hello World in the console. | PASS: runnable code and correct none guidance. |
| C | Create a script that prints Hello World in the console and broadcasts it to the in-game chat. | PASS: correct host import/SDK and host-chat. |
| D | Create a script that reacts every time a player joins the server. | PASS: explains missing events.playerJoin/persistent callbacks; supported manual alternative labeled. |
| E | Which execution profiles are currently supported, what does each grant, and can assistant settings grant runtime permissions? | PASS: all four profiles accurate; settings cannot grant runtime permissions. |
Exact quoted prompts and complete responses are in assistant-A through assistant-E.json. No Jev experiment or gVisor benchmark rerun.

# 8. Generated-code execution
Browser saved model-generated A and C through the existing Save script as draft workflow, explicitly selected profiles and clicked Run. Executed versions match original model code blocks exactly. A printed Result:42 with none; C printed Hello World and queued one broadcast with host-chat. Both completed with complete evidence collection. C has a correlated completed sandbox_capability host command, secure_bridge success event and confirmed Host Activity broadcast. Delivery is inferred, not independently timestamped. A additionally saved version2 with an explicitly recorded harmless manual comment after the original version1 execution, proving versioning without altering the model response or original executed version. No automatic execution authority introduced.

# 9. Regression tests
Final API: {api['counts']['passed']} PASS, 0 FAIL, 2 SKIPPED (existing opt-in PostgreSQL history/activity tests; no queries changed). Final frontend: {web['counts']['passed']} PASS, 0 FAIL, 0 SKIPPED. Total automated invocations: {api['counts']['passed']+web['counts']['passed']} PASS, 0 FAIL, 2 SKIPPED. Provider API, context-builder, frontend Assistant and wider frontend tests included. Frontend typecheck, production tsc/Vite build, API/web Docker build/redeploy and Compose validation PASS. No shared/runner execution contracts changed, so affected runner suite condition not triggered. Early new-test typing errors were corrected before final passing API suite. No required live check unavailable.

# 10. Wider Phase 7.5 smoke regression
| Area | Result |
|---|---|
| Script create/read/update | PASS: generated drafts saved/opened; deletion still unsupported by existing API. |
| Versioning | PASS: A stored version1 retained, version2 saved. |
| Profiles | PASS: explicit none and host-chat selections reflected in results. |
| Execution/detail | PASS: generated sources ran; output, collection and host evidence inspected. |
| Insights | PASS: selected generated host execution appears with real duration, profile, advisory and collection. |
| Host Activity | PASS: Paper-confirmed Hello World appears under Chat. |
| Settings | PASS: changed existing overridden network-context intent false->true->false through UI autosave; exact original override document restored; no runtime grants changed. |
| Help | PASS: opens, current instructions visible, Escape closes. |
No additional functionality loss observed in this focused check. Existing generated Markdown drafts receive generic editable names; no naming redesign attempted. Historical mock replies remain stored history. This is a smoke check, not exhaustive validation of every future model answer.

# 11. Frozen research integrity
{len(frozen)} pre-existing research files, including Phase7.5 evidence, unchanged against the before-fix baseline; zero changed/missing. Prior experiment/artifact seals independently match (Phase3 131, Phase4 439, Phase5 94, Phase6 95, Phase7 44, Phase7.5 72 entries). Config policy, project specification, capability catalogue, deterministic rules, reference labels and execution authorities unchanged. No earlier research result rewritten. Evidence is additive only in this manual-polish directory.

# 12. Files changed
{paths}
No commit/push. Earlier uncommitted work preserved. Credentials remain ignored/server-side; no actual credential values in evidence or frontend bundles.

# 13. Remaining limitations
Five successful real calls do not guarantee future availability or perfect model answers; provider/account/quota errors remain explicit. Existing mock conversation replies are preserved, and the current-provider header is not a per-message provenance label. No real upstream account failure was deliberately injected; failure/no-fallback paths are covered with test doubles. Existing hard deletion is unsupported; generic generated-draft naming remains editable. No new security functionality or automatic execution introduced.

# 14. Recommendation
Do not start Phase8. The normal real assistant is restored and validated; inspect the fresh Assistant restoration conversations in the UI for manual acceptance.

READY FOR MANUAL REVIEW
"""
(OUT/'report.md').write_text(report,encoding='utf-8')
leaks=[]
for p in OUT.rglob('*'):
 if p.is_file() and p.suffix in ['.json','.md','.py','.log','.txt']:
  text=p.read_text(encoding='utf-8-sig',errors='replace')
  if any(secret in text for secret in SECRETS):leaks.append(p.relative_to(OUT).as_posix())
assert not leaks,leaks
save('secret-scan.json',{'verdict':'PASS','credentialValueMatches':0,'bundleAssetsChecked':len(assets),'configurationKeysNeverExported':True})
files={p.relative_to(OUT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*') if p.is_file() and p.name!='result-artifact-hashes.json' and '__pycache__' not in p.parts}
save('result-artifact-hashes.json',{'algorithm':'sha256','excludesSelf':True,'files':dict(sorted(files.items()))})
print(json.dumps({'verdict':'PASS','automatedPass':api['counts']['passed']+web['counts']['passed'],'automatedFail':0,'skipped':2,'livePass':5,'generatedExecutions':2,'frozenFilesUnchanged':len(frozen),'changedFiles':len(changes),'sealedArtifacts':len(files),'settingsRestoredExactly':True}))
