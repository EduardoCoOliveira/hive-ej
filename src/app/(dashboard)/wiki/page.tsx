import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { BookMarked, Search, Plus, Lock } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wiki de Bastão" };

type WikiProfile = {
  full_name: string;
  avatar_url: string | null;
  organization_id: string;
};

type WikiOrg = {
  name: string;
  plan_tier: "free" | "premium" | "internal";
};

const STARTER_ARTICLES = [
  { icon: "🚀", title: "Como fazer um bom kickoff", category: "Projetos", locked: false },
  { icon: "📋", title: "Template de proposta comercial", category: "Vendas", locked: false },
  { icon: "🤝", title: "Processo de onboarding de clientes", category: "Projetos", locked: false },
  { icon: "💰", title: "Política de precificação", category: "Financeiro", locked: true },
  { icon: "📊", title: "Como estruturar relatórios", category: "Gestão", locked: false },
  { icon: "⚡", title: "Ferramentas que usamos", category: "Geral", locked: false },
];

export default async function WikiPage() {
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
  const profile = profileResult.data as WikiProfile | null;

  if (!profile) redirect("/register");

  const orgResult = await supabase
    .from("organizations")
    .select("name, plan_tier")
    .eq("id", profile.organization_id)
    .single();
  const org = orgResult.data as WikiOrg | null;

  const planTier = org?.plan_tier ?? "free";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Wiki de Bastão"
        subtitle="Conhecimento institucional da sua EJ"
        userName={profile.full_name}
        userEmail={user.email ?? ""}
        planTier={planTier}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar artigos..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-teal/50 text-sm"
              />
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
            >
              <Plus className="w-4 h-4" />
              Novo artigo
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Artigos sugeridos para começar
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {STARTER_ARTICLES.map((article, index) => (
                <div
                  key={index}
                  className={`relative bg-card border border-border rounded-2xl p-5 space-y-3 transition-colors ${
                    article.locked ? "opacity-60" : "hover:border-brand-teal/40 cursor-pointer"
                  }`}
                >
                  {article.locked && (
                    <div className="absolute top-3 right-3">
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="text-2xl">{article.icon}</div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{article.title}</p>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full mt-1 inline-block">
                      {article.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-4 p-5 rounded-2xl border border-brand-purple/20 bg-brand-purple/5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-purple/10">
              <BookMarked className="w-5 h-5 text-brand-purple" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Wiki em construção</p>
              <p className="text-xs text-muted-foreground mt-1">
                O Wiki de Bastão permite documentar processos, templates e conhecimento institucional da sua EJ.
                Em breve você poderá criar, editar e compartilhar artigos com seu time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
