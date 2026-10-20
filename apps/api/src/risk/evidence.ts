/**
 * Canonical ExecutionEvidenceRecord — provider-independent trusted evidence.
 * Built from stored execution + security events. Never from raw script claims.
 *
 * evidenceSchemaVersion must stay stable for DeterministicRiskAnalyzer and
 * JevRiskAnalyzer to consume the same shape.
 */

export const EVIDENCE_SCHEMA_VERSION = 1 as const;

export type EvidenceProvenance =
  | "application"
  | "supervisor"
  | "deno_permission_audit"
  | "host_gateway"
  | "secure_bridge"
  | "script_output"
  | "mock";

export interface PermissionAccessEvidence {
  permission: string;
  target: string | null;
  source: EvidenceProvenance;
}

export interface HostApiCallEvidence {
  capability: string;
  callId: string;
  commandId?: string | null;
  reason?: string | null;
  timestamp?: string | null;
}

export interface ExecutionEvidenceRecord {
  evidenceSchemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  executionId: string;
  traceId: string | null;

  script: {
    language: string;
    permissionProfile: string;
  };

  runtime: {
    runtime: "deno" | "unknown";
    runtimeVersion: string | null;
    containerRuntime: string | null;
    provider: string;
    durationMs: number | null;
    exitCode: number | null;
    timedOut: boolean;
    outputTruncated: boolean;
  };

  permissions: {
    accesses: PermissionAccessEvidence[];
    failureCategory: string | null;
    auditTruncated: boolean;
  };

  hostApi: {
    requested: HostApiCallEvidence[];
    allowed: HostApiCallEvidence[];
    denied: HostApiCallEvidence[];
    queued: HostApiCallEvidence[];
  };

  resources: {
    timedOut: boolean;
    outputTruncated: boolean;
  };

  termination: {
    status: string;
    reason: string | null;
  };

  /** Evidence sources observed while building this record. */
  provenance: EvidenceProvenance[];

  /**
   * Untrusted contextual stdout/stderr previews — NEVER used as sole
   * classification basis by the deterministic analyzer.
   */
  untrustedContext?: {
    stdoutPreview?: string;
    stderrPreview?: string;
  };
}

export interface EvidenceBuildInput {
  executionId: string;
  status: string;
  errorMessage?: string | null;
  language: string;
  permissionProfile: string;
  result: {
    provider?: string;
    runtimeVersion?: string | null;
    durationMs?: number;
    exitCode?: number | null;
    timedOut?: boolean;
    outputTruncated?: boolean;
    failureCategory?: string | null;
    traceId?: string | null;
    permissionEvents?: Array<{
      permission: string;
      target?: string | null;
      source?: string;
    }>;
    permissionAuditTruncated?: boolean;
    hostApiEvents?: Array<{
      eventType: string;
      capability: string;
      callId: string;
      commandId?: string;
      reason?: string;
      timestamp?: string;
    }>;
    stdout?: string;
    stderr?: string;
    manifest?: {
      dockerRuntime?: string;
      permissionProfile?: string;
      runtimeVersion?: string;
    } | null;
  } | null;
  securityEvents?: Array<{
    eventType: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }>;
}

function asProvenance(raw: unknown, fallback: EvidenceProvenance): EvidenceProvenance {
  const s = typeof raw === "string" ? raw : fallback;
  const allowed: EvidenceProvenance[] = [
    "application",
    "supervisor",
    "deno_permission_audit",
    "host_gateway",
    "secure_bridge",
    "script_output",
    "mock",
  ];
  return (allowed.includes(s as EvidenceProvenance)
    ? s
    : fallback) as EvidenceProvenance;
}

function hostFrom(
  capability: string,
  callId: string,
  commandId?: string | null,
  reason?: string | null,
  timestamp?: string | null,
): HostApiCallEvidence {
  return {
    capability,
    callId,
    commandId: commandId ?? null,
    reason: reason ?? null,
    timestamp: timestamp ?? null,
  };
}

/**
 * Build a canonical evidence record from trusted stored execution data.
 * Does not accept scenarioId / reference labels.
 */
export function buildExecutionEvidenceRecord(
  input: EvidenceBuildInput,
): ExecutionEvidenceRecord {
  const result = input.result;
  const provenance = new Set<EvidenceProvenance>(["application"]);

  const accesses: PermissionAccessEvidence[] = [];
  for (const pe of result?.permissionEvents ?? []) {
    const source = asProvenance(pe.source, "deno_permission_audit");
    provenance.add(source);
    accesses.push({
      permission: pe.permission,
      target: pe.target ?? null,
      source,
    });
  }

  // Backfill from security_events when result JSON is thin.
  for (const ev of input.securityEvents ?? []) {
    if (ev.eventType === "permission.accessed") {
      const perm = String(ev.metadata?.permission ?? "");
      if (!perm) continue;
      const target = ev.metadata?.target != null
        ? String(ev.metadata.target)
        : null;
      const already = accesses.some(
        (a) => a.permission === perm && a.target === target,
      );
      if (already) continue;
      const source = asProvenance(ev.metadata?.source, "deno_permission_audit");
      provenance.add(source);
      accesses.push({ permission: perm, target, source });
    }
  }

  const hostApi = {
    requested: [] as HostApiCallEvidence[],
    allowed: [] as HostApiCallEvidence[],
    denied: [] as HostApiCallEvidence[],
    queued: [] as HostApiCallEvidence[],
  };

  const pushHost = (
    bucket: keyof typeof hostApi,
    ev: {
      capability: string;
      callId: string;
      commandId?: string;
      reason?: string;
      timestamp?: string;
    },
  ) => {
    provenance.add("host_gateway");
    hostApi[bucket].push(
      hostFrom(
        ev.capability,
        ev.callId,
        ev.commandId,
        ev.reason,
        ev.timestamp,
      ),
    );
  };

  for (const he of result?.hostApiEvents ?? []) {
    if (he.eventType === "host_api.requested") pushHost("requested", he);
    else if (he.eventType === "host_api.allowed") pushHost("allowed", he);
    else if (he.eventType === "host_api.denied") pushHost("denied", he);
    else if (he.eventType === "host_api.queued") pushHost("queued", he);
  }

  for (const ev of input.securityEvents ?? []) {
    if (!ev.eventType.startsWith("host_api.")) continue;
    const capability = String(ev.metadata?.capability ?? "");
    const callId = String(ev.metadata?.callId ?? "");
    if (!capability || !callId) continue;
    const item = {
      capability,
      callId,
      commandId: ev.metadata?.commandId != null
        ? String(ev.metadata.commandId)
        : undefined,
      reason: ev.metadata?.reason != null
        ? String(ev.metadata.reason)
        : undefined,
      timestamp: ev.metadata?.timestamp != null
        ? String(ev.metadata.timestamp)
        : undefined,
    };
    const bucket = ev.eventType.replace(
      /^host_api\./,
      "",
    ) as keyof typeof hostApi;
    if (!(bucket in hostApi)) continue;
    const dup = hostApi[bucket].some((h) => h.callId === callId);
    if (dup) continue;
    pushHost(bucket, item);
  }

  for (const ev of input.securityEvents ?? []) {
    if (ev.eventType === "host.command.result") {
      provenance.add("secure_bridge");
    }
    if (ev.eventType === "execution.failure.deno_permission") {
      provenance.add("supervisor");
    }
    if (ev.eventType === "risk.assessment.mock") {
      provenance.add("mock");
    }
  }

  const timedOut = Boolean(result?.timedOut);
  const outputTruncated = Boolean(result?.outputTruncated);
  const profile = result?.manifest?.permissionProfile ??
    input.permissionProfile;

  let failureCategory = result?.failureCategory ?? null;
  if (
    !failureCategory &&
    (input.securityEvents ?? []).some((e) =>
      e.eventType === "execution.failure.deno_permission"
    )
  ) {
    failureCategory = "deno_permission";
    provenance.add("supervisor");
  }

  const record: ExecutionEvidenceRecord = {
    evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
    executionId: input.executionId,
    traceId: result?.traceId ??
      (typeof input.securityEvents?.find((e) => e.metadata?.traceId)
          ?.metadata?.traceId === "string"
        ? String(
          input.securityEvents.find((e) => e.metadata?.traceId)?.metadata
            ?.traceId,
        )
        : null),
    script: {
      language: input.language,
      permissionProfile: profile,
    },
    runtime: {
      runtime: "deno",
      runtimeVersion: result?.runtimeVersion ??
        result?.manifest?.runtimeVersion ?? null,
      containerRuntime: result?.manifest?.dockerRuntime ?? null,
      provider: result?.provider ?? "unknown",
      durationMs: result?.durationMs ?? null,
      exitCode: result?.exitCode ?? null,
      timedOut,
      outputTruncated,
    },
    permissions: {
      accesses,
      failureCategory,
      auditTruncated: Boolean(result?.permissionAuditTruncated),
    },
    hostApi,
    resources: { timedOut, outputTruncated },
    termination: {
      status: input.status,
      reason: input.errorMessage ?? null,
    },
    provenance: [...provenance],
  };

  if (result?.stdout || result?.stderr) {
    provenance.add("script_output");
    record.provenance = [...provenance];
    record.untrustedContext = {
      stdoutPreview: (result.stdout ?? "").slice(0, 200),
      stderrPreview: (result.stderr ?? "").slice(0, 200),
    };
  }

  return record;
}
