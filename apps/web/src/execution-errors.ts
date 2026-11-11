import ansiRegex from "ansi-regex";
import type { Execution } from "./types";

/** Display projection only. Never rewrite stored output or interpret it as HTML. */
export function displayOutput(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "")
    .replace(ansiRegex(), "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, "");
}

/** Recognize clear static imports; skip comments, quoted examples and templates.
 * Not a general parser or permission/security analysis. Dynamic imports are excluded. */
export function importsHost(source: string): boolean {
  const tokens = source.match(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*|[^\s]/g,
  ) ?? [];
  const values = tokens.filter(
    (t) => !t.startsWith("//") && !t.startsWith("/*"),
  );
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== "import" || ["(", "."].includes(values[i + 1] ?? "")) {
      continue;
    }
    if (["'host'", '"host"'].includes(values[i + 1] ?? "")) return true;
    for (let j = i + 1; j < Math.min(values.length, i + 80); j++) {
      if ([";", "import"].includes(values[j]!)) break;
      if (
        values[j] === "from" &&
        ["'host'", '"host"'].includes(values[j + 1] ?? "")
      ) {
        return true;
      }
    }
  }
  return false;
}

export const failureLabels: Record<string, string> = {
  process_nonzero_exit: "Script exited with an error",
  deno_permission: "Restricted permission access",
  output_limit: "Execution output limit reached",
  timeout: "Execution time limit reached",
  memory_limit: "Memory limit reached",
  supervisor_error: "Execution infrastructure error",
  gateway_admin_timeout: "Host Gateway setup timed out",
  docker_operation_timeout: "Container operation timed out",
  capacity_rejected: "Execution capacity unavailable",
  mock_failure: "Simulated execution failure",
};
export const failureLabel = (code?: string | null) =>
  code
    ? (failureLabels[code] ?? "Unrecognized execution failure")
    : "Not recorded";

export function sourceLocation(text: string) {
  const normalized = displayOutput(text);
  const match = normalized.match(/(file:\/\/\/[^\s)]+?):(\d+):(\d+)/);
  if (!match) return null;
  const uri = match[1]!;
  return {
    uri,
    path: uri.startsWith("file:///workspace/project/")
      ? uri.slice("file:///workspace/project/".length)
      : uri.split("/").pop()!,
    line: Number(match[2]),
    column: Number(match[3]),
    label: `${
      uri.replace("file:///workspace/project/", "").replace(
        "file:///workspace/",
        "",
      )
    } · line ${match[2]}, column ${match[3]}`,
  };
}

export interface ExecutionError {
  kind: string;
  title: string;
  explanation: string;
  action: string;
  suggestedProfile?: "host-chat";
  location: ReturnType<typeof sourceLocation>;
}
export function executionError(x: Execution): ExecutionError | null {
  if (!["failed", "terminated", "blocked"].includes(x.status)) return null;
  const r = x.result,
    text = displayOutput(r?.stderr || x.errorMessage);
  const profile = r?.manifest?.permissionProfile;
  const location = sourceLocation(text);
  const make = (
    kind: string,
    title: string,
    explanation: string,
    action: string,
    suggestedProfile?: "host-chat",
  ): ExecutionError => ({
    kind,
    title,
    explanation,
    action,
    suggestedProfile,
    location,
  });
  if (r?.timedOut || r?.failureCategory === "timeout") {
    return make(
      "timeout",
      "Execution time limit reached",
      "The runner stopped the script at its configured wall-time deadline.",
      "Check for loops or work that cannot finish within the recorded limit.",
    );
  }
  if (r?.failureCategory === "output_limit") {
    return make(
      "output-limit",
      "Execution output limit reached",
      "The runner stopped this job after it exceeded the captured output budget. Only bounded output was retained.",
      "Reduce repeated logging or the amount of output before running again.",
    );
  }
  if (r?.oomKilled || r?.failureCategory === "memory_limit") {
    return make(
      "memory",
      "Memory limit reached",
      "The runner reported a memory-limit termination.",
      "Reduce the script's memory use and inspect the recorded runtime limits.",
    );
  }
  if (
    [
      "supervisor_error",
      "gateway_admin_timeout",
      "docker_operation_timeout",
      "capacity_rejected",
    ].includes(r?.failureCategory ?? "")
  ) {
    return make(
      "infrastructure",
      failureLabel(r?.failureCategory),
      "Execution could not finish because a runner, container or gateway operation failed.",
      "Inspect the technical details and local service health before retrying.",
    );
  }
  // Deno's module-resolution diagnostic identifies the exact failed specifier.
  // Stdout and a mere mention of 'host' are never enough to specialize an error.
  const hostImport =
    /(?:Import\s+["']host["']\s+not a dependency|(?:Module not found|Cannot resolve)[^\n]*["']host["'])/i
      .test(
        text,
      );
  if (
    hostImport && profile && profile !== "host-chat" &&
    profile !== "host-capabilities"
  ) {
    return make(
      "profile",
      "Host SDK unavailable",
      `Deno could not resolve the restricted Host SDK import. This execution used the ${profile} profile, which does not provide the trusted Host SDK/import map.`,
      "Return to Workbench and choose a compatible execution mode: Per-script permissions for reviewed versions, or Chat broadcast (fixed) for historical chat scripts. Do not install an npm package named host for this project.",
      "host-chat",
    );
  }
  if (
    hostImport && (profile === "host-chat" || profile === "host-capabilities")
  ) {
    return make(
      "host-setup",
      "Host SDK setup/runtime failure",
      `The recorded ${profile} profile should have provided the trusted Host SDK, but its import could not be resolved.`,
      "Inspect the sandbox import-map/setup and provider runtime. Selecting the same profile again does not diagnose this failure.",
    );
  }
  if (
    r?.failureCategory === "deno_permission" ||
    /(?:NotCapable:|Requires\s+[^\n]+--allow-)/.test(text)
  ) {
    return make(
      "permission",
      "Restricted permission access",
      "Deno reported an access request outside the configured execution grants.",
      "Check the requested operation against the profile information tooltip. Use only the supported scoped grants.",
    );
  }
  if (
    /(?:Import\s+["'][^\n]+not a dependency|Module not found|Cannot resolve|Relative import path)/i
      .test(
        text,
      )
  ) {
    return make(
      "import",
      "Module import could not be resolved",
      "Deno could not load a module required by the script.",
      "Check the import path and supported sandbox modules in the technical details.",
    );
  }
  if (x.status === "blocked") {
    return make(
      "blocked",
      "Execution request blocked",
      "The recorded request did not proceed to normal completion.",
      "Inspect the recorded request details before retrying.",
    );
  }
  if (x.status === "terminated") {
    return make(
      "terminated",
      "Execution was stopped",
      "The runner recorded an external stop; a more specific cause is not available.",
      "Inspect the available termination details.",
    );
  }
  return make(
    "runtime",
    "Script execution failed",
    r?.exitCode != null
      ? `The process returned exit code ${r.exitCode}. See technical details below.`
      : "The process returned an error. See technical details below.",
    "Review the recorded error and source location, correct the script and run it again.",
  );
}
