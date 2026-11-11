/** Additive extension: preserve frozen evidence schema/rules v1 byte-for-byte. */
import {
  buildExecutionEvidenceRecord,
  type EvidenceBuildInput,
  type ExecutionEvidenceRecord,
} from "./evidence.ts";
import {
  type AuditCollection,
  normalizeAuditCollection,
} from "../../../../packages/contracts/src/audit-collection.ts";
export const EVIDENCE_EXTENSION_VERSION = 1;
export type CollectedExecutionEvidenceRecord = ExecutionEvidenceRecord & {
  evidenceExtensionVersion: 1;
  auditCollection: AuditCollection;
};
export function buildCollectedExecutionEvidence(
  input: EvidenceBuildInput & {
    result:
      | (NonNullable<EvidenceBuildInput["result"]> & {
        auditCollection?: AuditCollection;
      })
      | null;
  },
): CollectedExecutionEvidenceRecord {
  return {
    ...buildExecutionEvidenceRecord(input),
    evidenceExtensionVersion: 1,
    auditCollection: normalizeAuditCollection(input.result?.auditCollection),
  };
}
