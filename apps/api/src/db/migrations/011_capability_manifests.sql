-- Post-research extension. Existing versions retain legacy profiles only.
CREATE TABLE script_capability_manifests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 script_version_id UUID NOT NULL UNIQUE REFERENCES script_versions(id) ON DELETE CASCADE,
 source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
 requested JSONB NOT NULL, warnings JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE script_capability_reviews (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 manifest_id UUID NOT NULL REFERENCES script_capability_manifests(id) ON DELETE CASCADE,
 approved JSONB NOT NULL, denied JSONB NOT NULL, approved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE execution_capability_authorities (
 execution_id UUID PRIMARY KEY REFERENCES executions(id) ON DELETE CASCADE,
 snapshot JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE FUNCTION reject_capability_history_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Capability history is immutable; create a new version or review'; END $$;
CREATE TRIGGER immutable_manifest BEFORE UPDATE ON script_capability_manifests FOR EACH ROW EXECUTE FUNCTION reject_capability_history_update();
CREATE TRIGGER immutable_review BEFORE UPDATE ON script_capability_reviews FOR EACH ROW EXECUTE FUNCTION reject_capability_history_update();
CREATE TRIGGER immutable_execution_authority BEFORE UPDATE ON execution_capability_authorities FOR EACH ROW EXECUTE FUNCTION reject_capability_history_update();

CREATE UNIQUE INDEX unique_manifest_call ON host_commands ((correlation->>'callId')) WHERE correlation->>'manifestId' IS NOT NULL;

ALTER TABLE host_commands DROP CONSTRAINT host_commands_command_type_check;
ALTER TABLE host_commands ADD CONSTRAINT host_commands_command_type_check CHECK(command_type IN ('broadcast_message','request_status','request_player_list','capability_status','send_player_message','spawn_entity'));
