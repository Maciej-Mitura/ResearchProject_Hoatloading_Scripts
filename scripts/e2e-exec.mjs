/**
 * One-off end-to-end execution checks against a running API.
 * Usage: node scripts/e2e-exec.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = process.env.API_URL || "http://localhost:3000";
const fixtures = join(root, "fixtures", "execution");

async function createAndRun(filename, language, label) {
  const source = readFileSync(join(fixtures, filename), "utf8");
  const created = await fetch(`${api}/api/scripts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: label,
      description: "e2e fixture",
      language,
      source,
      status: "ready",
    }),
  }).then((r) => r.json());
  const scriptId = created.script?.id;
  if (!scriptId) throw new Error(`${label}: create failed ${JSON.stringify(created)}`);

  const exec = await fetch(`${api}/api/executions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scriptId }),
  }).then((r) => r.json());
  const id = exec.id;
  if (!id) throw new Error(`${label}: start failed ${JSON.stringify(exec)}`);

  const deadline = Date.now() + 45_000;
  let detail;
  while (Date.now() < deadline) {
    detail = await fetch(`${api}/api/executions/${id}`).then((r) => r.json());
    const status = detail.execution?.status;
    if (["completed", "failed", "terminated", "blocked"].includes(status)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const e = detail.execution;
  console.log(
    JSON.stringify(
      {
        label,
        status: e.status,
        provider: e.result?.provider,
        exitCode: e.result?.exitCode,
        timedOut: e.result?.timedOut,
        outputTruncated: e.result?.outputTruncated,
        durationMs: e.result?.durationMs,
        stdoutPreview: (e.result?.stdout || "").slice(0, 120),
        stderrPreview: (e.result?.stderr || "").slice(0, 200),
      },
      null,
      2,
    ),
  );
  return e;
}

const hello = await createAndRun("hello.js", "javascript", "hello");
const ts = await createAndRun("typescript-answer.ts", "typescript", "typescript");
const read = await createAndRun("read-hosts.js", "javascript", "read-hosts");
const loop = await createAndRun("infinite-loop.js", "javascript", "infinite-loop");
const large = await createAndRun("large-output.js", "javascript", "large-output");

console.log("\n--- assertions ---");
const checks = [
  ["hello completed", hello.status === "completed" && hello.result?.stdout?.includes("Hello from the sandbox")],
  ["ts completed 42", ts.status === "completed" && ts.result?.stdout?.includes("42")],
  ["read failed", read.status === "failed" && read.result?.exitCode !== 0],
  ["loop terminated", loop.status === "terminated" && loop.result?.timedOut === true],
  ["large truncated", large.result?.outputTruncated === true],
];
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) process.exitCode = 1;
}
