-- Extend risk_assessments for Jev / comparison metadata.
-- Classification may be NULL when assessment_status is failed or unavailable.

ALTER TABLE risk_assessments
  ADD COLUMN IF NOT EXISTS analyzer_version TEXT,
  ADD COLUMN IF NOT EXISTS latency_ms DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS evidence_schema_version INT,
  ADD COLUMN IF NOT EXISTS assessment_status TEXT NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS failure_kind TEXT,
  ADD COLUMN IF NOT EXISTS provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE risk_assessments DROP CONSTRAINT IF EXISTS risk_assessments_classification_check;

ALTER TABLE risk_assessments
  ALTER COLUMN classification DROP NOT NULL;

ALTER TABLE risk_assessments
  ALTER COLUMN confidence DROP NOT NULL;

ALTER TABLE risk_assessments
  ADD CONSTRAINT risk_assessments_classification_check
  CHECK (
    classification IS NULL
    OR classification IN ('low', 'review', 'high')
  );

ALTER TABLE risk_assessments DROP CONSTRAINT IF EXISTS risk_assessments_status_check;

ALTER TABLE risk_assessments
  ADD CONSTRAINT risk_assessments_status_check
  CHECK (assessment_status IN ('ok', 'failed', 'unavailable'));
