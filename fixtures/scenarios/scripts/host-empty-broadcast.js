import { host } from "host";

// Validation denial path — empty message is rejected by Host Gateway.
const result = await host.chat.broadcast("   ");
console.log(JSON.stringify(result));
