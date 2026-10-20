/**
 * Bounded output collection helpers.
 */

export interface TruncateResult {
  text: string;
  truncated: boolean;
  totalBytes: number;
}

/** Truncate a UTF-8 string to at most maxBytes (may cut mid-codepoint safely via TextDecoder). */
export function truncateUtf8(input: string, maxBytes: number): TruncateResult {
  const encoded = new TextEncoder().encode(input);
  if (encoded.byteLength <= maxBytes) {
    return { text: input, truncated: false, totalBytes: encoded.byteLength };
  }
  const slice = encoded.slice(0, maxBytes);
  const text = new TextDecoder().decode(slice);
  return { text, truncated: true, totalBytes: encoded.byteLength };
}

/**
 * Merge stdout/stderr under a combined budget.
 * Prefers keeping stderr when both would overflow (errors are more useful).
 */
export function boundCombinedOutput(
  stdout: string,
  stderr: string,
  maxBytes: number,
): { stdout: string; stderr: string; outputTruncated: boolean } {
  const stdoutEnc = new TextEncoder().encode(stdout);
  const stderrEnc = new TextEncoder().encode(stderr);
  const total = stdoutEnc.byteLength + stderrEnc.byteLength;
  if (total <= maxBytes) {
    return { stdout, stderr, outputTruncated: false };
  }

  // Reserve up to half for stderr, remainder for stdout (or full budget if one is empty).
  const stderrBudget = Math.min(stderrEnc.byteLength, Math.floor(maxBytes / 2));
  const stdoutBudget = maxBytes - stderrBudget;
  const out = truncateUtf8(stdout, stdoutBudget);
  const err = truncateUtf8(stderr, stderrBudget);
  return {
    stdout: out.text,
    stderr: err.text,
    outputTruncated: true,
  };
}

/** Map process/supervisor outcome to API execution status. */
export function mapToExecutionStatus(result: {
  timedOut: boolean;
  exitCode: number | null;
  supervisorError?: boolean;
}): "completed" | "failed" | "terminated" {
  if (result.timedOut) return "terminated";
  if (result.supervisorError) return "failed";
  if (result.exitCode === 0) return "completed";
  return "failed";
}
