/**
 * Trusted script-side host client (baked into the sandbox image).
 * Scripts: import { host } from "host";
 *
 * Implementation details (gateway URL, tokens, bridge protocol) stay here.
 */

import { broadcast } from "./chat.ts";

export const host = {
  chat: {
    /**
     * Queue a chat broadcast on the host via the trusted Host Gateway.
     * Success means the command was accepted/queued — not that Minecraft
     * has already displayed the message.
     */
    broadcast,
  },
};

export default host;
