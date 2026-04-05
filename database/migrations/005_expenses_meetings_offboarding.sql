-- ─────────────────────────────────────────────────────────────
--  005_expenses_meetings_offboarding.sql
--  Tabelas para: Reembolsos, Atas de Reunião, Log de Offboarding
-- ─────────────────────────────────────────────────────────────

-- ── Reembolsos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submitted_by      UUID NOT NULL REFERENCES auth.users(id),
  amount            NUMERIC(10,2) NOT NULL,
  description       TEXT,
  vendor_name       TEXT,
  cnpj              TEXT,
  expense_date      DATE,
  category          TEXT DEFAULT 'other',          -- travel | food | supplies | software | other
  status            TEXT DEFAULT 'pending',         -- pending | approved | rejected | paid
  receipt_url       TEXT,                           -- Drive file URL
  drive_file_id     TEXT,                           -- Google Drive ID
  sheets_row        INTEGER,                        -- linha na planilha financeira
  discord_message_id TEXT,                          -- ID da mensagem de aprovação
  approved_by       UUID REFERENCES auth.users(id),
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  ai_extraction     JSONB,                          -- raw GPT Vision output
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_submitter ON expenses(submitted_by);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- ── Atas de Reunião ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  meeting_date      DATE NOT NULL,
  duration_minutes  INTEGER,
  participants      TEXT[],
  audio_url         TEXT,                           -- URL do áudio original
  transcript        TEXT,                           -- transcrição Whisper
  summary           TEXT,                           -- resumo GPT-4o
  decisions         JSONB DEFAULT '[]',             -- [{text, owner, deadline}]
  action_items      JSONB DEFAULT '[]',             -- [{text, assignee, due_date, clickup_task_id}]
  doc_url           TEXT,                           -- Google Docs URL
  doc_id            TEXT,                           -- Google Docs file ID
  discord_sent      BOOLEAN DEFAULT false,
  email_sent        BOOLEAN DEFAULT false,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minutes_org ON meeting_minutes(organization_id);
CREATE INDEX IF NOT EXISTS idx_minutes_project ON meeting_minutes(project_id);

-- ── Log de Offboarding ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_offboarding_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL,                  -- pode não existir mais em profiles
  member_name       TEXT,
  member_email      TEXT,
  triggered_by      UUID REFERENCES auth.users(id),
  steps             JSONB DEFAULT '[]',             -- [{step, ok, data, error}]
  google_suspended  BOOLEAN DEFAULT false,
  discord_removed   BOOLEAN DEFAULT false,
  clickup_removed   BOOLEAN DEFAULT false,
  notion_removed    BOOLEAN DEFAULT false,
  figma_removed     BOOLEAN DEFAULT false,
  canva_removed     BOOLEAN DEFAULT false,
  completed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Canais Discord por Cargo (configuração da org) ────────────
CREATE TABLE IF NOT EXISTS discord_role_channels (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rank              TEXT NOT NULL,                  -- trainee | assessor | project_leader | ...
  department        TEXT,                           -- NULL = todos os cargos
  channel_id        TEXT NOT NULL,
  channel_name      TEXT,
  UNIQUE(organization_id, rank, channel_id)
);

-- ── Planilha Financeira por Org ───────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS finance_sheet_id TEXT,   -- Google Sheets ID
  ADD COLUMN IF NOT EXISTS finance_drive_folder_id TEXT; -- pasta "Comprovantes"

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_offboarding_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_role_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_view_expenses" ON expenses FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_members_insert_expense" ON expenses FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND submitted_by = auth.uid());

CREATE POLICY "org_members_view_minutes" ON meeting_minutes FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_admins_view_offboarding" ON member_offboarding_log FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles
    WHERE id = auth.uid() AND rank IN ('director', 'president')
  ));

CREATE POLICY "org_members_view_channels" ON discord_role_channels FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ── Triggers updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();
