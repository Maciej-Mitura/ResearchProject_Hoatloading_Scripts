-- Post-analysis immutable project snapshots; legacy rows are untouched.
ALTER TABLE script_versions ADD COLUMN project JSONB;
CREATE FUNCTION reject_script_snapshot_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.source IS DISTINCT FROM OLD.source OR NEW.project IS DISTINCT FROM OLD.project OR NEW.language IS DISTINCT FROM OLD.language THEN
  RAISE EXCEPTION 'Script snapshots are immutable; create a new version';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_script_snapshot BEFORE UPDATE ON script_versions FOR EACH ROW EXECUTE FUNCTION reject_script_snapshot_update();
ALTER TABLE host_commands DROP CONSTRAINT host_commands_command_type_check;
ALTER TABLE host_commands ADD CONSTRAINT host_commands_command_type_check CHECK(command_type IN ('broadcast_message','request_status','request_player_list','capability_status','send_player_message','spawn_entity','player_state','get_block','set_block','set_weather','set_time','play_sound'));
CREATE INDEX execution_period_order ON executions(created_at DESC,id DESC);
