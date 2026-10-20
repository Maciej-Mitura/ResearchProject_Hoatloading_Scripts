import { host } from "host";

const result = await host.chat.broadcast("Hello from a restricted sandbox");
console.log(JSON.stringify(result));
