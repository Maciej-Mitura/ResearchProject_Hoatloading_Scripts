-- Truthful demo refresh only. Preserve historical versions and all execution evidence.
-- Skip any user-edited/advanced stock script, including a changed current source/name/description.
DO $phase6$
DECLARE new_version uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM scripts s JOIN script_versions v ON v.id=s.current_version_id
    WHERE s.id='22222222-2222-2222-2222-222222222201'
      AND v.id='33333333-3333-3333-3333-333333333301'
      AND s.name='welcome-message' AND s.description='Broadcast a welcome message when a player joins.'
      AND v.source=E'// welcome-message.js — SAMPLE DATA ONLY (not executed)\n// RESEARCH TODO: real sandbox execution deferred\nexport function onPlayerJoin(player) {\n  host.broadcast(`Welcome, ${player.name}!`);\n}\n'
      AND NOT EXISTS (SELECT 1 FROM script_versions newer WHERE newer.script_id=s.id AND newer.version_number>1)
  ) THEN
    INSERT INTO script_versions(script_id,version_number,source,language,changelog)
    VALUES('22222222-2222-2222-2222-222222222201',2,'// Profile: host-chat. One manually triggered broadcast, not an event subscription.
import { host } from "host";
console.log(JSON.stringify(await host.chat.broadcast("Hello from the sandbox")));
','javascript',
      'Phase 6: runnable current demo; version 1 retained as historical seed') RETURNING id INTO new_version;
    UPDATE scripts SET current_version_id=new_version,name='welcome-message',description='One manually triggered broadcast. Requires host-chat.',updated_at=now()
    WHERE id='22222222-2222-2222-2222-222222222201';
  END IF;
  IF EXISTS (
    SELECT 1 FROM scripts s JOIN script_versions v ON v.id=s.current_version_id
    WHERE s.id='22222222-2222-2222-2222-222222222202'
      AND v.id='33333333-3333-3333-3333-333333333302'
      AND s.name='simple-calculation' AND s.description='Harmless arithmetic demo script (data only).'
      AND v.source=E'// simple-calculation.js — SAMPLE DATA ONLY\nexport function run() {\n  return 2 + 2;\n}\n'
      AND NOT EXISTS (SELECT 1 FROM script_versions newer WHERE newer.script_id=s.id AND newer.version_number>1)
  ) THEN
    INSERT INTO script_versions(script_id,version_number,source,language,changelog)
    VALUES('22222222-2222-2222-2222-222222222202',2,'// Profile: none. Top-level source executes once.
console.log("Hello from the restricted sandbox");
console.log(2 + 2);
','javascript',
      'Phase 6: runnable current demo; version 1 retained as historical seed') RETURNING id INTO new_version;
    UPDATE scripts SET current_version_id=new_version,name='simple-calculation',description='Top-level logging and arithmetic. Profile: none.',updated_at=now()
    WHERE id='22222222-2222-2222-2222-222222222202';
  END IF;
  IF EXISTS (
    SELECT 1 FROM scripts s JOIN script_versions v ON v.id=s.current_version_id
    WHERE s.id='22222222-2222-2222-2222-222222222203'
      AND v.id='33333333-3333-3333-3333-333333333303'
      AND s.name='host-status-query' AND s.description='Request host status via the restricted host API.'
      AND v.source=E'// host-status-query.ts — SAMPLE DATA ONLY\nexport async function run(host: HostApi) {\n  return host.requestStatus();\n}\n'
      AND NOT EXISTS (SELECT 1 FROM script_versions newer WHERE newer.script_id=s.id AND newer.version_number>1)
  ) THEN
    INSERT INTO script_versions(script_id,version_number,source,language,changelog)
    VALUES('22222222-2222-2222-2222-222222222203',2,'// Profile: none. A caught denial can still leave permission observations.
try {
  await Deno.readTextFile("/etc/hosts");
} catch {
  console.log("Read was blocked, but the script continued");
}
','javascript',
      'Phase 6: runnable current demo; version 1 retained as historical seed') RETURNING id INTO new_version;
    UPDATE scripts SET current_version_id=new_version,name='caught-restricted-read',description='Catch a restricted read and inspect audit evidence. Profile: none.',updated_at=now()
    WHERE id='22222222-2222-2222-2222-222222222203';
  END IF;
  IF EXISTS (SELECT 1 FROM conversations WHERE id='11111111-1111-1111-1111-111111111111'
      AND title='Welcome message demo')
    AND (SELECT count(*) FROM messages WHERE conversation_id='11111111-1111-1111-1111-111111111111')=2
    AND EXISTS (SELECT 1 FROM messages WHERE conversation_id='11111111-1111-1111-1111-111111111111'
      AND role='assistant' AND content='I understand you want a script that broadcasts a welcome message when a player joins the server. I''ll draft a simple JavaScript extension for that.')
  THEN
    INSERT INTO messages(conversation_id,role,content) VALUES(
      '11111111-1111-1111-1111-111111111111','assistant',
      'Correction to the historical seed above: event subscriptions and player-name sandbox APIs are not implemented. The current welcome-message demo broadcasts once when manually run with host-chat. Old version 1 remains historical; use the current version and confirm Paper delivery in Server Info.');
  END IF;
END
$phase6$;
