import { broadcast } from "./chat.ts";
import { call } from "./call.ts";
export type SpawnType = "ZOMBIE" | "SKELETON" | "COW" | "PIG";
export interface ServerStatus {
  onlinePlayers: number;
  maxPlayers: number;
  version: string;
  demoLocation: { x: number; y: number; z: number };
}
export const host = {
  chat: { broadcast },
  server: {
    async status(): Promise<ServerStatus> {
      const result = await call<ServerStatus>("server.status", {});
      if (!result.success || !result.data) {
        throw new Error(
          `${result.error?.code ?? "CAPABILITY_RESULT_PENDING"}: ${
            result.error?.message ?? "Status not confirmed"
          }`,
        );
      }
      return result.data;
    },
  },
  player: {
    getState: async (
      playerName: string,
    ): Promise<
      {
        name: string;
        x: number;
        y: number;
        z: number;
        yaw: number;
        pitch: number;
        world: string;
      }
    > => data("player.getState", { playerName }),
    sendMessage: (playerName: string, message: string) =>
      call("player.sendMessage", { playerName, message }),
  },
  world: {
    getBlock: (
      args: { x: number; y: number; z: number },
    ): Promise<{ type: string; x: number; y: number; z: number }> =>
      data("world.getBlock", args),
    setBlock: (args: { x: number; y: number; z: number; type: string }) =>
      call("world.setBlock", args),
    setWeather: (weather: "CLEAR" | "RAIN" | "THUNDER") =>
      call("world.setWeather", { weather }),
    setTime: (time: "DAY" | "NOON" | "SUNSET" | "NIGHT") =>
      call("world.setTime", { time }),
    playSound: (args: { sound: string; x: number; y: number; z: number }) =>
      call("world.playSound", args),
    spawnEntity: (args: { type: SpawnType; x: number; y: number; z: number }) =>
      call("world.spawnEntity", args),
  },
};
export default host;

async function data<T>(id: string, args: Record<string, unknown>): Promise<T> {
  const result = await call<T>(id, args);
  if (!result.success || !result.data) {
    throw new Error(
      `${result.error?.code ?? "CAPABILITY_RESULT_PENDING"}: ${
        result.error?.message ?? "Host result not confirmed"
      }`,
    );
  }
  return result.data;
}
