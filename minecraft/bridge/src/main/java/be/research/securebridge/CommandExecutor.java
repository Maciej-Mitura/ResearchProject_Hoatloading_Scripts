package be.research.securebridge;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Executes ONLY allowlisted HostCommandType values.
 * No console passthrough, no reflection, no filesystem, no shell.
 */
public final class CommandExecutor {
    private final SecureBridgePlugin plugin;

    public CommandExecutor(SecureBridgePlugin plugin) {
        this.plugin = plugin;
    }

    public Result execute(BridgeTransport.PendingCommand command) {
        return switch (command.commandType()) {
            case broadcast_message -> broadcast(command.payload());
            case request_status -> status();
            case request_player_list -> playerList();
            case capability_status -> publicStatus();
            case send_player_message -> sendMessage(command.payload());
            case spawn_entity -> spawnEntity(command.payload());
            case player_state -> playerState(command.payload());
            case get_block, set_block, play_sound -> locationAction(command.commandType(),command.payload());
            case set_weather, set_time -> presetAction(command.commandType(),command.payload());
        };
    }

    private Result broadcast(Map<String, Object> payload) {
        Object msg = payload.get("message");
        if (!(msg instanceof String) || ((String) msg).isBlank()) {
            return Result.fail("payload.message must be a non-empty string");
        }
        String message = (String) msg;
        Bukkit.broadcastMessage("[SecureBridge] " + message);
        plugin.getLogger().info("broadcast_message: " + message);
        return Result.ok("broadcasted", Map.of("message", message));
    }

    private Result status() {
        Map<String, Object> data = new HashMap<>();
        data.put("onlinePlayers", Bukkit.getOnlinePlayers().size());
        data.put("maxPlayers", Bukkit.getMaxPlayers());
        data.put("version", Bukkit.getVersion());
        data.put("motd", Bukkit.getMotd());
        return Result.ok("status", data);
    }

    private Result playerList() {
        List<String> names = Bukkit.getOnlinePlayers().stream()
                .map(Player::getName)
                .collect(Collectors.toList());
        return Result.ok("player_list", Map.of(
                "players", names,
                "count", names.size()
        ));
    }

    private Result publicStatus() {
        if (Bukkit.getWorlds().isEmpty()) return Result.fail("No active world");
        var spawn = Bukkit.getWorlds().getFirst().getSpawnLocation();
        return Result.ok("status", Map.of("onlinePlayers", Bukkit.getOnlinePlayers().size(), "maxPlayers", Bukkit.getMaxPlayers(), "version", Bukkit.getVersion(), "demoLocation", Map.of("x",spawn.getX(),"y",spawn.getY(),"z",spawn.getZ())));
    }
    private Result sendMessage(Map<String,Object> args) {
        try { CapabilityArguments.message(args); } catch(IllegalArgumentException e) { return Result.fail("CAPABILITY_ARGUMENT_NOT_ALLOWED"); }
        Player target=Bukkit.getPlayerExact((String)args.get("playerName"));
        if(target==null || !target.isOnline()) return Result.fail("CAPABILITY_PLAYER_OFFLINE");
        target.sendMessage(net.kyori.adventure.text.Component.text("[SecureBridge] " + args.get("message")));
        return Result.ok("message_delivered",Map.of("playerName",target.getName()));
    }
    private Result spawnEntity(Map<String,Object> args) {
        try {
            CapabilityArguments.spawn(args);
            if(Bukkit.getWorlds().isEmpty()) return Result.fail("No active world");
            var world=Bukkit.getWorlds().getFirst();
            var spawn=world.getSpawnLocation();
            double x=((Number)args.get("x")).doubleValue(),y=((Number)args.get("y")).doubleValue(),z=((Number)args.get("z")).doubleValue();
            if(Math.abs(x-spawn.getX())>32 || Math.abs(z-spawn.getZ())>32 || y<spawn.getY()-8 || y>spawn.getY()+16 || y<world.getMinHeight() || y>=world.getMaxHeight()) return Result.fail("CAPABILITY_LOCATION_NOT_ALLOWED");
            if(!world.isChunkLoaded(((int)Math.floor(x))>>4,((int)Math.floor(z))>>4)) return Result.fail("CAPABILITY_CHUNK_NOT_LOADED");
            var entity=world.spawnEntity(new org.bukkit.Location(world,x,y,z),org.bukkit.entity.EntityType.valueOf((String)args.get("type")));
            // Demo entities cannot pick up items, wander or remain indefinitely.
            if(entity instanceof org.bukkit.entity.Mob mob) { mob.setAI(false); mob.setCanPickupItems(false); }
            plugin.getServer().getScheduler().runTaskLater(plugin,entity::remove,1200L);
            return Result.ok("entity_spawned",Map.of("entityId",entity.getUniqueId().toString(),"type",args.get("type"),"x",x,"y",y,"z",z));
        } catch(IllegalArgumentException e) { return Result.fail("CAPABILITY_ARGUMENT_NOT_ALLOWED"); }
    }

    private Result playerState(Map<String,Object> args) {
        try {
            CapabilityArguments.player(args);
            var player=Bukkit.getPlayerExact((String)args.get("playerName"));
            if(player==null || !player.isOnline())return Result.fail("CAPABILITY_PLAYER_OFFLINE");
            var l=player.getLocation();
            return Result.ok("player_state",Map.of("name",player.getName(),"x",l.getX(),"y",l.getY(),"z",l.getZ(),"yaw",l.getYaw(),"pitch",l.getPitch(),"world",l.getWorld().getName()));
        }catch(IllegalArgumentException e){return Result.fail("CAPABILITY_ARGUMENT_NOT_ALLOWED");}
    }
    private Result presetAction(HostCommandType type,Map<String,Object> args) {
        try {
            if(Bukkit.getWorlds().isEmpty()) return Result.fail("No active world");
            var world=Bukkit.getWorlds().getFirst();
            if(type==HostCommandType.set_weather) {
                CapabilityArguments.preset(args,"weather","weather");
                var weather=(String)args.get("weather");
                world.setStorm(!weather.equals("CLEAR"));world.setThundering(weather.equals("THUNDER"));
                world.setWeatherDuration(1200);world.setThunderDuration(1200);
                return Result.ok("weather_set",Map.of("weather",weather,"world",world.getName()));
            }
            CapabilityArguments.preset(args,"time","times");
            long ticks=switch((String)args.get("time")){case "DAY"->1000;case "NOON"->6000;case "SUNSET"->12000;case "NIGHT"->18000;default->throw new IllegalArgumentException();};
            world.setTime(ticks);return Result.ok("time_set",Map.of("time",args.get("time"),"ticks",world.getTime()));
        }catch(IllegalArgumentException e){return Result.fail("CAPABILITY_ARGUMENT_NOT_ALLOWED");}
    }
    private Result locationAction(HostCommandType type,Map<String,Object> args) {
        try {
            String extra=type==HostCommandType.get_block?null:type==HostCommandType.set_block?"type":"sound";
            CapabilityArguments.location(args,extra,type!=HostCommandType.play_sound);
            if(type==HostCommandType.set_block)CapabilityArguments.value("materials",args.get("type"));
            if(type==HostCommandType.play_sound)CapabilityArguments.value("sounds",args.get("sound"));
            if(Bukkit.getWorlds().isEmpty())return Result.fail("No active world");
            var world=Bukkit.getWorlds().getFirst();var spawn=world.getSpawnLocation();
            double x=((Number)args.get("x")).doubleValue(),y=((Number)args.get("y")).doubleValue(),z=((Number)args.get("z")).doubleValue();
            if(Math.abs(x-spawn.getX())>32 || Math.abs(z-spawn.getZ())>32 || y<spawn.getY()-8 || y>spawn.getY()+16 || y<world.getMinHeight() || y>=world.getMaxHeight())return Result.fail("CAPABILITY_LOCATION_NOT_ALLOWED");
            if(!world.isChunkLoaded(((int)Math.floor(x))>>4,((int)Math.floor(z))>>4))return Result.fail("CAPABILITY_CHUNK_NOT_LOADED");
            if(type==HostCommandType.play_sound) {
                world.playSound(new org.bukkit.Location(world,x,y,z),org.bukkit.Sound.valueOf((String)args.get("sound")),0.5f,1.0f);
                return Result.ok("sound_played",Map.of("sound",args.get("sound")));
            }
            var block=world.getBlockAt((int)x,(int)y,(int)z);
            var previous=block.getType().name();
            if(type==HostCommandType.set_block) {
                // Never replace a container/block entity or protected material.
                if(block.getState() instanceof org.bukkit.block.TileState || block.getType()==org.bukkit.Material.BEDROCK)return Result.fail("CAPABILITY_BLOCK_PROTECTED");
                block.setType(org.bukkit.Material.valueOf((String)args.get("type")),false);
            }
            return Result.ok(type==HostCommandType.get_block?"block_read":"block_set",Map.of("type",block.getType().name(),"previousType",previous,"x",(int)x,"y",(int)y,"z",(int)z));
        }catch(IllegalArgumentException e){return Result.fail("CAPABILITY_ARGUMENT_NOT_ALLOWED");}
    }

    public record Result(boolean success, String message, Map<String, Object> data) {
        public static Result ok(String message, Map<String, Object> data) {
            return new Result(true, message, data);
        }

        public static Result fail(String message) {
            return new Result(false, message, Map.of());
        }
    }
}
