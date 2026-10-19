/**
 * Shared chat-provider errors (no SDK imports).
 */
export class ChatProviderError extends Error {
  constructor(
    public readonly category:
      | "config"
      | "auth"
      | "model"
      | "rate_limit"
      | "timeout"
      | "network"
      | "server"
      | "empty"
      | "unknown",
    message: string,
    public readonly httpStatus?: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ChatProviderError";
  }
}
