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

    public record Result(boolean success, String message, Map<String, Object> data) {
        public static Result ok(String message, Map<String, Object> data) {
            return new Result(true, message, data);
        }

        public static Result fail(String message) {
            return new Result(false, message, Map.of());
        }
    }
}
