# Post-research capability architecture
Per-script capability manifests were added as a post-analysis extension and were not part of the frozen Phase 1–7 empirical experiments. Phase 8 is not started.

Gemini returns a structured proposal (source plus requested capabilities). The API validates it against packages/contracts/src/capabilities.ts. Saving creates a database manifest bound to the exact script version and SHA-256 source digest. User review appends a record containing approved and denied requests. Nothing is preapproved. At execution start the API copies the selected review into an immutable execution authority snapshot.

The host-capabilities profile supplies only the existing trusted SDK, Gateway network transport and two existing SDK environment variables. The runner hashes the actual source. The Gateway obtains authority independently from the API using its service credential, compares the digest and execution ID, then issues an opaque session. A session cannot be reissued for the same active execution. Before sending source on stdin, the supervisor binds the session to the Docker-observed sandbox IP over the separately authenticated admin interface. The Gateway takes peer IP from the TCP server connection, never from sandbox headers. Each call checks this address, execution ID, registry ID, approval, arguments, quota and total budget. Only an explicit registry command reaches the authenticated API queue. The API checks the same immutable approval and active execution before enqueueing. SecureBridge invokes explicit typed Paper operations on the server thread.

There is no new public command endpoint, generic Paper RPC, reflection or console dispatcher. Legacy host-chat remains chat-only for historical versions. Newly saved versions cannot bypass their manifest through host-chat.


# Authoritative registry
packages/contracts/src/capabilities.ts defines stable IDs, schema version, SDK names, explicit queue mappings, impact metadata, quotas and strict argument/constraint validation. It is imported by the API, Gateway, UI and assistant contract. The SDK is a deliberately small typed projection. packages/contracts/generate-capability-resource.ts emits the Paper JSON resource; --check detects drift. Java only dispatches explicit enum cases. No dynamic registration from model output.

| ID | SDK | Queue type | Maximum calls | Arguments/constraints | Impact |
|---|---|---|---:|---|---|
| chat.broadcast | host.chat.broadcast(message) | broadcast_message | 5 | printable message 1–256 characters | LOW |
| server.status | host.server.status() | capability_status | 3 | no arguments; sanitized player counts/version/public demo location | LOW |
| player.sendMessage | host.player.sendMessage(playerName,message) | send_player_message | 5 | online exact name, printable message <=256; optional approved player-name allowlist | LOW |
| world.spawnEntity | host.world.spawnEntity({type,x,y,z}) | spawn_entity | 3 | approved subset of ZOMBIE/SKELETON/COW/PIG; finite bounded coordinates; active-world loaded demo area | REVIEW |

Approved quotas never exceed requested/registered quotas. Session-wide total budget is 12 authorized argument-valid calls. Impact is capability metadata, separate from frozen deterministic v1. Play sound was deliberately omitted.


# Permission review
Save a script/version. Open Version permissions. Inspect requested IDs/reasons, entity/player restrictions, quotas and LOW/REVIEW impact. Choose Review permissions: every box starts unchecked, including when reopening a previously reviewed version. Unsupported entries are disabled. Approve selected permissions appends a review; unchecked requests become denied. Cancel leaves history unchanged. Partial denial is explicit and warns that unchanged code may fail. No code is silently deleted and denied authority is never restored by the assistant.

The Workbench displays Review required before submission. Run opens review without creating an execution. Saving an explicit review selects **Per-script permissions** visibly; it never runs automatically. Click Run separately. A later manual mode selection is respected. The internal `host-capabilities` identifier is unchanged and selects transport only; the stored review remains the authority. Unsaved changes require saving a new version and reviewing again. Partial approval leaves denied calls blocked and permits a deliberate run to inspect the denial. Export manifest JSON downloads the selected version's request/latest-review record. Historical versions without a manifest can still use the fixed Chat broadcast profile without forced migration.

Browser verification observed the two-capability partial approval state, both review checkboxes unchecked, cancel behavior, selected-run capability table and human-readable denial. permission-review.png is the captured review. Automated UI tests cover default checks, partial approval submission, reopening, dirty source, unsupported options and legacy versions. Native dialog supplies modal focus containment and Escape dismissal.


# Threat model
Untrusted: generated source, assistant manifest proposals, script output, sandbox headers/body, capability arguments, requested quotas. Source-call detection is conservative advisory matching, not proof of behavior.
Trusted: local operator/API, version/review database, runner with Docker access, Gateway, separately authenticated service/admin interfaces, SecureBridge/Paper. This local PoC has no new user identity/authentication system. The approval API is an operator interface, not a multi-user authorization boundary. Do not expose it publicly as a production service.

Controls cover unsupported capabilities, forged approval fields, stale version/manifest IDs, changed source, denied calls, additional arguments/NBT/world identifiers, entity allowlist escape, quota excess, forged call correlation, duplicate call IDs, expired/revoked credentials and copied active credentials from a different sandbox IP even with a forged execution header. Trusted metadata never includes credentials. Cleartext execution credentials echoed to captured stdout/stderr are redacted; capability calls containing their own cleartext credential are rejected before argument persistence. This is not a general detector for deliberately encoded covert data. The isolation test handles copied tokens transiently in trusted harness memory only.

The peer-address binding requires direct isolated Docker bridge connectivity; a shared reverse proxy/NAT cannot replace that boundary without redesign. Trusted Docker administrators can inspect credentials and control containers and remain outside the sandbox threat model. A compromised API/Gateway/Paper is outside this PoC boundary. Authorization is checked at enqueue/claim; an already delivered Paper operation cannot be undone. Pending new-manifest commands expire after ten seconds or when their execution is no longer running. Legacy queue semantics remain unchanged.

Effect confirmation is separate from process exit and queue acceptance. No entity spawning outside 32 blocks horizontally / -8..+16 vertically of the first active world's spawn, no unloaded chunks, no bosses/custom equipment/NBT. Demo mobs have AI/item pickup disabled and are scheduled for removal after 60 seconds. Plugin/server interruption can prevent that scheduled removal; the per-execution spawn cap still applies.


## Inline assistant review

Assistant proposals now include per-capability Yes/No controls directly in the chat. No choice is selected automatically. Confirming saves the exact script version and appends its approval/denial review; it does not execute the source. Partial denial is supported. Existing saved proposals are matched to their exact source/version, and a changed or ambiguous manifest must be reviewed in Workbench. A failed review retries against the same saved version. Ordinary typed chat replies do not grant authority. Workbench permissions and execution remain available separately.

## Workbench source editor

The active editor is CodeMirror 6 with TypeScript/JavaScript highlighting, line numbers, matching brackets, automatic indentation, active-line highlighting and a bounded scrolling viewport. Use Ctrl/Cmd+F for editor search, Ctrl/Cmd+Z to undo, and Ctrl+Y on Windows or Cmd+Shift+Z on macOS to redo. Theme changes update the editor. Editing marks a saved version dirty and disables Run until saved. Script/version drafts survive in-app navigation; they are not durable browser-reload storage. Assistant source insertion uses the same editor and Save/version workflow. Syntax highlighting is not a TypeScript language-server diagnosis.


## Expanded one-shot projects

The current registry also implements player.getState, world.getBlock, world.setBlock, world.setWeather, world.setTime and world.playSound. The table above describes the original four-operation extension; the running registry and [advanced project guide](ADVANCED-SCRIPT-PLATFORM.md) describe the current complete surface. Project manifests bind the entrypoint and every file, not only the active editor tab. Narrow material/weather/time/sound/player constraints and quotas remain version-specific. These additions are post-analysis and do not change frozen results.
