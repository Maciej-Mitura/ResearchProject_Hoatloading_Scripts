/** Re-export shared contracts; API may extend with internal row shapes. */

export type {
  Script,
  ScriptVersion,
  ScriptLanguage,
  ScriptStatus,
  Execution,
  ExecutionStatus,
  ExecutionEvent,
  RiskAssessment,
  RiskClassification,
  SecurityEvent,
  Conversation,
  ChatMessage,
  ScriptProposal,
  HostConnection,
  HostEvent,
  HostCommand,
  HostCommandType,
  HostCommandResult,
  HostStatusResponse,
  BridgeHeartbeatRequest,
  BridgeHostEventRequest,
  BridgePendingCommandsResponse,
  BridgeCommandResultRequest,
  ApiError,
} from "../../../../packages/contracts/src/index.ts";

export { CONTRACT_VERSION } from "../../../../packages/contracts/src/index.ts";
import { HOST_EVENT_TYPES } from "../../../../packages/contracts/src/index.ts";

export const ALLOWED_HOST_COMMANDS = [
  "broadcast_message",
  "request_status",
  "request_player_list",
] as const;

export const ALLOWED_HOST_EVENTS = HOST_EVENT_TYPES;
