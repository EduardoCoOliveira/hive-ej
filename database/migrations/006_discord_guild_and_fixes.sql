-- ─────────────────────────────────────────────────────────────
--  006_discord_guild_and_fixes.sql
--  Adiciona: discord_guild_id nas orgs, discord_channel_id nos projetos,
--  colunas faltantes em expenses, next_steps em meeting_minutes,
--  reviewed_by/reviewed_at em expenses, e member_id alias.
-- ─────────────────────────────────────────────────────────────

-- ── Organizations: Discord Guild ID ──────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS discord_guild_id TEXT;

-- ── Projects: Discord Channel ID ─────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS discord_channel_id TEXT;

-- ── Expenses: colunas extras necessárias pelo serviço ────────
-- Renomeia submitted_by → member_id (alias via view ou nova coluna)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES auth.users(id);

-- Preenche member_id a partir de submitted_by onde NULL
UPDATE expenses SET member_id = submitted_by WHERE member_id IS NULL;

-- company_name (alias de vendor_name)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS company_name TEXT;
UPDATE expenses SET company_name = vendor_name WHERE company_name IS NULL;

-- date (alias de expense_date)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS date TEXT; -- DD/MM/YYYY string
UPDATE expenses
  SET date = TO_CHAR(expense_date, 'DD/MM/YYYY')
  WHERE date IS NULL AND expense_date IS NOT NULL;

-- project_id
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- reviewed_by / reviewed_at (mapeados de approved_by/approved_at)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
UPDATE expenses SET reviewed_by = approved_by, reviewed_at = approved_at
  WHERE reviewed_by IS NULL AND approved_by IS NOT NULL;

-- currency
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL';

-- ── Meeting minutes: next_steps e processing_steps ───────────
ALTER TABLE meeting_minutes
  ADD COLUMN IF NOT EXISTS next_steps TEXT;

ALTER TABLE meeting_minutes
  ADD COLUMN IF NOT EXISTS processing_steps JSONB DEFAULT '[]';

-- uploaded_by (alias de created_by)
ALTER TABLE meeting_minutes
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);
UPDATE meeting_minutes SET uploaded_by = created_by WHERE uploaded_by IS NULL;

-- meeting_date como TEXT para compatibilidade DD/MM/YYYY
-- (a coluna existente é DATE, adiciona coluna texto ao lado)
ALTER TABLE meeting_minutes
  ADD COLUMN IF NOT EXISTS meeting_date_text TEXT;

-- ── Member offboarding log: coluna member_name já existe ─────
-- Garante que existe
ALTER TABLE member_offboarding_log
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- ── Índices adicionais ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expenses_member ON expenses(member_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_orgs_discord_guild ON organizations(discord_guild_id);

-- ── RLS adicionais para novas colunas ────────────────────────
-- O membro pode ver somente suas próprias despesas (via member_id também)
DROP POLICY IF EXISTS "members_own_expenses" ON expenses;
CREATE POLICY "members_own_expenses" ON expenses FOR SELECT
  USING (
    member_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND rank IN ('director', 'president')
    )
  );
