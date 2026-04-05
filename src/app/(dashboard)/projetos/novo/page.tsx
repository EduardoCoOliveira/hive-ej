"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";

type ProjectStatus = "prospecting" | "proposal" | "negotiation" | "active";

const STATUS_OPTIONS = [
  { value: "prospecting",  label: "Prospecção",  desc: "Oportunidade identificada" },
  { value: "proposal",     label: "Proposta",    desc: "Elaborando proposta técnica" },
  { value: "negotiation",  label: "Negociação",  desc: "Em negociação com o cliente" },
  { value: "active",       label: "Ativo",       desc: "Contrato assinado, em execução" },
] as const;

const SKILL_OPTIONS = [
  "Desenvolvimento Web", "Desenvolvimento Mobile", "UI/UX Design",
  "Análise de Dados", "Machine Learning", "DevOps / Infra",
  "Gestão de Projetos", "Marketing Digital", "Consultoria Financeira",
  "Consultoria de RH", "Consultoria Estratégica", "Vendas",
];

const INTEGRATION_OPTIONS = [
  { key: "googleDrive",    label: "Google Drive",    icon: "📁", desc: "Cria pasta e subpastas do projeto" },
  { key: "googleDocs",     label: "Google Docs",     icon: "📄", desc: "Gera documento de escopo" },
  { key: "googleCalendar", label: "Google Calendar", icon: "📅", desc: "Agendamento de kickoff e reuniões" },
  { key: "discord",        label: "Discord",         icon: "💬", desc: "Cria canal #proj-{nome}" },
  { key: "clickup",        label: "ClickUp",         icon: "🟣", desc: "Cria lista com 4 tarefas iniciais" },
  { key: "notion",         label: "Notion",          icon: "📝", desc: "Cria página com database de tarefas" },
  { key: "miro",           label: "Miro",            icon: "🗺️", desc: "Cria Project Canvas (Premium)" },
] as const;

type IntegrationKey = typeof INTEGRATION_OPTIONS[number]["key"];

interface EnabledIntegrations extends Record<IntegrationKey, boolean> {}

const DEFAULT_INTEGRATIONS: EnabledIntegrations = {
  googleDrive: true, googleDocs: true, googleCalendar: true,
  discord: true, clickup: true, notion: true, miro: false,
};

const STEPS = ["Dados do Projeto", "Escopo & Skills", "Automações"] as const;

export default function NovoProjetoPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientContext, setClientContext] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("prospecting");
  const [value, setValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("");
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [estimatedHours, setEstimatedHours] = useState("40");
  const [enabledIntegrations, setEnabledIntegrations] = useState<EnabledIntegrations>(DEFAULT_INTEGRATIONS);
  const [autoAllocate, setAutoAllocate] = useState(false);
  const [scheduleKickoff, setScheduleKickoff] = useState(false);

  function toggleSkill(s: string) {
    setRequiredSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function toggleIntegration(key: IntegrationKey) {
    setEnabledIntegrations((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!name.trim()) return "Nome do projeto é obrigatório";
      if (!clientName.trim()) return "Nome do cliente é obrigatório";
      if (!value || isNaN(parseFloat(value.replace(",", "."))) || parseFloat(value.replace(",", ".")) <= 0)
        return "Valor do projeto deve ser um número positivo";
    }
    return null;
  }

  function nextStep() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(s + 1, 2));
  }

  const enabledCount = Object.values(enabledIntegrations).filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/atomic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim() || undefined,
          clientContext: clientContext.trim() || undefined,
          status,
          value: parseFloat(value.replace(/\./g, "").replace(",", ".")),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          description: description.trim() || undefined,
          scope: scope.trim() || undefined,
          requiredSkills,
          estimatedHours: parseInt(estimatedHours) || undefined,
          enabledIntegrations,
          autoAllocate,
          scheduleKickoff,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar projeto");
      router.push(`/projetos/${data.projectId}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Novo Projeto"
        subtitle="Iniciação Atômica — um formulário que conecta tudo"
        userName="" userEmail="" planTier="premium"
        actions={
          <Link href="/projetos"
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors">
            ← Voltar
          </Link>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i < step ? "text-white" : i === step ? "text-white" : "bg-muted text-muted-foreground"
                    }`}
                    style={i <= step ? { background: "linear-gradient(135deg, #09254D, #4E378C)" } : {}}
                  >
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">

              {/* ── STEP 0: Dados do Projeto ── */}
              {step === 0 && (
                <>
                  <h2 className="text-sm font-semibold text-foreground">Dados do Projeto</h2>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Nome do projeto <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Consultoria Estratégica — ACME Corp"
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-colors" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Cliente <span className="text-red-500">*</span>
                      </label>
                      <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                        placeholder="Empresa ou pessoa"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">E-mail do cliente</label>
                      <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="contato@empresa.com"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-colors" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Contexto do cliente
                      <span className="ml-1 text-xs font-normal text-muted-foreground">(usado pelo GPT-4o para personalizar Playbooks)</span>
                    </label>
                    <textarea value={clientContext} onChange={(e) => setClientContext(e.target.value)}
                      placeholder="Descreva o cliente: setor, porte, desafios, histórico, tom de comunicação preferido..."
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-colors resize-none" />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Status inicial</label>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUS_OPTIONS.map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setStatus(opt.value as ProjectStatus)}
                          className={`text-left p-3 rounded-xl border-2 transition-all ${
                            status === opt.value ? "border-brand-teal bg-brand-teal/5" : "border-border hover:border-border/60"
                          }`}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {status === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />}
                            <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-tight">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Value + hours */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Valor (R$) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                        <input type="text" value={value}
                          onChange={(e) => setValue(e.target.value.replace(/[^0-9.,]/g, ""))}
                          placeholder="5.000,00"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-colors" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Horas estimadas</label>
                      <input type="number" min="1" value={estimatedHours}
                        onChange={(e) => setEstimatedHours(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-colors" />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Data de início</label>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Data de entrega</label>
                      <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-colors" />
                    </div>
                  </div>
                </>
              )}

              {/* ── STEP 1: Escopo & Skills ── */}
              {step === 1 && (
                <>
                  <h2 className="text-sm font-semibold text-foreground">Escopo & Competências</h2>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Descrição</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="Objetivo e contexto do projeto..." rows={3}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 resize-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Escopo / Entregáveis</label>
                    <textarea value={scope} onChange={(e) => setScope(e.target.value)}
                      placeholder="O que está incluído e excluído do escopo..." rows={3}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 resize-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Competências necessárias
                      <span className="ml-1 text-xs font-normal text-muted-foreground">(usadas no Smart Match)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SKILL_OPTIONS.map((skill) => (
                        <button key={skill} type="button" onClick={() => toggleSkill(skill)}
                          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                            requiredSkills.includes(skill)
                              ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                              : "border-border text-muted-foreground hover:border-brand-teal/40"
                          }`}>
                          {requiredSkills.includes(skill) ? "✓ " : ""}{skill}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── STEP 2: Automações ── */}
              {step === 2 && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-semibold text-foreground">Iniciação Atômica</h2>
                    <span className="text-xs text-muted-foreground">{enabledCount} de {INTEGRATION_OPTIONS.length} ativadas</span>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-3">
                    Ao confirmar, estas ferramentas serão configuradas automaticamente para o projeto.
                  </p>

                  <div className="space-y-2">
                    {INTEGRATION_OPTIONS.map(({ key, label, icon, desc }) => {
                      const enabled = enabledIntegrations[key];
                      return (
                        <button
                          key={key} type="button" onClick={() => toggleIntegration(key)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                            enabled ? "border-brand-teal bg-brand-teal/5" : "border-border hover:border-border/60"
                          }`}
                        >
                          <span className="text-xl flex-shrink-0">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{label}</p>
                            <p className="text-xs text-muted-foreground">{desc}</p>
                          </div>
                          <div className={`w-9 h-5 rounded-full transition-all flex-shrink-0 relative ${
                            enabled ? "bg-brand-teal" : "bg-muted"
                          }`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                              enabled ? "left-4" : "left-0.5"
                            }`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Smart Match + Kickoff */}
                  <div className="pt-1 space-y-3">
                    <div className="p-3 rounded-xl border border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">✨ Smart Match automático</p>
                          <p className="text-xs text-muted-foreground">Sugerir o melhor time ao criar o projeto</p>
                        </div>
                        <button type="button" onClick={() => setAutoAllocate((v) => !v)}
                          className={`w-9 h-5 rounded-full transition-all relative flex-shrink-0 ${autoAllocate ? "bg-brand-teal" : "bg-muted"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${autoAllocate ? "left-4" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>

                    <div className={`p-3 rounded-xl border transition-all ${
                      enabledIntegrations.googleCalendar ? "border-border" : "border-border opacity-40"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">📅 Agendar kickoff</p>
                          <p className="text-xs text-muted-foreground">Encontrar melhor horário e criar evento no Calendar</p>
                        </div>
                        <button type="button"
                          disabled={!enabledIntegrations.googleCalendar}
                          onClick={() => setScheduleKickoff((v) => !v)}
                          className={`w-9 h-5 rounded-full transition-all relative flex-shrink-0 ${scheduleKickoff && enabledIntegrations.googleCalendar ? "bg-brand-teal" : "bg-muted"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${scheduleKickoff && enabledIntegrations.googleCalendar ? "left-4" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary card */}
                  <div className="p-4 rounded-xl bg-muted/50 border border-border text-xs">
                    <p className="font-semibold text-foreground mb-2 uppercase tracking-wide">Resumo</p>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        ["Projeto", name || "—"],
                        ["Cliente", clientName || "—"],
                        ["Valor", value ? `R$ ${value}` : "—"],
                        ["Skills", requiredSkills.length > 0 ? `${requiredSkills.length} selecionadas` : "Nenhuma"],
                        ["Integrações", `${enabledCount} ativas`],
                        ["Smart Match", autoAllocate ? "✓ Ativado" : "Desativado"],
                      ].map(([k, v]) => (
                        <><span key={k + "k"} className="text-muted-foreground">{k}:</span>
                        <span key={k + "v"} className="font-medium text-foreground truncate">{v}</span></>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                  <span>⚠️</span><span>{error}</span>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                {step > 0 ? (
                  <button type="button" onClick={() => setStep((s) => s - 1)}
                    className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    ← Voltar
                  </button>
                ) : <div />}

                {step < 2 ? (
                  <button type="button" onClick={nextStep}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
                    style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}>
                    Próximo →
                  </button>
                ) : (
                  <button type="submit" disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-all"
                    style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}>
                    {loading ? (
                      <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Iniciando...</>
                    ) : "🚀 Criar & Disparar Automações"}
                  </button>
                )}
              </div>
            </div>
          </form>

          {step === 2 && (
            <div className="mt-4 p-4 rounded-xl border border-brand-teal/20 bg-brand-teal/5">
              <p className="text-xs text-foreground">
                <span className="font-semibold">🐝 Mesh Thinking:</span> O projeto será criado instantaneamente no banco de dados.
                As {enabledCount} automações rodam em paralelo em segundo plano — você não precisa esperar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
