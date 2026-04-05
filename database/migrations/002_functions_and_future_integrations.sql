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
  FOR ALL USING (organization_id = auth.organization_id());

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
