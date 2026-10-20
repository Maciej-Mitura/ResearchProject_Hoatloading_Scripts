const src =
  `const cmd = new Deno.Command("echo", { args: ["hello"] });\nconst out = await cmd.output();\nconsole.log(new TextDecoder().decode(out.stdout));\n`;

const marker = "poc-debugmarker";
const args = [
  "run",
  "--rm",
  "-i",
  "--network",
  "none",
  "--read-only",
  "--user",
  "deno",
  "--cap-drop",
  "ALL",
  "--tmpfs",
  "/workspace:rw,size=64m,mode=1777",
  "--tmpfs",
  "/tmp:rw,size=16m,mode=1777",
  "-e",
  "SCRIPT_LANGUAGE=javascript",
  "-e",
  "DENO_DIR=/workspace/.deno",
  "-e",
  "PERMISSION_PROFILE=none",
  "-e",
  "DENO_AUDIT_PERMISSIONS=/workspace/permission-audit.jsonl",
  "-e",
  `POC_FRAME_MARKER=${marker}`,
  "research-poc-sandbox:local",
];

const cmd = new Deno.Command("docker", {
  args,
  stdin: "piped",
  stdout: "piped",
  stderr: "piped",
});
const child = cmd.spawn();
const w = child.stdin.getWriter();
await w.write(new TextEncoder().encode(src));
await w.close();
const [status, stdout, stderr] = await Promise.all([
  child.status,
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
]);
console.log("STATUS", status.code);
console.log("===== STDOUT =====");
console.log(stdout);
console.log("===== STDERR =====");
console.log(stderr.slice(0, 500));
