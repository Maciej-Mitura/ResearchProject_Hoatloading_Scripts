export interface DynamicHostState {
  connected: boolean;
  bridgeConnected: boolean;
  pluginVersion: string | null;
  reportedServerVersion: string | null;
  onlinePlayers: number | null;
  maxPlayers: number | null;
  lastHeartbeatAt: string | null;
  pendingCommands: number;
}
