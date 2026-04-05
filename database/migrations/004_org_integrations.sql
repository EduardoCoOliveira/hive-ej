-- ─────────────────────────────────────────────────────────────
--  004_org_integrations.sql
--  Tabela de integrações OAuth por organização.
--  Tokens armazenados como BYTEA (AES-256-GCM encrypted).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,                    -- google_workspace | discord | clickup | notion | miro
  access_token    BYTEA NOT NULL,                   -- AES-256-GCM encrypted
  refresh_token   BYTEA,                            -- nullable for providers without refresh
  expires_at      TIMESTAMPTZ,                      -- NULL = does not expire
  scopes          TEXT[] DEFAULT '{}',
  workspace_name  TEXT,                             -- friendly name (guild, workspace, etc.)
  connected_by    UUID REFERENCES auth.users(id),
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (org_id, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_integrations_org_id ON org_integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_org_integrations_provider ON org_integrations(provider);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_org_integrations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_integrations_updated_at ON org_integrations;
CREATE TRIGGER trg_org_integrations_updated_at
  BEFORE UPDATE ON org_integrations
  FOR EACH ROW EXECUTE FUNCTION update_org_integrations_updated_at();

-- RLS
ALTER TABLE org_integrations ENABLE ROW LEVEL SECURITY;

-- Members can view their org integrations
CREATE POLICY "org_members_can_view_integrations"
  ON org_integrations FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Only directors/presidents can manage integrations (INSERT/UPDATE/DELETE handled by service role)
-- The API layer enforces rank-based access before calling admin client.
