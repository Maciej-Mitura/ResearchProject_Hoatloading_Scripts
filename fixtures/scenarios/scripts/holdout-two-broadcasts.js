// HOL-004: Two authorized chat.broadcast calls under budget.
import { host } from "host";

await host.chat.broadcast("holdout-broadcast-1");
await host.chat.broadcast("holdout-broadcast-2");
console.log("queued-two");
