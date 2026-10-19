package be.research.securebridge;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CommandSanitizerTest {

    @Test
    void redactsLoginArguments() {
        assertEquals("/login [REDACTED]", CommandSanitizer.sanitize("/login mySecretPassword"));
    }

    @Test
    void redactsRegisterWithoutLeadingSlash() {
        assertEquals("register [REDACTED]", CommandSanitizer.sanitize("register user pass"));
    }

    @Test
    void leavesHarmlessCommandsIntact() {
        assertEquals("/help", CommandSanitizer.sanitize("/help"));
        assertEquals("/gamemode creative", CommandSanitizer.sanitize("/gamemode creative"));
    }

    @Test
    void sensitiveNameAloneIsUnchanged() {
        assertEquals("/login", CommandSanitizer.sanitize("/login"));
    }

    @Test
    void redactsPasswordAliases() {
        assertEquals("/passwd [REDACTED]", CommandSanitizer.sanitize("/passwd old new"));
        assertEquals("/password [REDACTED]", CommandSanitizer.sanitize("/password x"));
    }
}
