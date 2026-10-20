-- Persist bounded execution outcomes (stdout/stderr/exit/timing/provider).
-- Values are PoC metadata; output is capped by the execution supervisor.
ALTER TABLE executions
  ADD COLUMN IF NOT EXISTS result JSONB;

COMMENT ON COLUMN executions.result IS
  'Bounded execution outcome: provider, exitCode, stdout, stderr, durationMs, timedOut, outputTruncated, sandboxImage';
