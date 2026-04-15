import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Receipt, TrendingUp, TrendingDown, DollarSign, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financeiro" };

type FinanceProfile = {
  full_name: string;
  avatar_url: string | null;
  organization_id: string;
};

type FinanceOrg = {
  name: string;
  plan_tier: "free" | "premium" | "internal";
};

type RecentExpense = {
  id: string;
  amount: number | null;
  status: string | null;
  created_at: string;
  description: string | null;
  company_name: string | null;
};

export default async function FinanceiroPage() {
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
  const profile = profileResult.data as FinanceProfile | null;

  if (!profile) redirect("/register");

  const [orgResult, expensesResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, plan_tier")
      .eq("id", profile.organization_id)
      .single(),
    supabase
      .from("expenses")
      .select("id, amount, status, created_at, description, company_name")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const org = orgResult.data as FinanceOrg | null;
  const planTier = org?.plan_tier ?? "free";
  const reembolsos = (expensesResult.data ?? []) as RecentExpense[];
  const pendentes = reembolsos.filter((reembolso) => reembolso.status === "pending").length;
  const totalPendente = reembolsos
    .filter((reembolso) => reembolso.status === "pending")
    .reduce((sum, reembolso) => sum + (reembolso.amount ?? 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Financeiro"
        subtitle="Gestão financeira da sua EJ"
        userName={profile.full_name}
        userEmail={user.email ?? ""}
        planTier={planTier}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Receipt className="w-4 h-4" />
                Reembolsos Pendentes
              </div>
              <p className="text-3xl font-bold text-foreground">{pendentes}</p>
              <p className="text-xs text-muted-foreground">
                R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} aguardando aprovação
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp className="w-4 h-4" />
                Receita do Mês
              </div>
              <p className="text-3xl font-bold text-foreground">—</p>
              <p className="text-xs text-muted-foreground">Configure integrações para ver</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingDown className="w-4 h-4" />
                Despesas do Mês
              </div>
              <p className="text-3xl font-bold text-foreground">—</p>
              <p className="text-xs text-muted-foreground">Configure integrações para ver</p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Ações Rápidas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/financeiro/reembolsos"
                className="flex items-center justify-between bg-card border border-border rounded-2xl p-5 hover:border-brand-teal/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-teal/10 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-brand-teal" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Reembolsos</p>
                    <p className="text-xs text-muted-foreground">Solicitar e aprovar reembolsos</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-brand-teal transition-colors" />
              </Link>

              <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-5 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Fluxo de Caixa</p>
                    <p className="text-xs text-muted-foreground">Em breve</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {reembolsos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                  Reembolsos Recentes
                </h2>
                <Link href="/financeiro/reembolsos" className="text-xs text-brand-teal hover:underline">
                  Ver todos →
                </Link>
              </div>
              <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                {reembolsos.map((reembolso) => {
                  const titulo =
                    reembolso.description ||
                    reembolso.company_name ||
                    "Reembolso sem descrição";

                  return (
                    <div key={reembolso.id} className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(reembolso.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          R$ {(reembolso.amount ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            reembolso.status === "pending"
                              ? "bg-yellow-500/10 text-yellow-500"
                              : reembolso.status === "approved"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {reembolso.status === "pending"
                            ? "Pendente"
                            : reembolso.status === "approved"
                              ? "Aprovado"
                              : "Recusado"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
