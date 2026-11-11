# Actual registry
| Capability | SDK | Maximum calls | Impact | Description |
|---|---|---:|---|---|
| chat.broadcast | host.chat.broadcast | 5 | low | Send a bounded server-wide message. |
| server.status | host.server.status | 3 | low | Read player counts, Paper version and the public demo location. |
| player.sendMessage | host.player.sendMessage | 5 | low | Send a bounded message to an online player. |
| player.getState | host.player.getState | 3 | low | Read sanitized online player position, rotation and world. |
| world.getBlock | host.world.getBlock | 5 | low | Read a block in the loaded demo area. |
| world.setBlock | host.world.setBlock | 5 | review | Place approved demo materials in the loaded demo area. |
| world.setWeather | host.world.setWeather | 1 | review | Set approved weather in the active world. |
| world.setTime | host.world.setTime | 1 | review | Set an approved time preset in the active world. |
| world.playSound | host.world.playSound | 3 | low | Play an allowlisted sound in the loaded demo area. |
| world.spawnEntity | host.world.spawnEntity | 3 | review | Spawn ZOMBIE, SKELETON, COW or PIG near the active world's spawn, in loaded chunks only. |

New: player.getState, world.getBlock, world.setBlock, world.setWeather, world.setTime and world.playSound. Optional giveItem was omitted. Registry/resource generation and exact SDK examples are shared rather than separately maintained Assistant/Help lists.

Constraints: optional exact player-name allowlist (up to10); entities ZOMBIE/SKELETON/COW/PIG (spawn maximum3); materials STONE, DIRT, GRASS_BLOCK, COBBLESTONE, OAK_PLANKS, GLASS, GOLD_BLOCK, DIAMOND_ORE, AIR; weather CLEAR/RAIN/THUNDER; time DAY/NOON/SUNSET/NIGHT; sound ENTITY_ZOMBIE_AMBIENT/BLOCK_NOTE_BLOCK_PLING/ENTITY_EXPERIENCE_ORB_PICKUP. Approval can narrow these lists and quotas. Session total remains12 authorized argument-valid calls.

World coordinates: first active world only, loaded chunks, within32 blocks horizontally and spawnY−8…+16; world height bounds also apply. Blocks require integers and cannot replace containers/block entities or bedrock. Sounds use fixed volume0.5/pitch1. No NBT or arbitrary extra fields. Player state is sanitized name/position/rotation/world and online-only; no IP/session/internal objects. Typed direct Paper APIs implement each operation; no console command shortcut.
