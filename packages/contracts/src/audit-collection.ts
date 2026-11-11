/** Collection completeness, not completeness of Deno's permission instrumentation. */
export interface AuditCollection {
  version: 1;
  status: "complete" | "partial" | "unavailable" | "legacy_unknown";
  reasons: string[];
}

export function normalizeAuditCollection(value: unknown): AuditCollection {
  if (value && typeof value === "object") {
    const v = value as Partial<AuditCollection>;
    if (
      v.version === 1 &&
      ["complete", "partial", "unavailable", "legacy_unknown"].includes(
        v.status ?? "",
      ) &&
      Array.isArray(v.reasons) && v.reasons.every((r) => typeof r === "string")
    ) {
      return {
        version: 1,
        status: v.status === "complete" && v.reasons.length
          ? "partial"
          : v.status!,
        reasons: [...v.reasons],
      };
    }
  }
  return {
    version: 1,
    status: "legacy_unknown",
    reasons: ["collection_status_not_recorded"],
  };
}
