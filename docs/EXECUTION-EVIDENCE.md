# Execution Evidence Record

Canonical, provider-independent evidence for advisory risk analysis.

**evidenceSchemaVersion: 1**

DeterministicRiskAnalyzer and a future JevRiskAnalyzer must consume this same
normalized representation. There are no Jev-specific fields.

## Construction

Built from **trusted stored** execution + security evidence via
`buildExecutionEvidenceRecord()` (`apps/api/src/risk/evidence.ts`).

Not built from raw script claims, scenario IDs, or researcher labels.

## Schema (v1)

```ts
{
  evidenceSchemaVersion: 1,
  executionId: string,
  traceId: string | null,
  script: { language, permissionProfile },
  runtime: {
    runtime: "deno" | "unknown",
    runtimeVersion, containerRuntime, provider,
    durationMs, exitCode, timedOut, outputTruncated
  },
  permissions: {
    accesses: [{ permission, target, source }],
    failureCategory, auditTruncated
  },
  hostApi: {
    requested: [...],
    allowed: [...],
    denied: [...],
    queued: [...]
  },
  resources: { timedOut, outputTruncated },
  termination: { status, reason },
  provenance: EvidenceProvenance[],
  untrustedContext?: { stdoutPreview?, stderrPreview? }
}
```

## Provenance

| Source | Trust |
|--------|--------|
| `application` | Trusted |
| `supervisor` | Trusted |
| `deno_permission_audit` | Trusted |
| `host_gateway` | Trusted |
| `secure_bridge` | Trusted |
| `mock` | Mock / non-authoritative |
| `script_output` | **Untrusted** |

Deterministic classification uses trusted fields. `untrustedContext` is
contextual only — never sole basis for escalation.

## Limitations

- Permission accesses are Deno audit access/check events, not allow/deny.
- Host denial events require Host Gateway to have recorded them.
- Schema is intentionally small for a research PoC.
- Does not claim complete forensic coverage if a component failed to persist.
