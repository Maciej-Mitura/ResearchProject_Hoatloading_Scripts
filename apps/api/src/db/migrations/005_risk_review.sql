-- Advisory classification vocabulary: low | review | high (was medium).
-- RESEARCH: "review" is not a malice label; "high" is not proof of malice.

ALTER TABLE risk_assessments DROP CONSTRAINT IF EXISTS risk_assessments_classification_check;

UPDATE risk_assessments
SET classification = 'review'
WHERE classification = 'medium';

ALTER TABLE risk_assessments
  ADD CONSTRAINT risk_assessments_classification_check
  CHECK (classification IN ('low', 'review', 'high'));
