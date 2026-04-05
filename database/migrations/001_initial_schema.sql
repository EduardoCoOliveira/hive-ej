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
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper: retorna role do usuário autenticado
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role
LANGUAGE sql STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Organizations: membros veem apenas a própria EJ
CREATE POLICY "org_select_own" ON organizations
  FOR SELECT USING (id = auth.organization_id());

-- Profiles: membros veem colegas da mesma EJ
CREATE POLICY "profiles_select_same_org" ON profiles
  FOR SELECT USING (organization_id = auth.organization_id());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Projects: select, insert, update — mesma org
CREATE POLICY "projects_org_isolation" ON projects
  FOR ALL USING (organization_id = auth.organization_id());

-- Wiki: select público dentro da org; insert/update por membro+
CREATE POLICY "wiki_read_org" ON wiki_articles
  FOR SELECT USING (organization_id = auth.organization_id());

CREATE POLICY "wiki_write_member" ON wiki_articles
  FOR INSERT WITH CHECK (
    organization_id = auth.organization_id()
    AND auth.user_role() IN ('owner', 'admin', 'member')
  );

-- Documents: isolamento por org
CREATE POLICY "documents_org_isolation" ON documents
  FOR ALL USING (organization_id = auth.organization_id());

-- Integrations: apenas admins/owners
CREATE POLICY "integrations_admin_only" ON integrations
  FOR ALL USING (
    organization_id = auth.organization_id()
    AND auth.user_role() IN ('owner', 'admin')
  );

-- KPIs: leitura por todos na org; escrita por admins
CREATE POLICY "kpi_read_org" ON kpi_records
  FOR SELECT USING (organization_id = auth.organization_id());

CREATE POLICY "kpi_write_admin" ON kpi_records
  FOR INSERT WITH CHECK (
    organization_id = auth.organization_id()
    AND auth.user_role() IN ('owner', 'admin')
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
