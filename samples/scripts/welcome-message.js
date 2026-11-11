// Profile: host-chat. One manually triggered broadcast, not an event subscription.
import { host } from "host";
console.log(JSON.stringify(await host.chat.broadcast("Hello from the sandbox")));
