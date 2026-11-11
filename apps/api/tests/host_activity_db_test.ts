import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getPool, withClient } from "../src/db/client.ts";
import { addHostEvent, listHostEvents } from "../src/repositories/host.ts";

Deno.test({
  name:
    "host activity reconstructs confirmed broadcasts, retains failures, and filters before limiting",
  ignore: Deno.env.get("HOST_ACTIVITY_DB_TEST") !== "1",
  async fn() {
    try {
      await withClient(async (client) => {
        await client.queryArray("BEGIN");
        try {
          const command = (await client.queryObject<
            { id: string }
          >`INSERT INTO host_commands (command_type, payload) VALUES ('broadcast_message', '{"message":"Activity rollback test"}'::jsonb) RETURNING id`)
            .rows[0];
          const result = await addHostEvent(client, null, "command_result", {
            commandId: command.id,
            success: true,
            message: "broadcasted",
          });
          const failedCommand = (await client.queryObject<
            { id: string }
          >`INSERT INTO host_commands (command_type, payload) VALUES ('broadcast_message', '{"message":"Must not appear as chat"}'::jsonb) RETURNING id`)
            .rows[0];
          const failed = await addHostEvent(client, null, "command_result", {
            commandId: failedCommand.id,
            success: false,
            message: "failed",
          });
          for (let i = 0; i < 5; i++) {
            await addHostEvent(client, null, "heartbeat", {});
          }
          const chat = await listHostEvents(client, 200, "chat");
          const broadcast = chat.find((event) => event.id === result.id);
          assertEquals(broadcast?.eventType, "server_broadcast");
          assertEquals(
            broadcast?.payload.broadcastMessage,
            "Activity rollback test",
          );
          assertEquals(chat.some((event) => event.id === failed.id), false);
          const commands = await listHostEvents(client, 200, "commands");
          assertEquals(
            commands.find((event) => event.id === failed.id)?.eventType,
            "command_result",
          );
          const all = await listHostEvents(client, 200, "all");
          assertEquals(all.some((event) => event.id === result.id), true);
          assertEquals(
            all.some((event) => event.eventType === "heartbeat"),
            false,
          );
          const limited = await listHostEvents(client, 1, "chat");
          assertEquals(limited.length, 1);
          assertEquals(
            ["server_broadcast", "player_chat"].includes(limited[0].eventType),
            true,
          );
        } finally {
          await client.queryArray("ROLLBACK");
        }
      });
    } finally {
      await getPool().end();
    }
  },
});
