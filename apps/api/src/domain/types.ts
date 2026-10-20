/** Re-export shared contracts; API may extend with internal row shapes. */

export type {
  Script,
  ScriptVersion,
  ScriptLanguage,
  ScriptStatus,
  Execution,
  ExecutionResult,
  ExecutionManifest,
  DenoPermissionsGrant,
  ExecutionStatus,
  ExecutionEvent,
  PermissionAccessEvent,
  PermissionProfileId,
  HostApiEvent,
  SecurityEvidenceSource,
  SupervisorExecuteRequest,
  SupervisorExecuteResponse,
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

export {
  CONTRACT_VERSION,
  DEFAULT_PERMISSION_PROFILE,
  PERMISSION_PROFILE_IDS,
  PERMISSION_PROFILE_META,
  isPermissionProfileId,
} from "../../../../packages/contracts/src/index.ts";
import { HOST_EVENT_TYPES } from "../../../../packages/contracts/src/index.ts";

export const ALLOWED_HOST_COMMANDS = [
  "broadcast_message",
  "request_status",
  "request_player_list",
] as const;

export const ALLOWED_HOST_EVENTS = HOST_EVENT_TYPES;
