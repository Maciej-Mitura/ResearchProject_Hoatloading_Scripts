-- Older real AI replies stored code as Markdown, without structured proposals.
-- Link only exact complete code blocks with one unambiguous source message.
WITH exact_matches AS (
  SELECT DISTINCT s.id AS script_id, m.id AS message_id, m.conversation_id
  FROM scripts s
  JOIN script_versions v ON v.id = s.current_version_id
  JOIN messages m ON m.role = 'assistant'
  CROSS JOIN LATERAL regexp_matches(
    m.content, $code$```(?:javascript|typescript|js|ts)?[ \t]*\r?\n(.*?)```$code$, 'gis'
  ) AS block(parts)
  WHERE s.conversation_id IS NULL
    AND btrim(replace(block.parts[1], chr(13), '')) = btrim(replace(v.source, chr(13), ''))
), candidates AS (
  SELECT *, count(*) OVER (PARTITION BY script_id) AS matches FROM exact_matches
)
UPDATE scripts s SET conversation_id = c.conversation_id, source_message_id = c.message_id
FROM candidates c WHERE s.id = c.script_id AND c.matches = 1;
