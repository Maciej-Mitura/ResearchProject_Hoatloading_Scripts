# Capability manifest extension result

COMPLETE WITH LIMITATIONS

# Executive summary

- Added four typed capabilities with explicit per-version review and runtime enforcement.
- Gemini proposes source and requested capabilities; it cannot approve them.
- New reviews start unchecked, support partial denial and never carry to a new version.
- Executions use immutable database snapshots, source hashes and sandbox-address-bound sessions.
- API/Gateway/Paper integration validated; private-message success remains unverified while GoldennBullet is offline.
- Required regressions passed after resolving output-flood cleanup and review timestamp-ordering defects; earlier failures are retained.
- All 1,487 pre-existing research-result files are unchanged. No Jev/gVisor experiment, Phase 8, commit or push occurred.

# 1. Architecture
AI structured proposal → saved-version database manifest → explicit operator review → immutable execution approval snapshot → source-hash/session/address binding → per-call Gateway checks → independently validated explicit API queue command → typed SecureBridge/Paper operation. See architecture.md and threat-model.md.

# 2. Capability registry
chat.broadcast; server.status; player.sendMessage; world.spawnEntity. The shared registry owns metadata and validation; a generated resource supplies Paper's entity allowlist. Explicit Java enum/SDK projections are small and reviewed. No dynamic capability creation.

# 3. Manifest schema/versioning
Additive migrations 011 and 012 store immutable version requests, append-only approvals/denials and execution snapshots. A monotonic append order resolves tied timestamps. Each new version requires a fresh review. SHA-256 binds source. Unsupported requests remain visible but cannot be approved. See manifest-schema.md.

# 4. Assistant generation contract
Real existing Gemini gemini-3.8-flash uses JSON output with a schema: message plus nullable source/requested-capability proposal. Server validation rejects approval fields/malformed proposals and flags unsupported IDs. Conservative known-call matching warns about mismatch; it grants nothing. Five real requests passed (pure/chat/spawn/multi/unsupported), with no provider failure/retry. Settings and provider selection are preserved. See assistant-contract.md and assistant-summary.json.

# 5. Permission-review UX
Version permissions displays requested/approved/denied counts, status, reasons, constraints and impact. The modal starts entirely unchecked on every opening; unsupported requests are disabled. Dirty source requires saving/review again. Partial denial remains visible. Browser verification and permission-review.png document the result. Help/profile descriptions explain new versus legacy behavior.

# 6. User approval semantics
Only a separate review endpoint appends selected requested IDs; all other requests become denied. Cancel changes nothing. Approval never changes source, grants broad process permissions or treats advisory output as authorization. Existing local PoC has no user identity; no fictitious reviewer is recorded and no new authentication system was added.

# 7. Per-script/version authority
Cross-script version selection, stale manifest IDs, altered source and supplied execution approval snapshots are rejected. New versions cannot use legacy host-chat to bypass review. Later approval/denial records do not alter an already-started execution's snapshot. Database checks verify this behavior and append-only history.

# 8. Gateway enforcement
Registered ID, execution-bound credential, direct TCP peer address, explicit execution ID, approval, strict arguments/constraints, per-capability and total quotas are checked. The runner binds Docker-observed IP before sending source. Admin/service secrets remain outside sandboxes. Only a fixed registry mapping reaches the queue. Pending new-manifest commands expire after ten seconds or when their execution is no longer running.

# 9. Capability constraints/quotas
Broadcast and private message: <=256 printable characters; default maximum 5 calls each. Status: maximum 3 calls, no arguments, sanitized counts/version/public demo location. Spawn: maximum 3 calls, approved entity-type subset of ZOMBIE/SKELETON/COW/PIG; finite coordinates; first active world; within 32 horizontal blocks and -8..+16 vertical blocks of its spawn; loaded chunks only. Optional player-name allowlist narrows private messages. Global budget 12 authorized argument-valid calls. Demo mobs have AI/item pickup disabled and scheduled removal after 60 seconds.

# 10. Jev advisory integration
Deliberately omitted. Capability impact LOW/REVIEW is registry metadata, separate from frozen deterministic v1. No pre-execution accuracy claim, Jev call or Phase 3 metric reuse.

# 11. Host SDK
host.chat.broadcast(message), host.server.status(), host.player.sendMessage(playerName,message), host.world.spawnEntity({type,x,y,z}). Effect methods return typed accepted/success/error results; queue acceptance does not prove completion. Status throws when unconfirmed. Narrow existing SDK/network/env grants are reused by host-capabilities.

# 12. SecureBridge/Paper implementation
Explicit typed capability_status, send_player_message and spawn_entity operations extend the existing queue. Bukkit/Paper APIs run on the server thread. Arguments are checked again; offline players, unsupported entities, extra arguments and locations outside the loaded demo area are rejected. Existing bridge-only status/player-list operations remain backend-only. Java tests13/13 and real Paper results validate the added paths; successful private delivery is not claimed.

# 13. Live demonstrations
A: calculation 42, no host request/review. B: broadcast confirmed. C: generated code produced three Paper-confirmed ZOMBIE spawns. D: chat/status/three spawns confirmed; private delivery rejected because GoldennBullet was offline. E: approved chat confirmed and denied spawn blocked. F: manually added unapproved spawn blocked. G: SKELETON blocked under ZOMBIE-only approval. H: active copied credentials rejected from another sandbox, including a forged execution header; post-run credential401. See live-demo-results.md, generated-runtime-summary.json and runtime-H-summary.json.

# 14. Denial/tampering tests
Unapproved and unsupported capabilities, excessive quota, extra NBT, disallowed entity/player/arguments, caller-supplied call IDs/authority and stale/source/version mismatches tested. Rejections are evidence of authorization/constraint outcomes, not malware detections. Per-capability and global budgets have tests.

# 15. Cross-execution isolation
B's own unapproved session returned403; A's credential with B's execution ID returned403; A's credential with forged A ID from B's actual sandbox address returned403. After A completed, its credential returned401. Token/credential values were kept only in trusted harness memory, never in stored source, command-line arguments, exports or reports. Direct Docker-bridge peer binding is a deployment assumption, not independent runtime attestation.

# 16. Evidence/audit integration
Existing events retain execution/version/manifest IDs, approval status, constraints, bounded validated arguments, authorization outcome, call/command IDs, timestamp and denial reason. Trusted SecureBridge result records retain outcome/correlation. Backfill preserves new metadata. Cleartext execution credentials are redacted from captured output and rejected as capability arguments. This is not a detector for deliberately encoded covert data.

# 17. Export/Insights integration
Manifest JSON export includes requests and latest review. Selected-execution capability-evidence JSON includes the immutable snapshot and actual call/result/denial events. One concise usage table compares approval, requests, allowance, denial and Paper result counts; no additional chart was added. Workbench aggregates activity during a run. No general evidence-export contract was present to replace.

# 18. Backward compatibility
Historical none/read-fixture/env-demo/host-chat versions remain available without forced migration or new authority. Legacy chat retains queue acceptance semantics/default five-call limit. New versions use reviewed host-capabilities. Existing Assistant, editor, CRUD/versioning, evidence, history-first Insights, Host Activity, Settings, Help, theme behavior and brand remain. Current output floods now stop at the capture limit; this deliberate operational repair is documented below and does not alter frozen evidence.

# 19. Regression tests
Final runs: frontend 121 passed/0 failed; API 131 passed/0 failed/3 ignored opt-in database suites; runner 53 passed/0 failed; Gateway 32 passed/0 failed; Docker 22 passed/0 failed; Java 13 passed/0 failed. Deployed PostgreSQL suites: manifest 1, Host Activity 1, history 1 passed, all zero failures/skips. The manifest database suite also passed two additional ordering-repeat runs. Typecheck, production web build, all required images, registry-resource check and Compose validation passed. Real Gemini 5/5 responses. See tests.md for exact commands, retained failures and repair history.

Required Docker regression exposed a flooding-job cleanup fault: the current runner stops capture overflow, disables redundant daemon logs, stops workloads before attach disconnect, reaps CLI/pipe handles and bounds removal separately. The manifest records outputLimitAction=stop and dockerLogDriver=none. Initial failures are retained. A database timestamp tie exposed nondeterministic latest-review ordering; migration 012 fixes it without rewriting review content. The revoked new endpoint404 was corrected to401. A tooltip test was updated to the intentional new-version review wording.

# 20. Frozen research integrity
SHA-256 comparison against the captured baseline found all 1,487 prior research-result files unchanged. Frozen Jev/gVisor evidence, labels, policies, deterministic rules, metrics and conclusions were not edited or rerun. Current extension validations make no historical empirical claim. See frozen-integrity.json.

# 21. Files changed
See changed-files.md/json for the exact baseline-relative source/test/documentation inventory. Main areas: shared contracts/registry, additive database migrations/repository/routes, Gemini contract/context, execution snapshots, Gateway/session enforcement, runner binding/cleanup, typed SDK/Paper operations, permission review, usage/export, Help and current documentation. Timestamped artifacts are additional. No commit or push.

# 22. Limitations
Successful private-message delivery remains unverified while GoldennBullet is offline. Four capabilities only; no playSound, pre-execution Jev or AI revision workflow. The source cross-check is advisory, not complete static analysis. This single-operator PoC has no new auth system and is not a public multi-user permission service. Peer-address binding assumes direct isolated Docker connectivity. Quotas are per execution, not a server-wide operator rate limit. Plugin/server interruption can prevent scheduled demo-mob removal. Typed effect failures may coexist with process exit0; use trusted host results, not stdout or process completion, to assess effects.

# 23. Scope discipline
No arbitrary console execution, generic Paper/Bukkit RPC, reflection, plugin invocation, custom NBT/equipment, boss spawning, arbitrary world selection, unrestricted filesystem/network/process authority or multi-module framework was added. Generated scripts remain untrusted after approval. No expansion beyond the initial four capabilities.

# 24. Recommendation
Review the current local extension and the retained evidence package. Private-message delivery can be checked when GoldennBullet is naturally online; no live participation is required now. Do NOT start Phase 8.

READY FOR MANUAL REVIEW
