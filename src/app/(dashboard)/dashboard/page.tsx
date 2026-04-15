import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { KPICard } from "@/components/dashboard/KPICard";
import { RecentProjects } from "@/components/dashboard/RecentProjects";
import { IntegrationStatus } from "@/components/dashboard/IntegrationStatus";
import { QuickActions } from "@/components/dashboard/QuickActions";
import type { Database } from "@/lib/supabase/database.types";
import { Sparkles, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

type DashboardProfile = {
  full_name: string;
  avatar_url: string | null;
  organization_id: string;
};

type DashboardOrg = {
  name: string;
  plan_tier: "free" | "premium" | "internal";
};

type DashboardProject = {
  id: string;
  name: string;
  client_name: string;
  status: Database["public"]["Enums"]["project_status"];
  value: number;
  updated_at: string;
};

type DashboardIntegration = {
  provider: Database["public"]["Enums"]["integration_provider"];
  is_active: boolean;
  connected_at: string;
};

type DashboardProjectRow = {
  id: string;
  name: string;
  client_name: string;
  status: Database["public"]["Enums"]["project_status"];
  value: number | null;
  updated_at: string;
};

type DashboardIntegrationRow = {
  provider: string;
  connected_at: string;
};

const SUPPORTED_INTEGRATION_PROVIDERS = new Set<Database["public"]["Enums"]["integration_provider"]>([
  "google",
  "clickup",
  "notion",
  "discord",
  "canva",
  "figma",
]);

function getKpiSnapshot(): {
  revenue?: number;
  projects_count?: number;
  nps_average?: number;
} | null {
  // kpi_records ainda nao esta disponivel em todos os ambientes.
  return null;
}

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileResult = await supabase
    .from("profiles")
    .select("full_name, avatar_url, organization_id")
    .eq("id", user.id)
    .single();
  const profile = profileResult.data as DashboardProfile | null;

  if (!profile) redirect("/register");

  const orgResult = await supabase
    .from("organizations")
    .select("name, plan_tier")
    .eq("id", profile.organization_id)
    .single();
  const org = orgResult.data as DashboardOrg | null;

  const [projectsResult, integrationsResult, membersCountResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, client_name, status, value, updated_at")
      .eq("organization_id", profile.organization_id)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("org_integrations")
      .select("provider, connected_at")
      .eq("org_id", profile.organization_id),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true),
  ]);

  const planTier = org?.plan_tier ?? "free";
  const firstName = profile.full_name.split(" ")[0] ?? "usuario";

  const kpi = getKpiSnapshot();

  const rawProjects = (projectsResult.data ?? []) as DashboardProjectRow[];
  const rawIntegrations = (integrationsResult.data ?? []) as DashboardIntegrationRow[];

  const projects: DashboardProject[] = rawProjects.map((project) => ({
    id: project.id,
    name: project.name,
    client_name: project.client_name,
    status: project.status,
    value: project.value ?? 0,
    updated_at: project.updated_at,
  }));
  const integrations: DashboardIntegration[] = rawIntegrations
    .filter(
      (
        integration,
      ): integration is {
        provider: Database["public"]["Enums"]["integration_provider"];
        connected_at: string;
      } =>
        SUPPORTED_INTEGRATION_PROVIDERS.has(
          integration.provider as Database["public"]["Enums"]["integration_provider"],
        ),
    )
    .map((integration) => ({
      provider: integration.provider,
      connected_at: integration.connected_at,
      is_active: true,
    }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Dashboard"
        subtitle={`Bom dia, ${firstName}`}
        userName={profile.full_name}
        userEmail={user.email ?? ""}
        planTier={planTier}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {planTier === "free" && (
            <div
              className="relative overflow-hidden flex items-center justify-between
                            p-4 rounded-2xl border border-brand-purple/25
                            bg-gradient-to-r from-brand-navy/5 via-brand-purple/5 to-brand-teal/5
                            dark:from-brand-navy/30 dark:via-brand-purple/20 dark:to-brand-teal/10"
            >
              <div
                className="absolute -right-8 -top-8 w-32 h-32 rounded-full
                              bg-brand-purple/10 dark:bg-brand-purple/20 blur-2xl pointer-events-none"
              />

              <div className="flex items-center gap-3 relative z-10">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #4E378C, #09254D)" }}
                >
                  <Sparkles className="w-5 h-5 text-brand-yellow" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Desbloqueie o Premium
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Smart Match, Documentos Automáticos e integrações completas — R$ 50/mês
                  </p>
                </div>
              </div>

              <a
                href="/configuracoes/upgrade"
                className="relative z-10 flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl
                           text-sm font-semibold text-white transition-all hover:opacity-90 ml-4"
                style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
              >
                Ver planos
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}

          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Indicadores do Mês
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label="Faturamento"
                value={kpi?.revenue ? `R$ ${kpi.revenue.toLocaleString("pt-BR")}` : "—"}
                icon="💰"
                trend={+8.2}
                trendLabel="%"
                color="teal"
              />
              <KPICard
                label="Projetos Ativos"
                value={kpi?.projects_count?.toString() ?? "0"}
                icon="📁"
                trend={+2}
                color="navy"
              />
              <KPICard
                label="NPS Médio"
                value={kpi?.nps_average ? `${kpi.nps_average}/10` : "—"}
                icon="⭐"
                trend={+0.5}
                trendLabel=" pts"
                color="yellow"
              />
              <KPICard
                label="Membros Ativos"
                value={membersCountResult.count?.toString() ?? "0"}
                icon="👥"
                color="purple"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <RecentProjects projects={projects} />
            </div>
            <div className="space-y-4">
              <QuickActions planTier={planTier} />
              <IntegrationStatus integrations={integrations} planTier={planTier} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
