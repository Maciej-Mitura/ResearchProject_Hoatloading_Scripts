package be.research.securebridge;

import java.util.List;
import java.util.Map;

/**
 * Transport abstraction between plugin domain logic and the research platform.
 * HTTP polling is the development implementation; replaceable later (WebSocket/RPC).
 */
public interface BridgeTransport {
    void sendHeartbeat(Map<String, Object> body) throws Exception;

    void sendEvent(String eventType, Map<String, Object> payload) throws Exception;

    List<PendingCommand> pollPendingCommands() throws Exception;

    void sendCommandResult(String commandId, boolean success, String message, Map<String, Object> data)
            throws Exception;

    record PendingCommand(String id, HostCommandType commandType, Map<String, Object> payload) {}
}
