/** Entirely local: deliberately runs without --allow-net. Never alters frozen records. */
import { buildJevSystemOneRequest } from "../apps/api/src/risk/jev.ts";
import { validateEvidenceForJev } from "../apps/api/src/risk/jev-input.ts";
import { sha256 } from "../apps/api/src/risk/jev-policy.ts";
import type { ExecutionEvidenceRecord } from "../apps/api/src/risk/evidence.ts";

export function validateFrozenInputs(
  directory = new URL(
    "../research-results/risk-comparison/frozen-evidence-v1/",
    import.meta.url,
  ),
) {
  const names = [...Deno.readDirSync(directory)].filter((e) =>
    e.isFile && e.name.endsWith(".json")
  ).map((e) => e.name).sort();
  return names.map((file) => {
    let schemaValid = false;
    try {
      const bytes = Deno.readTextFileSync(new URL(file, directory));
      const record = JSON.parse(bytes) as { evidence: ExecutionEvidenceRecord };
      validateEvidenceForJev(record.evidence);
      schemaValid = true;
      // Explicit pinned experiment route; no credential or provider request needed.
      const request = buildJevSystemOneRequest(record.evidence, {
        provider: "vercel",
        model: "typesafe-ai/jev-1.14.0",
      });
      return {
        file,
        frozenFileHash: sha256(bytes),
        inputBuilt: true,
        schemaValid,
        leakageValid: request.integrity.safe,
        valid: request.integrity.safe,
        expectedEvidenceVersion: 1,
        actualEvidenceVersion: record.evidence.evidenceSchemaVersion,
        provenance: request.provenance,
        failures: request.integrity.forbiddenHits,
      };
    } catch (error) {
      return {
        file,
        inputBuilt: false,
        schemaValid,
        leakageValid: false,
        valid: false,
        failures: [
          error instanceof Error ? error.message : "validation_failed",
        ],
      };
    }
  });
}
if (import.meta.main) {
  const records = validateFrozenInputs();
  const summary = {
    kind: "phase1_local_jev_input_validation",
    validationVersion: 2,
    createdAt: new Date().toISOString(),
    providerCalls: 0,
    frozenFilesModified: false,
    expected: 25,
    total: records.length,
    valid: records.filter((r) => r.valid).length,
    records,
  };
  const output = new URL(
    "../research-results/phase1/input-validation-v2.json",
    import.meta.url,
  );
  Deno.mkdirSync(new URL("./", output), { recursive: true });
  Deno.writeTextFileSync(output, JSON.stringify(summary, null, 2) + "\n");
  console.log(
    `${summary.valid}/${summary.total} locally valid; ${summary.providerCalls} provider calls`,
  );
  if (summary.total !== 25 || summary.valid !== 25) Deno.exit(1);
}
