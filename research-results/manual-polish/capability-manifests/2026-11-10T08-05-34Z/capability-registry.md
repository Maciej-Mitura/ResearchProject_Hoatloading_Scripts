# Authoritative registry
packages/contracts/src/capabilities.ts defines stable IDs, schema version, SDK names, explicit queue mappings, impact metadata, quotas and strict argument/constraint validation. It is imported by the API, Gateway, UI and assistant contract. The SDK is a deliberately small typed projection. packages/contracts/generate-capability-resource.ts emits the Paper JSON resource; --check detects drift. Java only dispatches explicit enum cases. No dynamic registration from model output.

| ID | SDK | Queue type | Maximum calls | Arguments/constraints | Impact |
|---|---|---|---:|---|---|
| chat.broadcast | host.chat.broadcast(message) | broadcast_message | 5 | printable message 1–256 characters | LOW |
| server.status | host.server.status() | capability_status | 3 | no arguments; sanitized player counts/version/public demo location | LOW |
| player.sendMessage | host.player.sendMessage(playerName,message) | send_player_message | 5 | online exact name, printable message <=256; optional approved player-name allowlist | LOW |
| world.spawnEntity | host.world.spawnEntity({type,x,y,z}) | spawn_entity | 3 | approved subset of ZOMBIE/SKELETON/COW/PIG; finite bounded coordinates; active-world loaded demo area | REVIEW |

Approved quotas never exceed requested/registered quotas. Session-wide total budget is 12 authorized argument-valid calls. Impact is capability metadata, separate from frozen deterministic v1. Play sound was deliberately omitted.
