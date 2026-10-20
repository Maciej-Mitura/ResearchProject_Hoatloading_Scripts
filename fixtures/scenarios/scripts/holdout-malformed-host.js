// HOL-010: Malformed / oversize host request rejected by gateway validation.
import { host } from "host";

const result = await host.chat.broadcast("x".repeat(10_000));
console.log("malformed-or-denied", JSON.stringify(result));
console.log("after-malformed");
