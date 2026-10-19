-- Research PoC initial schema
-- Single-researcher local environment — no auth tables by design.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT 'New conversation',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT NOT NULL,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE scripts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  description          TEXT,
  language             TEXT NOT NULL DEFAULT 'javascript',
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'ready', 'disabled')),
  current_version_id   UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE script_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id       UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  source          TEXT NOT NULL,
  language        TEXT NOT NULL,
  changelog       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (script_id, version_number)
);

ALTER TABLE scripts
  ADD CONSTRAINT fk_scripts_current_version
  FOREIGN KEY (current_version_id) REFERENCES script_versions(id) ON DELETE SET NULL;

CREATE TABLE executions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id           UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  script_version_id   UUID NOT NULL REFERENCES script_versions(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN (
                          'queued', 'validating', 'analysing', 'running',
                          'completed', 'blocked', 'failed', 'terminated'
                        )),
  risk_assessment_id  UUID,
  error_message       TEXT,
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_executions_script ON executions(script_id, created_at DESC);

CREATE TABLE execution_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id  UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  status        TEXT NOT NULL,
  message       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_execution_events_exec ON execution_events(execution_id, created_at);

CREATE TABLE risk_assessments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_version_id  UUID NOT NULL REFERENCES script_versions(id) ON DELETE CASCADE,
  execution_id       UUID REFERENCES executions(id) ON DELETE SET NULL,
  classification     TEXT NOT NULL CHECK (classification IN ('low', 'medium', 'high')),
  score              DOUBLE PRECISION NOT NULL,
  confidence         DOUBLE PRECISION NOT NULL,
  reasons            JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider           TEXT NOT NULL DEFAULT 'mock',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE executions
  ADD CONSTRAINT fk_executions_risk
  FOREIGN KEY (risk_assessment_id) REFERENCES risk_assessments(id) ON DELETE SET NULL;

CREATE TABLE security_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id  UUID REFERENCES executions(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message       TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_created ON security_events(created_at DESC);

CREATE TABLE host_connections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_version     TEXT NOT NULL,
  server_version     TEXT,
  online_players     INTEGER NOT NULL DEFAULT 0,
  last_heartbeat_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  connected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE host_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id  UUID REFERENCES host_connections(id) ON DELETE SET NULL,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_host_events_created ON host_events(created_at DESC);

CREATE TABLE host_commands (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_type  TEXT NOT NULL
                  CHECK (command_type IN (
                    'broadcast_message', 'request_status', 'request_player_list'
                  )),
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'delivered', 'completed', 'failed', 'rejected')),
  result        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_host_commands_pending ON host_commands(status, created_at)
  WHERE status = 'pending';

-- schema_migrations is owned by the migration runner (migrate.ts)
