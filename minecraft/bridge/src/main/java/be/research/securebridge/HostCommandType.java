package be.research.securebridge;

/**
 * Explicit allowlist of platform → host actions.
 * Do NOT add arbitrary console / reflection / filesystem / shell commands.
 */
public enum HostCommandType {
    broadcast_message,
    request_status,
    request_player_list;

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
