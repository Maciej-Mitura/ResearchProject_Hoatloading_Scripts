package be.research.securebridge;

import java.util.Locale;
import java.util.Set;

/**
 * Redacts arguments for auth/password-style commands before they leave the host.
 * Observation only — does not cancel or alter the player's actual command.
 */
public final class CommandSanitizer {
    /** Command names (no leading slash) whose arguments must not be stored. */
    private static final Set<String> SENSITIVE_COMMANDS = Set.of(
            "login",
            "l",
            "register",
            "reg",
            "password",
            "passwd",
            "changepassword",
            "changepass",
            "auth",
            "setpassword"
    );

    private CommandSanitizer() {}

    /**
     * @param rawCommand player command text, with or without a leading '/'
     * @return sanitized form safe to persist/display (e.g. "/login [REDACTED]")
     */
    public static String sanitize(String rawCommand) {
        if (rawCommand == null) return "";
        String trimmed = rawCommand.trim();
        if (trimmed.isEmpty()) return "";

        boolean hadSlash = trimmed.startsWith("/");
        String withoutSlash = hadSlash ? trimmed.substring(1) : trimmed;
        if (withoutSlash.isEmpty()) return hadSlash ? "/" : "";

        int space = withoutSlash.indexOf(' ');
        String name = (space < 0 ? withoutSlash : withoutSlash.substring(0, space))
                .toLowerCase(Locale.ROOT);
        String prefix = hadSlash ? "/" : "";

        if (SENSITIVE_COMMANDS.contains(name) && space >= 0) {
            return prefix + name + " [REDACTED]";
        }
        // Preserve original casing of non-sensitive commands
        return trimmed;
    }

    /** Exposed for tests / extension lists. */
    static Set<String> sensitiveCommandNames() {
        return SENSITIVE_COMMANDS;
    }
}
