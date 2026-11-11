import type { Execution, SecurityEvent } from "./types";
export function hostInteraction(x: Execution, events: SecurityEvent[]) {
  const callKinds = new Set([
    "host_api.requested",
    "host_api.allowed",
    "host_api.denied",
    "host_api.queued",
  ]);
  const saved = events.filter((e) => e.executionId === x.id);
  const local = (x.result?.hostApiEvents ?? []).filter(
    (e) => e.executionId === x.id && callKinds.has(e.eventType),
  );
  const all = [
    ...local.map((e) => ({
      type: e.eventType,
      commandId: e.commandId,
      callId: e.callId,
      reason: e.reason,
      capability: e.capability,
    })),
    ...saved
      .filter((e) => callKinds.has(e.eventType))
      .map((e) => ({
        type: e.eventType,
        commandId:
          typeof e.metadata.commandId === "string"
            ? e.metadata.commandId
            : undefined,
        callId:
          typeof e.metadata.callId === "string" ? e.metadata.callId : undefined,
        reason:
          typeof e.metadata.reason === "string" ? e.metadata.reason : undefined,
        capability:
          typeof e.metadata.capability === "string"
            ? e.metadata.capability
            : undefined,
      })),
  ];
  const rows = Array.from(
    new Map(
      all.map((e) => [`${e.type}/${e.callId ?? e.commandId ?? "unknown"}`, e]),
    ).values(),
  );
  const queued = Array.from(
    new Set(
      rows
        .filter((e) => e.type === "host_api.queued")
        .map((e) => e.commandId)
        .filter((v): v is string => !!v),
    ),
  );
  const results = new Map<string, SecurityEvent>();
  for (const e of [...saved].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    const m = e.metadata;
    if (
      e.eventType === "host.command.result" &&
      m.source === "secure_bridge" &&
      m.origin === "sandbox_capability" &&
      typeof m.commandId === "string" &&
      queued.includes(m.commandId) &&
      typeof m.success === "boolean"
    )
      results.set(m.commandId, e);
  }
  const confirmed = queued.filter(
    (id) => results.get(id)?.metadata.success === true,
  ).length;
  const failed = queued.filter(
    (id) => results.get(id)?.metadata.success === false,
  ).length;
  return {
    hasEvidence:
      rows.length > 0 ||
      saved.some((e) => e.eventType === "host.command.result"),
    requested: rows.filter((e) => e.type === "host_api.requested").length,
    authorized: rows.filter((e) => e.type === "host_api.allowed").length,
    denied: rows.filter((e) => e.type === "host_api.denied").length,
    queued,
    results,
    confirmed,
    failed,
    pending: queued.length - results.size,
    callIds: Array.from(
      new Set(rows.map((e) => e.callId).filter((v): v is string => !!v)),
    ),
    capabilities: Array.from(
      new Set(rows.map((e) => e.capability).filter((v): v is string => !!v)),
    ),
    reasons: Array.from(
      new Set([
        ...rows.map((e) => e.reason).filter((v): v is string => !!v),
        ...Array.from(results.values())
          .filter((e) => e.metadata.success === false)
          .map((e) =>
            typeof e.metadata.message === "string"
              ? e.metadata.message
              : e.message,
          ),
      ]),
    ),
  };
}
