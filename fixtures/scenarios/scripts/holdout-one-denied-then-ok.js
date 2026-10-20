// HOL-005: One denied host action (empty message) then normal completion path.
import { host } from "host";

const denied = await host.chat.broadcast("   ");
console.log("deny-result", JSON.stringify(denied));
console.log("completed-after-deny");
