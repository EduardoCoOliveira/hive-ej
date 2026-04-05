-- ============================================================
-- Hïve Migration 003: Hierarchy, Points & Mesh Thinking
-- ============================================================

-- ── 1. HIERARQUIA DE CARGOS ──────────────────────────────────

CREATE TYPE member_rank AS ENUM (
  'trainee',
  'assessor',
  'project_leader',
  'dept_leader',
  'director',
  'president'
);

-- Adicionar cargo à tabela de profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rank member_rank NOT NULL DEFAULT 'trainee',
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS discord_id TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS joined_at DATE;

-- ── 2. INTEGRAÇÕES POR PROJETO ────────────────────────────────
-- O líder escolhe quais APIs ativar em cada projeto

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS enabled_integrations JSONB DEFAULT '{
    "googleDrive": true,
    "googleDocs": true,
    "googleCalendar": true,
    "discord": true,
    "clickup": true,
    "notion": true,
    "miro": false
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS external_ids JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS client_context TEXT,
  ADD COLUMN IF NOT EXISTS estimated_hours INTEGER,
  ADD COLUMN IF NOT EXISTS leader_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS slug TEXT GENERATED ALWAYS AS (
    lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'))
  ) STORED;

-- ── 3. SISTEMA DE PONTOS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS point_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL,       -- Positive = award, negative = penalty
  trigger_event TEXT NOT NULL,   -- EVENT type string
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_event TEXT NOT NULL,
  project_id UUID REFERENCES projects(id),
  awarded_by UUID REFERENCES profiles(id), -- NULL = automated
  created_at TIMESTAMPTZ DEFAULT now()
);

-- View: saldo de pontos por membro
CREATE OR REPLACE VIEW member_point_balances AS
SELECT
  pt.org_id,
  pt.user_id,
  p.full_name,
  p.avatar_url,
  p.rank,
  p.department,
  COALESCE(SUM(pt.amount), 0) AS total_points,
  COALESCE(SUM(CASE WHEN pt.amount > 0 THEN pt.amount ELSE 0 END), 0) AS total_awarded,
  COALESCE(SUM(CASE WHEN pt.amount < 0 THEN pt.amount ELSE 0 END), 0) AS total_deducted,
  COUNT(*) AS transaction_count
FROM point_transactions pt
JOIN profiles p ON p.id = pt.user_id
GROUP BY pt.org_id, pt.user_id, p.full_name, p.avatar_url, p.rank, p.department;

-- RLS para point_transactions
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members see own org points" ON point_transactions
  FOR SELECT USING (org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE point_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members see own org rules" ON point_rules
  FOR SELECT USING (org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "leaders manage rules" ON point_rules
  FOR ALL USING (
    org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (SELECT rank FROM profiles WHERE id = auth.uid()) IN ('dept_leader', 'director', 'president')
  );

-- ── 4. BADGES & EXPERT RANKING ──────────────────────────────

CREATE TABLE IF NOT EXISTS member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  task_count INTEGER NOT NULL DEFAULT 0,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, category)
);

CREATE TABLE IF NOT EXISTS member_task_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  on_time_count INTEGER NOT NULL DEFAULT 0,
  early_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, member_id, category)
);

ALTER TABLE member_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members see own org badges" ON member_badges
  FOR SELECT USING (org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE member_task_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members see own org stats" ON member_task_stats
  FOR SELECT USING (org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ── 5. DISCORD SENTIMENT LOG ────────────────────────────────

CREATE TABLE IF NOT EXISTS discord_sentiment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  channel_id TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'concerned', 'negative')),
  score FLOAT NOT NULL,
  reasoning TEXT,
  suggested_action TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE discord_sentiment_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaders see sentiment" ON discord_sentiment_log
  FOR SELECT USING (
    org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (SELECT rank FROM profiles WHERE id = auth.uid()) IN ('project_leader', 'dept_leader', 'director', 'president')
  );

-- ── 6. PLAYBOOKS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  step TEXT NOT NULL,            -- PlaybookStep enum
  title TEXT NOT NULL,
  content JSONB NOT NULL,        -- Full PlaybookGuide JSON
  generated_by TEXT DEFAULT 'gpt-4o',
  is_customized BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members see own org playbooks" ON playbooks
  FOR SELECT USING (org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "leaders manage playbooks" ON playbooks
  FOR ALL USING (
    org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (SELECT rank FROM profiles WHERE id = auth.uid()) IN ('project_leader', 'dept_leader', 'director', 'president')
  );

-- ── 7. ATOMIC INITIATION LOG ────────────────────────────────
-- Rastreia o resultado de cada etapa da iniciação atômica

CREATE TABLE IF NOT EXISTS atomic_initiation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step TEXT NOT NULL,            -- 'drive' | 'discord' | 'clickup' | 'notion' | 'miro' | 'calendar' | 'playbook'
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  result JSONB,                  -- IDs externos ou mensagem de erro
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE atomic_initiation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaders see initiation log" ON atomic_initiation_log
  FOR SELECT USING (
    org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (SELECT rank FROM profiles WHERE id = auth.uid()) IN ('project_leader', 'dept_leader', 'director', 'president')
  );

-- ── 8. FUNÇÕES UTILITÁRIAS ───────────────────────────────────

-- Incrementa contagem de tarefas por categoria
CREATE OR REPLACE FUNCTION increment_member_task_count(
  p_member_id UUID,
  p_org_id UUID,
  p_category TEXT,
  p_on_time BOOLEAN,
  p_early BOOLEAN
) RETURNS void AS $$
BEGIN
  INSERT INTO member_task_stats (org_id, member_id, category, count, on_time_count, early_count)
  VALUES (p_org_id, p_member_id, p_category, 1, CASE WHEN p_on_time THEN 1 ELSE 0 END, CASE WHEN p_early THEN 1 ELSE 0 END)
  ON CONFLICT (org_id, member_id, category) DO UPDATE SET
    count = member_task_stats.count + 1,
    on_time_count = member_task_stats.on_time_count + CASE WHEN p_on_time THEN 1 ELSE 0 END,
    early_count = member_task_stats.early_count + CASE WHEN p_early THEN 1 ELSE 0 END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adiciona transação de pontos
CREATE OR REPLACE FUNCTION award_points(
  p_org_id UUID,
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_source_event TEXT,
  p_project_id UUID DEFAULT NULL,
  p_awarded_by UUID DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO point_transactions (org_id, user_id, amount, reason, source_event, project_id, awarded_by)
  VALUES (p_org_id, p_user_id, p_amount, p_reason, p_source_event, p_project_id, p_awarded_by);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para updated_at
CREATE TRIGGER set_point_rules_updated_at
  BEFORE UPDATE ON point_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_playbooks_updated_at
  BEFORE UPDATE ON playbooks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
