-- Singleton project settings overrides (JSONB). Base defaults live in config/project-spec.yaml.

CREATE TABLE IF NOT EXISTS project_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO project_settings (id, overrides)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
