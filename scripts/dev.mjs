#!/usr/bin/env node
/**
 * Single-command local stack launcher.
 * Wraps `docker compose up` with a clear console banner of endpoints and config.
 *
 * Usage:
 *   npm run dev          # start (reuse images)
 *   npm run dev:build    # start and rebuild images
 *   node scripts/dev.mjs --build --detach
 */
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const envExamplePath = join(root, ".env.example");

const args = new Set(process.argv.slice(2));
const wantBuild = args.has("--build");
const wantDetach = args.has("--detach") || args.has("-d");

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function ensureEnv() {
  if (existsSync(envPath)) return false;
  if (!existsSync(envExamplePath)) {
    console.error("Missing .env and .env.example — cannot start.");
    process.exit(1);
  }
  copyFileSync(envExamplePath, envPath);
  return true;
}

function banner(env, { createdEnv }) {
  const webPort = env.WEB_PORT || "5173";
  const apiPort = env.API_PORT || "3000";
  const mcPort = env.MC_PORT || "25565";
  const apiBase = (env.VITE_API_URL || `http://localhost:${apiPort}`).replace(
    /\/$/,
    "",
  );
  const pgUser = env.POSTGRES_USER || "poc";
  const pgDb = env.POSTGRES_DB || "research_poc";
  const chat = env.CHAT_PROVIDER || "mock";
  const risk = env.RISK_ANALYZER || "mock";
  const execution = env.EXECUTION_PROVIDER || "mock";

  const line = "─".repeat(56);
  console.log(`
${line}
  Research PoC — starting full Docker stack
${line}

  Endpoints (host)
    Web UI          http://localhost:${webPort}
    API             ${apiBase}
    API health      ${apiBase}/health
    Minecraft       localhost:${mcPort}

  Internal only (Docker network)
    PostgreSQL      postgres:5432  (db=${pgDb}, user=${pgUser})
    Supervisor      http://runner:3100  (not published to host)
    OTel collector  http://otel-collector:4318

  Config
    Chat provider   ${chat}${
    chat === "gemini" && env.GEMINI_MODEL
      ? `  (model=${env.GEMINI_MODEL})`
      : chat === "openai" && env.OPENAI_MODEL
      ? `  (model=${env.OPENAI_MODEL})`
      : ""
  }
    Risk analyzer   ${risk}
    Execution       ${execution}${
    execution === "docker" ? "  (real Deno sandbox)" : "  (simulated)"
  }
    Online mode     ${env.ONLINE_MODE ?? "false"}
    MC version      ${env.MC_VERSION || "1.21.1"}

  Startup order (Compose depends_on / healthchecks)
    postgres → healthy
    sandbox image build → supervisor + otel-collector
    bridge-builder → builds SecureBridge JAR
    api → healthy
    web + paper → start

${createdEnv ? "  Note: created .env from .env.example\n" : ""}\
  Stop with Ctrl+C, or run:  npm run stop
${line}
`);
}

function runCompose(composeArgs) {
  // Prefer no shell so args are not concatenated (avoids DEP0190 on Node 24+).
  // On Windows, docker.exe is typically on PATH when Docker Desktop is installed.
  const binary = process.platform === "win32" ? "docker.exe" : "docker";
  const child = spawn(binary, ["compose", ...composeArgs], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });

  const forward = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGTERM", () => forward("SIGTERM"));

  child.on("error", (err) => {
    console.error(
      "\nFailed to run Docker Compose. Is Docker Desktop running?\n",
      err.message,
    );
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 1);
  });
}

const createdEnv = ensureEnv();
const env = { ...parseEnvFile(envExamplePath), ...parseEnvFile(envPath) };
banner(env, { createdEnv });

const composeArgs = ["up"];
if (wantBuild) composeArgs.push("--build");
if (wantDetach) composeArgs.push("--detach");

console.log(`> docker compose ${composeArgs.join(" ")}\n`);
runCompose(composeArgs);
