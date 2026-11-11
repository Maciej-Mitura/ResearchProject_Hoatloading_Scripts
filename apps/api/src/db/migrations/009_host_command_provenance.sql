-- Historical commands deliberately remain unknown: never promote legacy payload._meta.
ALTER TABLE host_commands ADD COLUMN origin TEXT NOT NULL DEFAULT 'unknown'
  CHECK (origin IN ('unknown', 'sandbox_capability'));
ALTER TABLE host_commands ADD COLUMN correlation JSONB;
ALTER TABLE host_commands ADD CONSTRAINT host_command_correlation_origin CHECK (
  (origin = 'unknown' AND correlation IS NULL) OR
  (origin = 'sandbox_capability' AND correlation IS NOT NULL)
);
CREATE UNIQUE INDEX idx_host_command_gateway_call ON host_commands ((correlation->>'callId'))
  WHERE origin = 'sandbox_capability';
