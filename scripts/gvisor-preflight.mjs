#!/usr/bin/env node
/**
 * Detect whether the Docker daemon exposes runsc.
 * Exit 0 if available; exit 2 if not. Never claims gVisor ran a sandbox job.
 *
 * Usage: node scripts/gvisor-preflight.mjs
 */
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: false });
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

const info = run("docker", ["info", "--format", "{{json .Runtimes}}"]);
if (info.status !== 0) {
  console.error("docker info failed:", info.stderr || info.stdout);
  process.exit(2);
}

let runtimes;
try {
  runtimes = JSON.parse(info.stdout.trim() || "{}");
} catch {
  console.error("Could not parse Docker runtimes JSON");
  process.exit(2);
}

const names = Object.keys(runtimes);
console.log("Docker runtimes:", names.join(", ") || "(none)");

if (!names.includes("runsc")) {
  console.error(
    "runsc is NOT registered on this Docker daemon. " +
      "gVisor experiments require a Linux Docker host with runsc. " +
      "See docs/GVISOR-EXPERIMENT.md",
  );
  process.exit(2);
}

const probe = run("docker", ["run", "--rm", "--runtime=runsc", "hello-world"]);
if (probe.status !== 0) {
  console.error("runsc is registered but hello-world probe failed:");
  console.error(probe.stderr || probe.stdout);
  process.exit(2);
}

console.log("runsc appears available (hello-world with --runtime=runsc succeeded).");
console.log("This script does not run the research fixture matrix.");
process.exit(0);
