package be.research.securebridge;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Development BridgeTransport using HTTP heartbeat + command polling.
 * Token auth is a shared env secret for local PoC — NOT final security architecture.
 */
public final class HttpPollingBridgeTransport implements BridgeTransport {
    private static final int PROTOCOL_VERSION = 1;

    private final String baseUrl;
    private final String token;
    private final HttpClient client;
    private final Gson gson = new Gson();

    public HttpPollingBridgeTransport(String baseUrl, String token) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.token = token;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    @Override
    public void sendHeartbeat(Map<String, Object> body) throws Exception {
        Map<String, Object> payload = new HashMap<>(body);
        payload.put("protocolVersion", PROTOCOL_VERSION);
        postJson("/api/host/bridge/heartbeat", payload);
    }

    @Override
    public void sendEvent(String eventType, Map<String, Object> eventPayload) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("protocolVersion", PROTOCOL_VERSION);
        body.put("eventType", eventType);
        body.put("payload", eventPayload);
        postJson("/api/host/bridge/events", body);
    }

    @Override
    public List<PendingCommand> pollPendingCommands() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/host/bridge/commands/pending"))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("poll failed: HTTP " + response.statusCode() + " " + response.body());
        }

        JsonObject root = gson.fromJson(response.body(), JsonObject.class);
        JsonArray commands = root.getAsJsonArray("commands");
        if (commands == null) {
            return Collections.emptyList();
        }

        List<PendingCommand> result = new ArrayList<>();
        for (JsonElement el : commands) {
            JsonObject obj = el.getAsJsonObject();
            String id = obj.get("id").getAsString();
            HostCommandType type = HostCommandType.parse(obj.get("commandType").getAsString());
            Map<String, Object> payload = gson.fromJson(
                    obj.get("payload"),
                    new TypeToken<Map<String, Object>>() {}.getType()
            );
            if (payload == null) {
                payload = Collections.emptyMap();
            }
            result.add(new PendingCommand(id, type, payload));
        }
        return result;
    }

    @Override
    public void sendCommandResult(String commandId, boolean success, String message, Map<String, Object> data)
            throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("protocolVersion", PROTOCOL_VERSION);
        body.put("commandId", commandId);
        body.put("success", success);
        body.put("message", message);
        if (data != null) {
            body.put("data", data);
        }
        postJson("/api/host/bridge/commands/result", body);
    }

    private void postJson(String path, Map<String, Object> body) throws Exception {
        String json = gson.toJson(body);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException(
                    "POST " + path + " failed: HTTP " + response.statusCode() + " " + response.body()
            );
        }
    }
}
