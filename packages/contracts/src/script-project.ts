/** Post-analysis project format. Canonical snapshots bind every file to review. */
export interface ScriptProject {
  entrypoint: string;
  files: Array<{ path: string; content: string }>;
}
export const PROJECT_LIMITS = {
  maxFiles: 20,
  maxFileBytes: 256 * 1024,
  maxTotalBytes: 512 * 1024,
} as const;
export const PLATFORM_LIMITATIONS = [
  "One bounded execution in a fresh sandbox; no persistent event listeners, click/join subscriptions, background jobs or daemons.",
  "No generic Minecraft commands, arbitrary Paper APIs, reflection, NBT or installed plugins.",
  "No dependency installation, HTTP/npm/jsr imports, unrestricted network or filesystem access.",
  "All project files form one immutable version. Changing any file requires a new version and fresh permission review.",
] as const;
export function projectPath(value: unknown): string {
  if (
    typeof value !== "string" || value.length > 160 ||
    !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*(?:\.(?:ts|js|json))$/.test(value) ||
    value.split("/").some((s) =>
      /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(s)
    )
  ) {
    throw new Error(
      "Use a relative .ts, .js or .json path without traversal, hidden segments or reserved names",
    );
  }
  return value;
}
export function parseProject(raw: unknown): ScriptProject {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Project object required");
  }
  const p = raw as Record<string, unknown>;
  if (
    Object.keys(p).some((k) => !["entrypoint", "files"].includes(k)) ||
    !Array.isArray(p.files) || !p.files.length ||
    p.files.length > PROJECT_LIMITS.maxFiles
  ) throw new Error("Project requires 1–20 files and an entrypoint");
  const seen = new Set<string>();
  let total = 0;
  const files = p.files.map((rawFile) => {
    if (!rawFile || typeof rawFile !== "object" || Array.isArray(rawFile)) {
      throw new Error("File object required");
    }
    const f = rawFile as Record<string, unknown>;
    const path = projectPath(f.path);
    if (
      Object.keys(f).some((k) => !["path", "content"].includes(k)) ||
      typeof f.content !== "string" || seen.has(path.toLowerCase())
    ) throw new Error("Invalid or duplicate project file");
    seen.add(path.toLowerCase());
    const bytes = new TextEncoder().encode(f.content).length;
    total += bytes;
    if (
      bytes > PROJECT_LIMITS.maxFileBytes ||
      total > PROJECT_LIMITS.maxTotalBytes
    ) throw new Error("Project exceeds 256 KiB per file or 512 KiB total");
    return { path, content: f.content };
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const entrypoint = projectPath(p.entrypoint);
  if (
    !/\.(ts|js)$/.test(entrypoint) || !files.some((f) => f.path === entrypoint)
  ) throw new Error("Entrypoint must name an existing .ts or .js file");
  return { entrypoint, files };
}
export function projectSource(p: ScriptProject): string {
  return p.files.find((f) => f.path === p.entrypoint)!.content;
}
export function projectText(p: ScriptProject): string {
  return p.files.map((f) => f.content).join("\n");
}
export function bindingSource(
  source: string,
  project?: ScriptProject | null,
): string {
  return project ? JSON.stringify(parseProject(project)) : source;
}
export function singleProject(source: string, language: string): ScriptProject {
  return {
    entrypoint: language === "javascript" ? "main.js" : "main.ts",
    files: [{
      path: language === "javascript" ? "main.js" : "main.ts",
      content: source,
    }],
  };
}
