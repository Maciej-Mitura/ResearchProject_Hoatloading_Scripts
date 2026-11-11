# Capability-manifests en actuele registry

`packages/contracts/src/capabilities.ts` is leidend. Het API-endpoint `GET /api/scripts/capabilities/registry` levert de registry en een gegenereerde resource spiegelt de toegelaten waarden voor Paper. Alle registry-entries hebben versie 1. `parseRequests` valideert maximaal 16 unieke requests, een reden van maximaal 500 tekens, required-flag en beperkte constraints. Een onbekende capability kan als waarschuwing in het voorstel bestaan. Die kan geen autoriteit krijgen.

Gemini kan bij een voorstel bestanden, entrypoint en `requestedCapabilities` aanleveren. Een review heeft per gevraagde capability een expliciete beslissing. Alleen de opgeslagen goedgekeurde subset wordt execution-authority. Een gedeeltelijke goedkeuring verleent alleen de gekozen subset. Bronverwijzingen naar geweigerde capabilities kunnen blijven staan. De Gateway weigert zulke calls. Een nieuw opgeslagen snapshot krijgt geen automatische overdracht van review. `sourceSha256` bindt bron of canonieke projectbundel aan de versie. Constraint-sets kunnen een subset opleggen van toegelaten spelers, materialen, weer, tijden, sounds en entiteiten. Effectieve quota zijn begrensd door registry en review. Het manifestpad telt maximaal 12 geldige aanvragen over de sessie en controleert vervolgens per-capabilityquota. Het legacy-chatbudget staat afzonderlijk op standaard 5.

| ID | Max | Argumenten | Output / Paper-dispatch | Voorbeeld na review |
|---|---:|---|---|---|
| chat.broadcast | 5 | bericht | broadcast_message, ontvangst via hostpad | `await host.chat.broadcast("Demo")` |
| server.status | 3 | geen | capability_status, spelersaantal, maximum, versie, demoLocation | `await host.server.status()` |
| player.sendMessage | 5 | naam, bericht | send_player_message, resultaatstatus | `await host.player.sendMessage("Speler", "Hallo")` |
| player.getState | 3 | naam | player_state, naam, XYZ, yaw, pitch, wereld | `await host.player.getState("Speler")` |
| world.getBlock | 5 | gehele XYZ | get_block, type/positie | `await host.world.getBlock({x,y,z})` |
| world.setBlock | 5 | gehele XYZ, type | set_block, type, vorig type en positie | `await host.world.setBlock({x,y,z,type:"STONE"})` |
| world.setWeather | 1 | weather | set_weather, preset en wereld | `await host.world.setWeather("CLEAR")` |
| world.setTime | 1 | time | set_time, preset en ticks | `await host.world.setTime("DAY")` |
| world.playSound | 3 | XYZ, sound | play_sound, sound-ID | `await host.world.playSound({x,y,z,sound:"BLOCK_NOTE_BLOCK_PLING"})` |
| world.spawnEntity | 3 | XYZ, type | spawn_entity, entity-ID, type, positie | `await host.world.spawnEntity({x,y,z,type:"PIG"})` |

Voorbeelden gebruiken waarden uit een geldige demo-positie. Leesacties zoals `getState`, `status` en `getBlock` verwachten bevestigde data. Andere SDK-acties geven het resultaatobject van het transport terug. Zie `services/sandbox/host/{mod,call,chat}.ts`.

- Entiteiten `ZOMBIE`, `SKELETON`, `COW`, `PIG`.
- Materialen `STONE`, `DIRT`, `GRASS_BLOCK`, `COBBLESTONE`, `OAK_PLANKS`, `GLASS`, `GOLD_BLOCK`, `DIAMOND_ORE`, `AIR`.
- Weer `CLEAR`, `RAIN`, `THUNDER`. Paper stelt de duur in op 1.200 ticks.
- Tijd `DAY` 1000, `NOON` 6000, `SUNSET` 12000, `NIGHT` 18000.
- Sounds `ENTITY_ZOMBIE_AMBIENT`, `BLOCK_NOTE_BLOCK_PLING`, `ENTITY_EXPERIENCE_ORB_PICKUP`. Vaste volume/pitch 0,5 / 1,0.
- Locatieacties in de eerste Bukkit-wereld. Maximaal 32 blokken afwijking op elke horizontale as, van spawn-Y−8 tot spawn-Y+16 binnen de werkelijke wereldhoogte, alleen geladen chunks. Contractfilter bewaakt tevens numeriek domein, onder meer Y −64 tot 320. Dit beperkt de impact en vermijdt geforceerd laden.
- Spelers moeten exact vindbaar en online zijn. Berichten zijn begrensd tot 256 tekens in het standaardpad, zonder lege tekst, ongewenste controltekens of formatteringscode. Spelersnamen volgen 1–16 alfanumerieke tekens of underscore. De state-interface geeft beperkte positionele data, geen NBT.
- Bedrock en `TileState` kunnen niet vervangen worden. Er is geen container- of NBT-interface.

`import { host } from "host"` komt via de vertrouwde importmap uit de sandboximage. Het is geen npm-package. Elk lokaal projectbestand kan dezelfde bare import gebruiken onder een hostprofiel. De gebruiker kan eigen wrappers schrijven, maar daarmee verandert de Gateway-autoriteit niet. Onder `none` ontbreekt de Host SDK-importmap. De runtime laadt de vaste SDK onder `/trusted/host` en API-aanroepen gaan als JSON naar de Gateway.

Bronnen `packages/contracts/src/capabilities.ts`, `services/host-gateway/src/{main,manifest-calls,sessions}.ts`, `apps/api/src/routes/{scripts,internal}.ts`, `services/sandbox/{import_map.json,host}`, `minecraft/bridge/src/main/java/be/research/securebridge/{CommandExecutor,CapabilityArguments,HostCommandType}.java`.
