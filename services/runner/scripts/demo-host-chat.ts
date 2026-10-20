const source = `import { host } from "host";
const r = await host.chat.broadcast("Hello from a restricted sandbox");
console.log(JSON.stringify(r));
`;

const res = await fetch("http://127.0.0.1:3100/execute", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    executionId: `demo-${crypto.randomUUID().slice(0, 8)}`,
    language: "javascript",
    permissionProfile: "host-chat",
    source,
  }),
});
console.log(await res.text());
