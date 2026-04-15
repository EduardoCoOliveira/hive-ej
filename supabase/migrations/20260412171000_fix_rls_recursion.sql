-- ─────────────────────────────────────────────────────────────
--  007_fix_rls_recursion.sql
--  Corrige recursão infinita nas policies de RLS que consultam
--  profiles/organizations entre si.
--
--  Estratégia:
--    1. Criar funções SECURITY DEFINER para resolver org/role/rank
--       do usuário autenticado sem depender da própria RLS.
--    2. Reescrever policies recursivas para usar essas funções.
--    3. Apertar a policy de expenses para que membros comuns vejam
--       apenas as próprias despesas; diretores/presidentes veem a org.
-- ─────────────────────────────────────────────────────────────

-- 1. Helpers seguros ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_profile_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_profile_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_profile_rank()
RETURNS public.member_rank
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT rank
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_profile_department()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT department
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_same_organization(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.current_profile_organization_id() = target_org
$$;

CREATE OR REPLACE FUNCTION public.has_user_role(allowed_roles public.user_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_profile_user_role() = ANY (allowed_roles)
$$;

CREATE OR REPLACE FUNCTION public.has_member_rank(allowed_ranks public.member_rank[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_profile_rank() = ANY (allowed_ranks)
$$;

-- Wrappers de compatibilidade para código/policies legadas
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.current_profile_organization_id()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.current_profile_user_role()
$$;

-- 2. Policies base -----------------------------------------------------------

DROP POLICY IF EXISTS "org_select_own" ON organizations;
CREATE POLICY "org_select_own" ON organizations
  FOR SELECT
  USING (public.is_same_organization(id));

DROP POLICY IF EXISTS "profiles_select_same_org" ON profiles;
CREATE POLICY "profiles_select_same_org" ON profiles
  FOR SELECT
  USING (public.is_same_organization(organization_id));

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "projects_org_isolation" ON projects;
CREATE POLICY "projects_org_isolation" ON projects
  FOR ALL
  USING (public.is_same_organization(organization_id))
  WITH CHECK (public.is_same_organization(organization_id));

DROP POLICY IF EXISTS "wiki_read_org" ON wiki_articles;
CREATE POLICY "wiki_read_org" ON wiki_articles
  FOR SELECT
  USING (public.is_same_organization(organization_id));

DROP POLICY IF EXISTS "wiki_write_member" ON wiki_articles;
CREATE POLICY "wiki_write_member" ON wiki_articles
  FOR INSERT
  WITH CHECK (
    public.is_same_organization(organization_id)
    AND public.has_user_role(ARRAY['owner', 'admin', 'member']::public.user_role[])
  );

DROP POLICY IF EXISTS "documents_org_isolation" ON documents;
CREATE POLICY "documents_org_isolation" ON documents
  FOR ALL
  USING (public.is_same_organization(organization_id))
  WITH CHECK (public.is_same_organization(organization_id));

DROP POLICY IF EXISTS "integrations_admin_only" ON integrations;
CREATE POLICY "integrations_admin_only" ON integrations
  FOR ALL
  USING (
    public.is_same_organization(organization_id)
    AND public.has_user_role(ARRAY['owner', 'admin']::public.user_role[])
  )
  WITH CHECK (
    public.is_same_organization(organization_id)
    AND public.has_user_role(ARRAY['owner', 'admin']::public.user_role[])
  );

DROP POLICY IF EXISTS "kpi_read_org" ON kpi_records;
CREATE POLICY "kpi_read_org" ON kpi_records
  FOR SELECT
  USING (public.is_same_organization(organization_id));

DROP POLICY IF EXISTS "kpi_write_admin" ON kpi_records;
CREATE POLICY "kpi_write_admin" ON kpi_records
  FOR INSERT
  WITH CHECK (
    public.is_same_organization(organization_id)
    AND public.has_user_role(ARRAY['owner', 'admin']::public.user_role[])
  );

DROP POLICY IF EXISTS "notification_settings_org_isolation" ON notification_settings;
CREATE POLICY "notification_settings_org_isolation" ON notification_settings
  FOR ALL
  USING (public.is_same_organization(organization_id))
  WITH CHECK (public.is_same_organization(organization_id));

-- 3. Policies da migration 003 ----------------------------------------------

DROP POLICY IF EXISTS "members see own org points" ON point_transactions;
CREATE POLICY "members see own org points" ON point_transactions
  FOR SELECT
  USING (org_id = public.current_profile_organization_id());

DROP POLICY IF EXISTS "members see own org rules" ON point_rules;
CREATE POLICY "members see own org rules" ON point_rules
  FOR SELECT
  USING (org_id = public.current_profile_organization_id());

DROP POLICY IF EXISTS "leaders manage rules" ON point_rules;
CREATE POLICY "leaders manage rules" ON point_rules
  FOR ALL
  USING (
    org_id = public.current_profile_organization_id()
    AND public.has_member_rank(
      ARRAY['dept_leader', 'director', 'president']::public.member_rank[]
    )
  )
  WITH CHECK (
    org_id = public.current_profile_organization_id()
    AND public.has_member_rank(
      ARRAY['dept_leader', 'director', 'president']::public.member_rank[]
    )
  );

DROP POLICY IF EXISTS "members see own org badges" ON member_badges;
CREATE POLICY "members see own org badges" ON member_badges
  FOR SELECT
  USING (org_id = public.current_profile_organization_id());

DROP POLICY IF EXISTS "members see own org stats" ON member_task_stats;
CREATE POLICY "members see own org stats" ON member_task_stats
  FOR SELECT
  USING (org_id = public.current_profile_organization_id());

DROP POLICY IF EXISTS "leaders see sentiment" ON discord_sentiment_log;
CREATE POLICY "leaders see sentiment" ON discord_sentiment_log
  FOR SELECT
  USING (
    org_id = public.current_profile_organization_id()
    AND public.has_member_rank(
      ARRAY['project_leader', 'dept_leader', 'director', 'president']::public.member_rank[]
    )
  );

DROP POLICY IF EXISTS "members see own org playbooks" ON playbooks;
CREATE POLICY "members see own org playbooks" ON playbooks
  FOR SELECT
  USING (org_id = public.current_profile_organization_id());

DROP POLICY IF EXISTS "leaders manage playbooks" ON playbooks;
CREATE POLICY "leaders manage playbooks" ON playbooks
  FOR ALL
  USING (
    org_id = public.current_profile_organization_id()
    AND public.has_member_rank(
      ARRAY['project_leader', 'dept_leader', 'director', 'president']::public.member_rank[]
    )
  )
  WITH CHECK (
    org_id = public.current_profile_organization_id()
    AND public.has_member_rank(
      ARRAY['project_leader', 'dept_leader', 'director', 'president']::public.member_rank[]
    )
  );

DROP POLICY IF EXISTS "leaders see initiation log" ON atomic_initiation_log;
CREATE POLICY "leaders see initiation log" ON atomic_initiation_log
  FOR SELECT
  USING (
    org_id = public.current_profile_organization_id()
    AND public.has_member_rank(
      ARRAY['project_leader', 'dept_leader', 'director', 'president']::public.member_rank[]
    )
  );

-- 4. Policies da migration 004 ----------------------------------------------

DROP POLICY IF EXISTS "org_members_can_view_integrations" ON org_integrations;
CREATE POLICY "org_members_can_view_integrations" ON org_integrations
  FOR SELECT
  USING (org_id = public.current_profile_organization_id());

-- 5. Policies da migration 005/006 ------------------------------------------

DROP POLICY IF EXISTS "org_members_view_expenses" ON expenses;

DROP POLICY IF EXISTS "org_members_insert_expense" ON expenses;
CREATE POLICY "org_members_insert_expense" ON expenses
  FOR INSERT
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND submitted_by = auth.uid()
  );

DROP POLICY IF EXISTS "members_own_expenses" ON expenses;
CREATE POLICY "members_own_expenses" ON expenses
  FOR SELECT
  USING (
    member_id = auth.uid()
    OR (
      public.is_same_organization(organization_id)
      AND public.has_member_rank(
        ARRAY['director', 'president']::public.member_rank[]
      )
    )
  );

DROP POLICY IF EXISTS "org_members_view_minutes" ON meeting_minutes;
CREATE POLICY "org_members_view_minutes" ON meeting_minutes
  FOR SELECT
  USING (organization_id = public.current_profile_organization_id());

DROP POLICY IF EXISTS "org_admins_view_offboarding" ON member_offboarding_log;
CREATE POLICY "org_admins_view_offboarding" ON member_offboarding_log
  FOR SELECT
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.has_member_rank(
      ARRAY['director', 'president']::public.member_rank[]
    )
  );

DROP POLICY IF EXISTS "org_members_view_channels" ON discord_role_channels;
CREATE POLICY "org_members_view_channels" ON discord_role_channels
  FOR SELECT
  USING (organization_id = public.current_profile_organization_id());
