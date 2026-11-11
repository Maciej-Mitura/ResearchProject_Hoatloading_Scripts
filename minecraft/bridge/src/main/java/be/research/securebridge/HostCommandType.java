package be.research.securebridge;

/**
 * Explicit allowlist of platform → host actions.
 * Do NOT add arbitrary console / reflection / filesystem / shell commands.
 */
public enum HostCommandType {
    broadcast_message,
    request_status,
    request_player_list,
    capability_status,
    send_player_message,
    spawn_entity, player_state, get_block, set_block, set_weather, set_time, play_sound;

    public static HostCommandType parse(String raw) {
        if (raw == null) {
            throw new IllegalArgumentException("commandType is null");
        }
        for (HostCommandType t : values()) {
            if (t.name().equals(raw)) {
                return t;
            }
        }
        throw new IllegalArgumentException("Unsupported commandType: " + raw);
    }
}
