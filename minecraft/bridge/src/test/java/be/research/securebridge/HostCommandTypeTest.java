package be.research.securebridge;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class HostCommandTypeTest {
    @Test
    void parsesAllowlistedTypes() {
        assertEquals(HostCommandType.broadcast_message, HostCommandType.parse("broadcast_message"));
        assertEquals(HostCommandType.request_status, HostCommandType.parse("request_status"));
        assertEquals(HostCommandType.request_player_list, HostCommandType.parse("request_player_list"));
    }

    @Test
    void rejectsUnknownTypes() {
        assertThrows(IllegalArgumentException.class, () -> HostCommandType.parse("execute_console"));
        assertThrows(IllegalArgumentException.class, () -> HostCommandType.parse("shell"));
    }
}
