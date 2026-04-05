"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import Link from "next/link";

type PlaybookStep =
  | "pre_kickoff"
  | "kickoff"
  | "scope_presentation"
  | "weekly_meeting"
  | "final_delivery"
  | "post_project";

interface PlaybookRecord {
  id: string;
  project_id: string;
  step: PlaybookStep;
  title: string;
  content: {
    objective: string;
    preparation: string[];
    script: string;
    keyQuestions: string[];
    watchOutFor: string[];
    nextActions: string[];
    estimatedDuration: string;
    tips: string[];
  };
  created_at: string;
  projects?: { name: string; client_name: string };
}

const STEP_META: Record<PlaybookStep, { label: string; icon: string; color: string; desc: string }> = {
  pre_kickoff:        { label: "Pré-Kickoff",         icon: "🗺️", color: "#09254D", desc: "Preparação antes da primeira reunião" },
  kickoff:            { label: "Kickoff",              icon: "🚀", color: "#4E378C", desc: "Condução do início do projeto" },
  scope_presentation: { label: "Apresentar Escopo",    icon: "📋", color: "#2563EB", desc: "Como validar o escopo com o cliente" },
  weekly_meeting:     { label: "Reunião Semanal",      icon: "📅", color: "#0891B2", desc: "Template de reunião de acompanhamento" },
  final_delivery:     { label: "Entrega Final",        icon: "🎁", color: "#16A34A", desc: "Checklist e apresentação da entrega" },
  post_project:       { label: "Pós-Projeto",          icon: "💌", color: "#D97706", desc: "Follow-up e nutrição do relacionamento" },
};

const STEP_ORDER: PlaybookStep[] = [
  "pre_kickoff", "kickoff", "scope_presentation",
  "weekly_meeting", "final_delivery", "post_project",
];

export default function PlaybooksPage() {
  const supabase = createClient();
  const [playbooks, setPlaybooks] = useState<PlaybookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PlaybookRecord | null>(null);
  const [filter, setFilter] = useState<PlaybookStep | "all">("all");
  const [generating, setGenerating] = useState(false);
  const [genModal, setGenModal] = useState(false);
  const [genForm, setGenForm] = useState({ projectId: "", step: "pre_kickoff" as PlaybookStep });
  const [projects, setProjects] = useState<{ id: string; name: string; client_name: string }[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: pb }, { data: proj }] = await Promise.all([
        supabase
          .from("playbooks")
          .select("*, projects(name, client_name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("projects")
          .select("id, name, client_name")
          .in("status", ["prospecting", "proposal", "negotiation", "active"])
          .order("name"),
      ]);
      setPlaybooks(pb ?? []);
      setProjects(proj ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function generatePlaybook() {
    if (!genForm.projectId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/playbooks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: genForm.projectId, step: genForm.step }),
      });
      const data = await res.json();
      if (data.id) {
        const { data: pb } = await supabase
          .from("playbooks")
          .select("*, projects(name, client_name)")
          .eq("id", data.id)
          .single();
        if (pb) {
          setPlaybooks((prev) => [pb, ...prev]);
          setSelected(pb);
        }
      }
    } finally {
      setGenerating(false);
      setGenModal(false);
    }
  }

  const filtered = playbooks.filter((pb) => filter === "all" || pb.step === filter);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Playbooks de Liderança"
        subtitle="Guias personalizados por GPT-4o para cada etapa do projeto"
        userName=""
        userEmail=""
        planTier="premium"
        actions={
          <button
            onClick={() => setGenModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
          >
            ✨ Gerar Playbook
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-72 border-r border-border bg-card flex flex-col overflow-hidden">
          {/* Filter by step */}
          <div className="p-3 border-b border-border">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as PlaybookStep | "all")}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
            >
              <option value="all">Todos os playbooks</option>
              {STEP_ORDER.map((step) => (
                <option key={step} value={step}>
                  {STEP_META[step].icon} {STEP_META[step].label}
                </option>
              ))}
            </select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <span className="text-3xl mb-2">📖</span>
                <p className="text-sm text-muted-foreground">Nenhum playbook encontrado</p>
                <button
                  onClick={() => setGenModal(true)}
                  className="mt-3 text-xs text-brand-teal hover:underline"
                >
                  Gerar primeiro playbook →
                </button>
              </div>
            ) : (
              filtered.map((pb) => {
                const meta = STEP_META[pb.step];
                return (
                  <button
                    key={pb.id}
                    onClick={() => setSelected(pb)}
                    className={`w-full text-left p-4 border-b border-border transition-colors ${
                      selected?.id === pb.id ? "bg-brand-teal/5 border-l-2 border-l-brand-teal" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{meta.icon}</span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: meta.color + "20", color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{pb.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {pb.projects?.name ?? "Projeto"} · {pb.projects?.client_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(pb.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selected ? (
            <PlaybookView playbook={selected} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-5xl mb-4">🐝</span>
              <h2 className="text-xl font-bold text-foreground mb-2">Playbooks de Liderança</h2>
              <p className="text-muted-foreground max-w-sm text-sm">
                Guias práticos e personalizados para cada etapa do projeto, gerados pelo GPT-4o
                com base no contexto real do seu cliente e equipe.
              </p>

              {/* Step map */}
              <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg">
                {STEP_ORDER.map((step, i) => {
                  const meta = STEP_META[step];
                  return (
                    <div key={step} className="p-3 bg-card border border-border rounded-xl text-center">
                      <span className="text-2xl">{meta.icon}</span>
                      <p className="text-xs font-semibold text-foreground mt-1">{meta.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{meta.desc}</p>
                      {i < STEP_ORDER.length - 1 && (
                        <div className="hidden" />
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setGenModal(true)}
                className="mt-8 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
              >
                ✨ Gerar meu primeiro Playbook
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Generate Modal */}
      {genModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-base font-semibold text-foreground mb-4">Gerar Playbook com GPT-4o</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Projeto</label>
                <select
                  value={genForm.projectId}
                  onChange={(e) => setGenForm((f) => ({ ...f, projectId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                >
                  <option value="">Selecionar projeto...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.client_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Etapa</label>
                <div className="grid grid-cols-2 gap-2">
                  {STEP_ORDER.map((step) => {
                    const meta = STEP_META[step];
                    return (
                      <button
                        key={step}
                        onClick={() => setGenForm((f) => ({ ...f, step }))}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-all ${
                          genForm.step === step
                            ? "border-brand-teal bg-brand-teal/5"
                            : "border-border hover:border-border/80"
                        }`}
                      >
                        <span className="text-lg">{meta.icon}</span>
                        <span className="font-medium text-foreground leading-tight">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setGenModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={generatePlaybook}
                disabled={!genForm.projectId || generating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
              >
                {generating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Gerando...
                  </>
                ) : "✨ Gerar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaybookView({ playbook }: { playbook: PlaybookRecord }) {
  const meta = STEP_META[playbook.step];
  const c = playbook.content;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: meta.color + "15" }}
        >
          {meta.icon}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: meta.color + "20", color: meta.color }}>
              {meta.label}
            </span>
            <span className="text-xs text-muted-foreground">{c.estimatedDuration}</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">{playbook.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{c.objective}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Preparation */}
        <Section title="📋 Preparação" color={meta.color}>
          <ul className="space-y-1.5">
            {c.preparation?.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-brand-teal mt-0.5 flex-shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        {/* Script */}
        <Section title="🎤 Roteiro" color={meta.color}>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{c.script}</p>
        </Section>

        {/* Key Questions */}
        <Section title="❓ Perguntas-Chave" color={meta.color}>
          <ul className="space-y-1.5">
            {c.keyQuestions?.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-[#4E378C] mt-0.5 flex-shrink-0">→</span>
                {q}
              </li>
            ))}
          </ul>
        </Section>

        {/* Watch out */}
        <Section title="⚠️ Fique Atento" color="#D97706">
          <ul className="space-y-1.5">
            {c.watchOutFor?.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">!</span>
                {w}
              </li>
            ))}
          </ul>
        </Section>

        {/* Next actions */}
        <Section title="➡️ Próximas Ações" color="#16A34A">
          <ol className="space-y-1.5">
            {c.nextActions?.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-green-600 font-bold mt-0.5 flex-shrink-0 w-4">{i + 1}.</span>
                {a}
              </li>
            ))}
          </ol>
        </Section>

        {/* Tips */}
        {c.tips?.length > 0 && (
          <div className="p-4 rounded-xl border border-brand-teal/20 bg-brand-teal/5">
            <p className="text-xs font-semibold text-brand-teal uppercase tracking-wide mb-3">💡 Dicas do GPT-4o</p>
            <ul className="space-y-1.5">
              {c.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-brand-teal mt-0.5 flex-shrink-0">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3
        className="text-sm font-semibold mb-3"
        style={{ color }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
