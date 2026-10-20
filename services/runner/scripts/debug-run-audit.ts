import { runSandboxContainer } from "../src/docker.ts";

const r = await runSandboxContainer({
  executionId: "runx",
  language: "javascript",
  source: `const cmd = new Deno.Command("echo", { args: ["hello"] });
const out = await cmd.output();
console.log(new TextDecoder().decode(out.stdout));
`,
});
console.log(JSON.stringify({
  exit: r.exitCode,
  fail: r.failureCategory,
  events: r.permissionEvents,
  stderr: r.stderr.slice(0, 500),
}, null, 2));
