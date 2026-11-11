# Execution Evidence Record

> Current Phase 1 boundaries and versioning: [PHASE1-STABILIZATION.md](PHASE1-STABILIZATION.md). No real Jev classification was performed during stabilization.

Canonical, provider-independent evidence for advisory risk analysis.

**evidenceSchemaVersion: 1**

DeterministicRiskAnalyzer and the implemented JevRiskAnalyzer consume this same
normalized representation. Jev builds its version-2 provider input from it;
the canonical record has no Jev-specific classification fields. See the
[completed empirical status](RESEARCH-STATUS.md).

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
