ALTER TABLE scripts ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;
ALTER TABLE scripts ADD COLUMN source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX idx_scripts_conversation ON scripts(conversation_id);
-- Recover links for drafts previously saved by the chat route.
UPDATE scripts s SET conversation_id = m.conversation_id, source_message_id = m.id
FROM messages m WHERE m.metadata->>'savedScriptId' = s.id::text;

-- Recover older manually saved structured proposals only when the source has
-- exactly one matching assistant message. Never guess between conversations.
WITH candidates AS (
  SELECT s.id AS script_id, m.id AS message_id, m.conversation_id,
    count(*) OVER (PARTITION BY s.id) AS matches
  FROM scripts s JOIN script_versions v ON v.id = s.current_version_id
  JOIN messages m ON m.role = 'assistant' AND m.metadata->'proposal'->>'source' = v.source
  WHERE s.conversation_id IS NULL
)
UPDATE scripts s SET conversation_id = c.conversation_id, source_message_id = c.message_id
FROM candidates c WHERE s.id = c.script_id AND c.matches = 1;
