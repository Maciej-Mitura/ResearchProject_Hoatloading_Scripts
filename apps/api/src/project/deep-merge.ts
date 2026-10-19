/**
 * Deep-merge plain objects. Arrays and primitives are replaced (not concatenated).
 * Used for base project-spec + persisted overrides → effective settings.
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown> | null | undefined,
): T {
  if (!override || Object.keys(override).length === 0) {
    return structuredClone(base);
  }
  const result: Record<string, unknown> = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = structuredClone(value);
    }
  }
  return result as T;
}

/** Collect dotted paths present in an object (for source attribution). */
export function collectPaths(
  obj: Record<string, unknown>,
  prefix = "",
): Set<string> {
  const paths = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      for (const p of collectPaths(value as Record<string, unknown>, path)) {
        paths.add(p);
      }
    } else {
      paths.add(path);
    }
  }
  return paths;
}

export function getAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function setAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const next = cur[part];
    if (!isPlainObject(next)) {
      cur[part] = {};
    }
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}
