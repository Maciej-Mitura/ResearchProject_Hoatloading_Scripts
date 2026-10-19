package be.research.securebridge;

import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * SecureBridge — trusted boundary between research platform and Paper host.
 * Intentionally tiny. Do not place game logic here.
 * Player chat/command handlers are observation-only (never cancel).
 */
public final class SecureBridgePlugin extends JavaPlugin implements Listener {
    public static final String PLUGIN_VERSION = "0.1.0";

    private BridgeTransport transport;
    private CommandExecutor executor;
    private BukkitTask heartbeatTask;
    private BukkitTask pollTask;

    @Override
    public void onEnable() {
        String apiUrl = envOrProp("BRIDGE_API_URL", "http://api:3000");
        String token = envOrProp("BRIDGE_TOKEN", "");

        if (token.isBlank()) {
            getLogger().severe("BRIDGE_TOKEN is not set — SecureBridge will not start networking.");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        this.transport = new HttpPollingBridgeTransport(apiUrl, token);
        this.executor = new CommandExecutor(this);
        getServer().getPluginManager().registerEvents(this, this);

        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            try {
                transport.sendEvent("plugin_started", Map.of(
                        "pluginVersion", PLUGIN_VERSION,
                        "serverVersion", Bukkit.getVersion()
                ));
                sendHeartbeat();
                getLogger().info("SecureBridge registered with platform at " + apiUrl);
            } catch (Exception e) {
                getLogger().warning("Initial registration failed: " + e.getMessage());
            }
        });

        heartbeatTask = Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> {
            try {
                sendHeartbeat();
            } catch (Exception e) {
                getLogger().warning("Heartbeat failed: " + e.getMessage());
            }
        }, 40L, 100L);

        pollTask = Bukkit.getScheduler().runTaskTimerAsynchronously(this, this::pollAndHandle, 60L, 40L);

        getLogger().info("SecureBridge enabled (allowlist-only host API).");
    }

    @Override
    public void onDisable() {
        if (heartbeatTask != null) heartbeatTask.cancel();
        if (pollTask != null) pollTask.cancel();
        getLogger().info("SecureBridge disabled.");
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            try {
                Map<String, Object> payload = playerPayload(player);
                payload.put("onlinePlayers", Bukkit.getOnlinePlayers().size());
                transport.sendEvent("player_join", payload);
            } catch (Exception e) {
                getLogger().warning("player_join event failed: " + e.getMessage());
            }
        });
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            try {
                int online = Math.max(0, Bukkit.getOnlinePlayers().size() - 1);
                Map<String, Object> payload = playerPayload(player);
                payload.put("onlinePlayers", online);
                transport.sendEvent("player_leave", payload);
            } catch (Exception e) {
                getLogger().warning("player_leave event failed: " + e.getMessage());
            }
        });
    }

    /**
     * Paper Adventure chat (MC 1.21.x). Monitor only — do not cancel.
     */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onChat(AsyncChatEvent event) {
        Player player = event.getPlayer();
        String message = PlainTextComponentSerializer.plainText().serialize(event.message());
        Map<String, Object> payload = playerPayload(player);
        payload.put("message", message);
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            try {
                transport.sendEvent("player_chat", payload);
            } catch (Exception e) {
                getLogger().warning("player_chat event failed: " + e.getMessage());
            }
        });
    }

    /**
     * Player-typed commands (includes leading '/'). Monitor only — do not cancel.
     * Sensitive auth-style arguments are redacted before leaving the host.
     */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent event) {
        Player player = event.getPlayer();
        String sanitized = CommandSanitizer.sanitize(event.getMessage());
        Map<String, Object> payload = playerPayload(player);
        payload.put("command", sanitized);
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            try {
                transport.sendEvent("player_command", payload);
            } catch (Exception e) {
                getLogger().warning("player_command event failed: " + e.getMessage());
            }
        });
    }

    private static Map<String, Object> playerPayload(Player player) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("playerId", player.getUniqueId().toString());
        payload.put("playerName", player.getName());
        payload.put("timestamp", Instant.now().toString());
        return payload;
    }

    private void sendHeartbeat() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("pluginVersion", PLUGIN_VERSION);
        body.put("serverVersion", Bukkit.getVersion());
        body.put("onlinePlayers", Bukkit.getOnlinePlayers().size());
        body.put("maxPlayers", Bukkit.getMaxPlayers());
        body.put("motd", Bukkit.getMotd());
        transport.sendHeartbeat(body);
    }

    private void pollAndHandle() {
        try {
            List<BridgeTransport.PendingCommand> commands = transport.pollPendingCommands();
            for (BridgeTransport.PendingCommand command : commands) {
                Bukkit.getScheduler().runTask(this, () -> {
                    CommandExecutor.Result result = executor.execute(command);
                    Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
                        try {
                            transport.sendCommandResult(
                                    command.id(),
                                    result.success(),
                                    result.message(),
                                    result.data()
                            );
                        } catch (Exception e) {
                            getLogger().warning("Failed to report command result: " + e.getMessage());
                        }
                    });
                });
            }
        } catch (Exception e) {
            getLogger().warning("Command poll failed: " + e.getMessage());
        }
    }

    private static String envOrProp(String key, String fallback) {
        String env = System.getenv(key);
        if (env != null && !env.isBlank()) return env;
        String prop = System.getProperty(key);
        if (prop != null && !prop.isBlank()) return prop;
        return fallback;
    }
}
