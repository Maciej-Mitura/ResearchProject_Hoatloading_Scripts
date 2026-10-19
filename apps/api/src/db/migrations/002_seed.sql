-- Demo seed data for local PoC (harmless text/data only — not executed as code)

INSERT INTO conversations (id, title, created_at, updated_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Welcome message demo', now() - interval '1 day', now() - interval '1 day');

INSERT INTO messages (conversation_id, role, content, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user',
   'Create something that sends a welcome message when a player joins.',
   now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'assistant',
   'I understand you want a script that broadcasts a welcome message when a player joins the server. I''ll draft a simple JavaScript extension for that.',
   now() - interval '1 day' + interval '2 seconds');

INSERT INTO scripts (id, name, description, language, status, created_at, updated_at) VALUES
  ('22222222-2222-2222-2222-222222222201', 'welcome-message',
   'Broadcast a welcome message when a player joins.', 'javascript', 'ready',
   now() - interval '2 days', now() - interval '1 day'),
  ('22222222-2222-2222-2222-222222222202', 'simple-calculation',
   'Harmless arithmetic demo script (data only).', 'javascript', 'draft',
   now() - interval '2 days', now() - interval '2 days'),
  ('22222222-2222-2222-2222-222222222203', 'host-status-query',
   'Request host status via the restricted host API.', 'typescript', 'draft',
   now() - interval '1 day', now() - interval '1 day');

INSERT INTO script_versions (id, script_id, version_number, source, language, changelog) VALUES
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 1,
   E'// welcome-message.js — SAMPLE DATA ONLY (not executed)\n// RESEARCH TODO: real sandbox execution deferred\nexport function onPlayerJoin(player) {\n  host.broadcast(`Welcome, ${player.name}!`);\n}\n',
   'javascript', 'Initial draft'),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222202', 1,
   E'// simple-calculation.js — SAMPLE DATA ONLY\nexport function run() {\n  return 2 + 2;\n}\n',
   'javascript', 'Initial draft'),
  ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222203', 1,
   E'// host-status-query.ts — SAMPLE DATA ONLY\nexport async function run(host: HostApi) {\n  return host.requestStatus();\n}\n',
   'typescript', 'Initial draft');

UPDATE scripts SET current_version_id = '33333333-3333-3333-3333-333333333301'
  WHERE id = '22222222-2222-2222-2222-222222222201';
UPDATE scripts SET current_version_id = '33333333-3333-3333-3333-333333333302'
  WHERE id = '22222222-2222-2222-2222-222222222202';
UPDATE scripts SET current_version_id = '33333333-3333-3333-3333-333333333303'
  WHERE id = '22222222-2222-2222-2222-222222222203';

INSERT INTO risk_assessments (id, script_version_id, classification, score, confidence, reasons, provider) VALUES
  ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301',
   'low', 0.15, 0.7,
   '["Uses only allowlisted host.broadcast", "No filesystem or network keywords detected (heuristic mock)"]'::jsonb,
   'mock');

INSERT INTO security_events (event_type, severity, message, metadata) VALUES
  ('platform.started', 'info', 'API started (seed placeholder event)', '{"source":"seed"}'::jsonb),
  ('research.todo', 'info',
   'RESEARCH TODO: authoritative security event taxonomy not yet defined',
   '{"source":"seed"}'::jsonb);
