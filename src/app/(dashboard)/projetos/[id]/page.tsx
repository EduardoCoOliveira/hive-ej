"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";

type ProjectStatus = "prospecting" | "proposal" | "negotiation" | "active" | "completed" | "cancelled";

interface Member {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

interface Allocation {
  id: string;
  user_id: string;
  hours_per_week: number;
  role_in_project: string | null;
  user: Member;
}

interface Project {
  id: string;
  name: string;
  client_name: string;
  status: ProjectStatus;
  value: number;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  scope: string | null;
  required_skills: string[] | null;
  template_data: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  allocations?: Allocation[];
}

const STATUS_FLOW: { key: ProjectStatus; label: string; color: string; bg: string; next?: ProjectStatus }[] = [
  { key: "prospecting",  label: "Prospecção",  color: "#6B7280", bg: "#F9FAFB", next: "proposal" },
  { key: "proposal",     label: "Proposta",    color: "#2563EB", bg: "#EFF6FF", next: "negotiation" },
  { key: "negotiation",  label: "Negociação",  color: "#D97706", bg: "#FFFBEB", next: "active" },
  { key: "active",       label: "Ativo",       color: "#0891b2", bg: "#ECFEFF", next: "completed" },
  { key: "completed",    label: "Concluído",   color: "#16A34A", bg: "#F0FDF4" },
  { key: "cancelled",   label: "Cancelado",   color: "#DC2626", bg: "#FEF2F2" },
];

function statusMeta(status: ProjectStatus) {
  return STATUS_FLOW.find((s) => s.key === status) ?? STATUS_FLOW[0];
}

export default function ProjetoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justCreated = searchParams.get("created") === "1";
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "equipe" | "atas">("overview");
  const [successMsg, setSuccessMsg] = useState(justCreated ? "🎉 Projeto criado com sucesso! Automações disparadas." : null);

  // Allocation modal
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [allocForm, setAllocForm] = useState({ user_id: "", hours_per_week: "10", role_in_project: "" });
  const [allocLoading, setAllocLoading] = useState(false);

  // Meeting summary
  const [showSumModal, setShowSumModal] = useState(false);
  const [sumText, setSumText] = useState("");
  const [sumTitle, setSumTitle] = useState("");
  const [sumLoading, setSumLoading] = useState(false);
  const [summaries, setSummaries] = useState<{ title: string; content: string; date: string }[]>([]);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select(`
        *,
        allocations:project_allocations(
          id, user_id, hours_per_week, role_in_project,
          user:profiles(id, full_name, avatar_url, role)
        )
      `)
      .eq("id", id)
      .single();
    setProject(data ?? null);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  async function fetchMembers() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .eq("is_active", true)
      .order("full_name");
    setMembers(data ?? []);
  }

  async function advanceStatus() {
    if (!project) return;
    const meta = statusMeta(project.status);
    if (!meta.next) return;
    setStatusLoading(true);
    const { error } = await supabase
      .from("projects")
      .update({ status: meta.next })
      .eq("id", project.id);
    if (!error) {
      setProject((p) => p ? { ...p, status: meta.next! } : p);
      setSuccessMsg(`Status atualizado para ${statusMeta(meta.next!).label}`);
      // Fire automation
      await fetch(`/api/projetos/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: meta.next }),
      }).catch(() => {});
    }
    setStatusLoading(false);
  }

  async function addAllocation() {
    if (!allocForm.user_id || !project) return;
    setAllocLoading(true);
    await supabase.from("project_allocations").insert({
      project_id: project.id,
      user_id: allocForm.user_id,
      hours_per_week: parseInt(allocForm.hours_per_week),
      role_in_project: allocForm.role_in_project || null,
    });
    setShowAllocModal(false);
    setAllocForm({ user_id: "", hours_per_week: "10", role_in_project: "" });
    fetchProject();
    setAllocLoading(false);
  }

  async function removeAllocation(allocId: string) {
    await supabase.from("project_allocations").delete().eq("id", allocId);
    fetchProject();
  }

  async function handleSummarize() {
    if (!sumText.trim()) return;
    setSumLoading(true);
    try {
      const res = await fetch("/api/integracoes/openai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: sumText,
          projectId: id,
          meetingTitle: sumTitle || "Reunião",
          saveToNotion: true,
        }),
      });
      const data = await res.json();
      if (data.summary) {
        setSummaries((prev) => [
          { title: sumTitle || "Reunião", content: data.summary, date: new Date().toLocaleDateString("pt-BR") },
          ...prev,
        ]);
        setSumText("");
        setSumTitle("");
        setShowSumModal(false);
        setSuccessMsg(data.savedToNotion ? "Ata sumarizada e salva no Notion ✓" : "Ata sumarizada ✓");
      }
    } catch {
      // ignore
    }
    setSumLoading(false);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 h-full">
        <span className="text-4xl">📁</span>
        <p className="text-muted-foreground font-medium">Projeto não encontrado</p>
        <Link href="/projetos" className="text-sm text-brand-teal hover:underline">← Voltar para Projetos</Link>
      </div>
    );
  }

  const meta = statusMeta(project.status);
  const nextMeta = meta.next ? statusMeta(meta.next) : null;
  const progressSteps = STATUS_FLOW.filter((s) => s.key !== "cancelled");
  const currentStepIdx = progressSteps.findIndex((s) => s.key === project.status);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={project.name}
        subtitle={`${project.client_name} · Atualizado ${new Date(project.updated_at).toLocaleDateString("pt-BR")}`}
        userName=""
        userEmail=""
        planTier="premium"
        actions={
          <Link
            href="/projetos"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors"
          >
            ← Projetos
          </Link>
        }
      />

      {/* Success toast */}
      {successMsg && (
        <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 text-sm font-medium animate-fade-in">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {/* Top summary bar */}
        <div className="px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-3 py-1 rounded-full font-semibold"
                style={{ background: meta.bg, color: meta.color }}
              >
                {meta.label}
              </span>
            </div>

            {/* Value */}
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="text-sm font-bold text-foreground">R$ {project.value.toLocaleString("pt-BR")}</p>
            </div>

            {/* Dates */}
            {project.start_date && (
              <div>
                <p className="text-xs text-muted-foreground">Início</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(project.start_date).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}
            {project.end_date && (
              <div>
                <p className="text-xs text-muted-foreground">Entrega</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(project.end_date).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}

            {/* Team count */}
            <div>
              <p className="text-xs text-muted-foreground">Equipe</p>
              <p className="text-sm font-medium text-foreground">
                {project.allocations?.length ?? 0} membro{(project.allocations?.length ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Advance status button */}
            {nextMeta && project.status !== "completed" && project.status !== "cancelled" && (
              <div className="ml-auto">
                <button
                  onClick={advanceStatus}
                  disabled={statusLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
                >
                  {statusLoading ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>→ Avançar para {nextMeta.label}</>
                  )}
                </button>
              </div>
            )}

            {project.status === "completed" && (
              <span className="ml-auto text-xs font-semibold text-green-600 flex items-center gap-1">
                🎉 Projeto Concluído
              </span>
            )}
          </div>

          {/* Progress bar */}
          {project.status !== "cancelled" && (
            <div className="mt-4 flex items-center gap-1">
              {progressSteps.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1 flex-1">
                  <div
                    className="h-1.5 rounded-full flex-1 transition-all"
                    style={{
                      background: i <= currentStepIdx ? s.color : "#E5E7EB",
                    }}
                  />
                  {i < progressSteps.length - 1 && (
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: i < currentStepIdx ? "#41C5C6" : "#E5E7EB" }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 border-b border-border">
          {(["overview", "equipe", "atas"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-brand-teal text-brand-teal"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "overview" ? "Visão Geral" : tab === "equipe" ? "Equipe" : "Atas de Reunião"}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-3 gap-6">
              {/* Left: description + scope */}
              <div className="col-span-2 space-y-4">
                {/* Description */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Descrição</h3>
                  {project.description ? (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{project.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nenhuma descrição adicionada.</p>
                  )}
                </div>

                {/* Scope */}
                {project.scope && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Escopo / Entregáveis</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{project.scope}</p>
                  </div>
                )}

                {/* Required skills */}
                {project.required_skills && project.required_skills.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Competências Necessárias</h3>
                    <div className="flex flex-wrap gap-2">
                      {project.required_skills.map((skill) => (
                        <span
                          key={skill}
                          className="text-xs px-3 py-1 rounded-full border border-border bg-muted text-foreground font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* External links */}
                {project.template_data && Object.keys(project.template_data).length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Links Externos</h3>
                    <div className="flex flex-wrap gap-2">
                      {project.template_data.clickup_list_id && (
                        <a
                          href={`https://app.clickup.com/t/${project.template_data.clickup_list_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          <span>🟣</span> Abrir no ClickUp
                        </a>
                      )}
                      {project.template_data.notion_page_id && (
                        <a
                          href={`https://notion.so/${project.template_data.notion_page_id.replace(/-/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          <span>📝</span> Abrir no Notion
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: quick actions + info */}
              <div className="space-y-4">
                {/* Quick actions */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Ações Rápidas</h3>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        fetchMembers();
                        setShowAllocModal(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <span>👤</span> Alocar membro
                    </button>
                    <button
                      onClick={() => setShowSumModal(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <span>✨</span> Sumarizar ata com IA
                    </button>
                    <Link
                      href={`/documentos/novo?project=${project.id}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors"
                    >
                      <span>📄</span> Gerar documento
                    </Link>
                  </div>
                </div>

                {/* Project info */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Informações</h3>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: "Criado em", value: new Date(project.created_at).toLocaleDateString("pt-BR") },
                      { label: "Atualizado", value: new Date(project.updated_at).toLocaleDateString("pt-BR") },
                      { label: "Valor", value: `R$ ${project.value.toLocaleString("pt-BR")}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── EQUIPE TAB ── */}
          {activeTab === "equipe" && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {project.allocations?.length ?? 0} membro{(project.allocations?.length ?? 0) !== 1 ? "s" : ""} alocado{(project.allocations?.length ?? 0) !== 1 ? "s" : ""}
                </h3>
                <button
                  onClick={() => { fetchMembers(); setShowAllocModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
                >
                  + Alocar membro
                </button>
              </div>

              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {project.allocations && project.allocations.length > 0 ? (
                  project.allocations.map((alloc) => (
                    <div key={alloc.id} className="flex items-center gap-3 px-5 py-4 border-b border-border last:border-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
                      >
                        {alloc.user.avatar_url ? (
                          <img src={alloc.user.avatar_url} alt={alloc.user.full_name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          alloc.user.full_name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{alloc.user.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {alloc.role_in_project ?? alloc.user.role} · {alloc.hours_per_week}h/semana
                        </p>
                      </div>
                      <button
                        onClick={() => removeAllocation(alloc.id)}
                        className="text-xs text-muted-foreground hover:text-red-500 transition-colors p-1"
                        title="Remover alocação"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="text-3xl mb-2">👥</span>
                    <p className="text-sm text-muted-foreground">Nenhum membro alocado ainda</p>
                    <button
                      onClick={() => { fetchMembers(); setShowAllocModal(true); }}
                      className="mt-3 text-xs text-brand-teal hover:underline"
                    >
                      Alocar primeiro membro →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ATAS TAB ── */}
          {activeTab === "atas" && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">{summaries.length} ata{summaries.length !== 1 ? "s" : ""} registrada{summaries.length !== 1 ? "s" : ""}</h3>
                <button
                  onClick={() => setShowSumModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
                >
                  ✨ Nova ata com IA
                </button>
              </div>

              {summaries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-2xl text-center">
                  <span className="text-3xl mb-2">📝</span>
                  <p className="text-sm text-muted-foreground">Nenhuma ata registrada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cole o texto de uma reunião e a IA irá estruturá-la automaticamente
                  </p>
                  <button
                    onClick={() => setShowSumModal(true)}
                    className="mt-4 text-xs text-brand-teal hover:underline"
                  >
                    Sumarizar primeira ata →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {summaries.map((s, i) => (
                    <div key={i} className="bg-card border border-border rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                        <span className="text-xs text-muted-foreground">{s.date}</span>
                      </div>
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">
                        {s.content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── ALLOCATION MODAL ── */}
      {showAllocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-base font-semibold text-foreground mb-4">Alocar Membro</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Membro</label>
                <select
                  value={allocForm.user_id}
                  onChange={(e) => setAllocForm((f) => ({ ...f, user_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                >
                  <option value="">Selecionar membro...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Horas por semana</label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={allocForm.hours_per_week}
                  onChange={(e) => setAllocForm((f) => ({ ...f, hours_per_week: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Papel no projeto (opcional)</label>
                <input
                  type="text"
                  value={allocForm.role_in_project}
                  onChange={(e) => setAllocForm((f) => ({ ...f, role_in_project: e.target.value }))}
                  placeholder="Ex: Líder de projeto, Desenvolvedor Front, Designer..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAllocModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={addAllocation}
                disabled={!allocForm.user_id || allocLoading}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
              >
                {allocLoading ? "Alocando..." : "Alocar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUMMARIZE MODAL ── */}
      {showSumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">✨</span>
              <h2 className="text-base font-semibold text-foreground">Sumarizar Ata com IA</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Título da reunião</label>
                <input
                  type="text"
                  value={sumTitle}
                  onChange={(e) => setSumTitle(e.target.value)}
                  placeholder="Ex: Kickoff com cliente, Sprint Review..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Texto da ata <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={sumText}
                  onChange={(e) => setSumText(e.target.value)}
                  placeholder="Cole aqui o texto bruto da reunião. A IA irá estruturar automaticamente com participantes, decisões, próximos passos e responsáveis..."
                  rows={8}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">{sumText.length} / 50 caracteres mínimos</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowSumModal(false); setSumText(""); setSumTitle(""); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSummarize}
                disabled={sumText.length < 50 || sumLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
              >
                {sumLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Sumarizando...
                  </>
                ) : (
                  "✨ Sumarizar com GPT-4o"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
