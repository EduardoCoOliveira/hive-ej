import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { FileText, Sparkles, Plus, FileSignature, ScrollText, Briefcase } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documentos" };

type DocumentsProfile = {
  full_name: string;
  avatar_url: string | null;
  organization_id: string;
};

type DocumentsOrg = {
  name: string;
  plan_tier: "free" | "premium" | "internal";
};

const DOC_TEMPLATES = [
  {
    icon: <FileSignature className="w-5 h-5" />,
    title: "Contrato de Prestação de Serviços",
    desc: "Contrato padrão para projetos de consultoria",
    color: "#09254D",
  },
  {
    icon: <ScrollText className="w-5 h-5" />,
    title: "Proposta Comercial",
    desc: "Template de proposta com escopo e precificação",
    color: "#4E378C",
  },
  {
    icon: <Briefcase className="w-5 h-5" />,
    title: "Termo de Confidencialidade (NDA)",
    desc: "Proteção de informações sensíveis do cliente",
    color: "#0891B2",
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: "Relatório de Entrega",
    desc: "Documentação formal da entrega do projeto",
    color: "#16A34A",
  },
];

export default async function DocumentosPage() {
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
  const profile = profileResult.data as DocumentsProfile | null;

  if (!profile) redirect("/register");

  const orgResult = await supabase
    .from("organizations")
    .select("name, plan_tier")
    .eq("id", profile.organization_id)
    .single();
  const org = orgResult.data as DocumentsOrg | null;

  const planTier = org?.plan_tier ?? "free";
  const isPremium = planTier !== "free";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Documentos"
        subtitle="Geração automática de contratos e documentos"
        userName={profile.full_name}
        userEmail={user.email ?? ""}
        planTier={planTier}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
          {!isPremium && (
            <div className="relative overflow-hidden flex items-center justify-between p-5 rounded-2xl border border-brand-purple/25 bg-gradient-to-r from-brand-navy/5 via-brand-purple/5 to-brand-teal/5">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #4E378C, #09254D)" }}
                >
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Recurso Premium</p>
                  <p className="text-xs text-muted-foreground">
                    Geração de documentos está disponível no plano Premium — R$ 50/mês
                  </p>
                </div>
              </div>
              <a
                href="/configuracoes/upgrade"
                className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white ml-4"
                style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
              >
                Fazer upgrade
              </a>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Templates Disponíveis
              </p>
              {isPremium && (
                <button className="flex items-center gap-1.5 text-xs font-medium text-brand-teal hover:underline">
                  <Plus className="w-3.5 h-3.5" />
                  Novo documento
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOC_TEMPLATES.map((template, index) => (
                <div
                  key={index}
                  className={`relative bg-card border border-border rounded-2xl p-5 flex items-start gap-4 transition-colors ${
                    isPremium
                      ? "hover:border-brand-teal/40 cursor-pointer"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                    style={{ background: template.color }}
                  >
                    {template.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{template.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{template.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Documentos Gerados
            </p>
            <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground text-sm">Nenhum documento ainda</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {isPremium
                  ? "Selecione um template acima para gerar seu primeiro documento automaticamente."
                  : "Faça upgrade para o Premium para gerar contratos e documentos automaticamente."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
