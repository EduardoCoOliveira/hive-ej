-- ═══════════════════════════════════════════════════════════════
--  Hï Tech Hub — Schema Inicial PostgreSQL (Supabase)
--  Migration: 001_initial_schema
--  Multi-tenancy via organization_id em todas as tabelas
-- ═══════════════════════════════════════════════════════════════

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────

CREATE TYPE plan_tier AS ENUM ('free', 'premium', 'internal');
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE project_status AS ENUM (
  'prospecting', 'proposal', 'negotiation', 'active', 'completed', 'cancelled'
);
CREATE TYPE document_type AS ENUM ('contract', 'proposal', 'nda', 'other');
CREATE TYPE document_status AS ENUM ('draft', 'sent', 'signed', 'cancelled');
CREATE TYPE integration_provider AS ENUM (
  'google', 'clickup', 'notion', 'discord', 'canva', 'figma'
);
CREATE TYPE skill_category AS ENUM (
  'tech', 'design', 'marketing', 'finance', 'management', 'communication', 'other'
);

-- ─────────────────────────────────────────────────────────────
-- TABELA: organizations (tenants — Empresas Juniores)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                   TEXT NOT NULL,
  slug                   TEXT NOT NULL UNIQUE,           -- ex: "hitech-ufmg"
  email_domain           TEXT,                           -- ex: "hitech.org.br"
  logo_url               TEXT,
  plan_tier              plan_tier NOT NULL DEFAULT 'free',
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organizations IS 'Multi-tenancy root. Cada EJ é uma organização.';
COMMENT ON COLUMN organizations.slug IS 'Identificador URL-safe único da EJ.';
COMMENT ON COLUMN organizations.plan_tier IS 'free=grátis básico, premium=pago R$50, internal=Hï Tech whitelisted.';

-- ─────────────────────────────────────────────────────────────
-- TABELA: profiles (usuários por organização)
-- Estende auth.users do Supabase
-- ─────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name        TEXT NOT NULL,
  avatar_url       TEXT,
  role             user_role NOT NULL DEFAULT 'member',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_org ON profiles(organization_id);
COMMENT ON TABLE profiles IS 'Perfil estendido de cada membro, vinculado ao auth.users.';

-- ─────────────────────────────────────────────────────────────
-- TABELA: skills (catálogo de competências)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE skills (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  category     skill_category NOT NULL DEFAULT 'other',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_skills_name ON skills(LOWER(name));

-- ─────────────────────────────────────────────────────────────
-- TABELA: member_skills (matrix de competências por usuário)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE member_skills (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id    UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level       SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, skill_id)
);

CREATE INDEX idx_member_skills_user ON member_skills(user_id);
CREATE INDEX idx_member_skills_skill ON member_skills(skill_id);

-- ─────────────────────────────────────────────────────────────
-- TABELA: projects
-- ─────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  client_name      TEXT NOT NULL,
  status           project_status NOT NULL DEFAULT 'prospecting',
  value            NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date       DATE,
  end_date         DATE,
  description      TEXT,
  nps_score        SMALLINT CHECK (nps_score BETWEEN 0 AND 10),
  created_by       UUID NOT NULL REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ─────────────────────────────────────────────────────────────
-- TABELA: project_allocations (alocação de consultores)
-- Alimenta o algoritmo de alocação por competências
-- ─────────────────────────────────────────────────────────────
CREATE TABLE project_allocations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_in_project  TEXT NOT NULL,                    -- ex: "Tech Lead", "Consultor"
  hours_per_week   SMALLINT NOT NULL DEFAULT 10,
  start_date       DATE NOT NULL,
  end_date         DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX idx_allocations_project ON project_allocations(project_id);
CREATE INDEX idx_allocations_user ON project_allocations(user_id);

-- ─────────────────────────────────────────────────────────────
-- TABELA: kpi_records (indicadores Brasil Júnior)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE kpi_records (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period              CHAR(7) NOT NULL,              -- YYYY-MM
  revenue             NUMERIC(12,2) NOT NULL DEFAULT 0,
  projects_count      SMALLINT NOT NULL DEFAULT 0,
  active_members      SMALLINT NOT NULL DEFAULT 0,
  nps_average         NUMERIC(4,2),
  satisfaction_rate   NUMERIC(5,2),
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, period)
);

CREATE INDEX idx_kpi_org_period ON kpi_records(organization_id, period);

-- ─────────────────────────────────────────────────────────────
-- TABELA: wiki_articles (passagem de bastão)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE wiki_articles (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  content          TEXT NOT NULL DEFAULT '',          -- Markdown
  role_tag         TEXT,                              -- cargo relacionado
  author_id        UUID NOT NULL REFERENCES profiles(id),
  is_archived      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wiki_org ON wiki_articles(organization_id);
CREATE INDEX idx_wiki_role ON wiki_articles(role_tag) WHERE role_tag IS NOT NULL;

-- Busca full-text em português
CREATE INDEX idx_wiki_fts ON wiki_articles
  USING gin(to_tsvector('portuguese', title || ' ' || content));

-- ─────────────────────────────────────────────────────────────
-- TABELA: documents (contratos e propostas)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  type             document_type NOT NULL,
  status           document_status NOT NULL DEFAULT 'draft',
  title            TEXT NOT NULL,
  template_data    JSONB NOT NULL DEFAULT '{}',       -- dados do formulário
  pdf_url          TEXT,                              -- URL no Supabase Storage
  created_by       UUID NOT NULL REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_project ON documents(project_id) WHERE project_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- TABELA: integrations (tokens OAuth por organização)
-- access_token armazenado criptografado via pgcrypto
-- ─────────────────────────────────────────────────────────────
CREATE TABLE integrations (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider                integration_provider NOT NULL,
  access_token_enc        BYTEA NOT NULL,             -- criptografado
  refresh_token_enc       BYTEA,
  token_expires_at        TIMESTAMPTZ,
  external_workspace_id   TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  connected_by            UUID NOT NULL REFERENCES profiles(id),
  connected_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, provider)
);

CREATE INDEX idx_integrations_org ON integrations(organization_id);

-- ─────────────────────────────────────────────────────────────
-- TABELA: audit_logs (trilha de auditoria de segurança)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action           TEXT NOT NULL,                    -- ex: "document.created"
  entity_type      TEXT,                             -- ex: "document"
  entity_id        UUID,
  metadata         JSONB DEFAULT '{}',
  ip_address       INET,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(organization_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: retorna organization_id do usuário autenticado
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper: retorna role do usuário autenticado
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Organizations: membros veem apenas a própria EJ
CREATE POLICY "org_select_own" ON organizations
  FOR SELECT USING (id = public.current_org_id());

-- Profiles: membros veem colegas da mesma EJ
CREATE POLICY "profiles_select_same_org" ON profiles
  FOR SELECT USING (organization_id = public.current_org_id());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Projects: select, insert, update — mesma org
CREATE POLICY "projects_org_isolation" ON projects
  FOR ALL USING (organization_id = public.current_org_id());

-- Wiki: select público dentro da org; insert/update por membro+
CREATE POLICY "wiki_read_org" ON wiki_articles
  FOR SELECT USING (organization_id = public.current_org_id());

CREATE POLICY "wiki_write_member" ON wiki_articles
  FOR INSERT WITH CHECK (
    organization_id = public.current_org_id()
    AND public.current_user_role() IN ('owner', 'admin', 'member')
  );

-- Documents: isolamento por org
CREATE POLICY "documents_org_isolation" ON documents
  FOR ALL USING (organization_id = public.current_org_id());

-- Integrations: apenas admins/owners
CREATE POLICY "integrations_admin_only" ON integrations
  FOR ALL USING (
    organization_id = public.current_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );

-- KPIs: leitura por todos na org; escrita por admins
CREATE POLICY "kpi_read_org" ON kpi_records
  FOR SELECT USING (organization_id = public.current_org_id());

CREATE POLICY "kpi_write_admin" ON kpi_records
  FOR INSERT WITH CHECK (
    organization_id = public.current_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- TRIGGERS: updated_at automático
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_wiki_updated_at
  BEFORE UPDATE ON wiki_articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: provisionamento automático de perfil + plano
-- Dispara após signup no Supabase Auth
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_email         TEXT;
  v_domain        TEXT;
  v_plan          plan_tier;
  v_org_id        UUID;
  v_org_name      TEXT;
  v_org_slug      TEXT;
BEGIN
  v_email  := NEW.email;
  v_domain := SPLIT_PART(v_email, '@', 2);

  -- Determina o plano com base no domínio
  IF v_domain = 'hitech.org.br' THEN
    v_plan := 'internal';
  ELSE
    v_plan := 'free';
  END IF;

  -- Cria organização padrão (pode ser atualizada depois)
  v_org_name := COALESCE(
    NEW.raw_user_meta_data->>'organization_name',
    'Minha EJ'
  );
  v_org_slug := LOWER(REGEXP_REPLACE(v_org_name, '[^a-zA-Z0-9]', '-', 'g'))
                || '-' || SUBSTRING(uuid_generate_v4()::TEXT, 1, 6);

  INSERT INTO organizations (name, slug, email_domain, plan_tier)
  VALUES (v_org_name, v_org_slug, v_domain, v_plan)
  RETURNING id INTO v_org_id;

  -- Cria perfil do usuário como owner
  INSERT INTO profiles (id, organization_id, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    v_org_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(v_email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'owner'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
-- ═══════════════════════════════════════════════════════════════
--  Migration 002 — Funções auxiliares + Tabela de roadmap de integrações
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- FUNÇÃO: increment_kpi_revenue
-- Chamada pelo motor de automações quando um projeto é concluído
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_kpi_revenue(
  p_org_id UUID,
  p_period  CHAR(7),
  p_amount  NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO kpi_records (organization_id, period, revenue, projects_count)
  VALUES (p_org_id, p_period, p_amount, 1)
  ON CONFLICT (organization_id, period)
  DO UPDATE SET
    revenue         = kpi_records.revenue + EXCLUDED.revenue,
    projects_count  = kpi_records.projects_count + 1;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- FUNÇÃO: upsert_kpi_nps
-- Chamada quando o NPS de um projeto é registrado
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_kpi_nps(
  p_org_id    UUID,
  p_period    CHAR(7),
  p_nps_score SMALLINT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_old   NUMERIC;
BEGIN
  SELECT projects_count, nps_average
  INTO   v_count, v_old
  FROM   kpi_records
  WHERE  organization_id = p_org_id AND period = p_period;

  IF NOT FOUND THEN
    INSERT INTO kpi_records (organization_id, period, nps_average, projects_count)
    VALUES (p_org_id, p_period, p_nps_score, 1);
  ELSE
    UPDATE kpi_records
    SET nps_average = ((v_old * v_count) + p_nps_score) / (v_count + 1)
    WHERE organization_id = p_org_id AND period = p_period;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- TABELA: integration_roadmap
-- Registra integrações planejadas para o futuro
-- Usada também para mostrar "Em breve" na UI de integrações
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_roadmap (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  description   TEXT,
  icon_url      TEXT,
  status        TEXT NOT NULL DEFAULT 'planned',  -- planned | beta | available
  eta_quarter   TEXT,                              -- ex: "Q3 2025"
  vote_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Popula com as integrações planejadas
INSERT INTO integration_roadmap (provider, display_name, description, status, eta_quarter) VALUES
  ('whatsapp',        'WhatsApp Business',   'Notificações automáticas de projetos e NPS via WhatsApp para clientes', 'planned',   'Q3 2025'),
  ('github',          'GitHub',              'Sincroniza repositórios, issues e PRs com projetos do Hub',              'planned',   'Q3 2025'),
  ('miro',            'Miro',                'Embed de quadros colaborativos dentro dos projetos',                     'planned',   'Q4 2025'),
  ('portal_bj',       'Portal Brasil Júnior','Importação automática de KPIs e dados do MEJ direto do Portal BJ',      'planned',   'Q4 2025'),
  ('trello',          'Trello',              'Sincronização de cards e listas com projetos do Hub',                   'planned',   'Q1 2026'),
  ('slack',           'Slack',               'Alternativa ao Discord para notificações e automações',                  'planned',   'Q1 2026'),
  ('zapier',          'Zapier',              'Webhooks customizáveis para conectar qualquer ferramenta',               'planned',   'Q2 2026'),
  ('drive_folders',   'Google Drive (Pastas)','Organização automática de arquivos por projeto em pastas do Drive',    'beta',      NULL),
  ('gmail_templates', 'Gmail Templates',     'Envio de e-mails padronizados para clientes direto do Hub',             'beta',      NULL)
ON CONFLICT (provider) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- TABELA: notification_settings (configurações de alertas por org)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  organization_id        UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  discord_enabled        BOOLEAN NOT NULL DEFAULT true,
  discord_channel_name   TEXT DEFAULT 'projetos',
  -- Futuro: WhatsApp
  whatsapp_enabled       BOOLEAN NOT NULL DEFAULT false,
  whatsapp_number        TEXT,
  -- Eventos que disparam notificação
  notify_project_created    BOOLEAN NOT NULL DEFAULT true,
  notify_project_activated  BOOLEAN NOT NULL DEFAULT true,
  notify_project_completed  BOOLEAN NOT NULL DEFAULT true,
  notify_payment_failed     BOOLEAN NOT NULL DEFAULT true,
  notify_new_member         BOOLEAN NOT NULL DEFAULT false,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER trg_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_roadmap ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_settings_org_isolation" ON notification_settings
  FOR ALL USING (organization_id = public.current_org_id());

CREATE POLICY "roadmap_public_read" ON integration_roadmap
  FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────
-- VIEW: dashboard_summary
-- Facilita query do dashboard (evita múltiplas chamadas)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT
  o.id                                        AS org_id,
  o.name                                      AS org_name,
  o.plan_tier,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active')    AS active_projects,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'completed') AS completed_projects,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.is_active)          AS active_members,
  COALESCE(k.revenue, 0)                      AS current_month_revenue,
  COALESCE(k.nps_average, 0)                  AS current_month_nps,
  COUNT(DISTINCT i.provider)                  AS connected_integrations
FROM organizations o
LEFT JOIN projects p ON p.organization_id = o.id
LEFT JOIN profiles pr ON pr.organization_id = o.id
LEFT JOIN kpi_records k ON k.organization_id = o.id AND k.period = TO_CHAR(NOW(), 'YYYY-MM')
LEFT JOIN integrations i ON i.organization_id = o.id AND i.is_active
GROUP BY o.id, o.name, o.plan_tier, k.revenue, k.nps_average;
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
