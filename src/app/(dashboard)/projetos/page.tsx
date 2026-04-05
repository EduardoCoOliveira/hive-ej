"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";

type ProjectStatus = "prospecting" | "proposal" | "negotiation" | "active" | "completed" | "cancelled";

interface Project {
  id: string;
  name: string;
  client_name: string;
  status: ProjectStatus;
  value: number;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
  allocations?: { user: { full_name: string; avatar_url: string | null } }[];
}

const STATUS_COLS: { key: ProjectStatus; label: string; color: string; bg: string }[] = [
  { key: "prospecting",  label: "Prospecção",  color: "#6B7280", bg: "#F9FAFB" },
  { key: "proposal",     label: "Proposta",    color: "#2563EB", bg: "#EFF6FF" },
  { key: "negotiation",  label: "Negociação",  color: "#D97706", bg: "#FFFBEB" },
  { key: "active",       label: "Ativo",       color: "#0891b2", bg: "#ECFEFF" },
  { key: "completed",    label: "Concluído",   color: "#16A34A", bg: "#F0FDF4" },
];

const VIEW_OPTIONS = ["kanban", "lista"] as const;
type View = typeof VIEW_OPTIONS[number];

export default function ProjetosPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("kanban");
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "all">("all");
  const supabase = createClient();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select(`*, allocations:project_allocations(user:profiles(full_name, avatar_url))`)
      .order("updated_at", { ascending: false });
    setProjects(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const byStatus = (status: ProjectStatus) =>
    projects.filter((p) => p.status === status);

  const filtered =
    filterStatus === "all" ? projects : projects.filter((p) => p.status === filterStatus);

  const totalValue = projects
    .filter((p) => ["active", "completed"].includes(p.status))
    .reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Projetos"
        subtitle={`${projects.length} projetos · R$ ${totalValue.toLocaleString("pt-BR")} em execução`}
        userName=""
        userEmail=""
        planTier="premium"
        actions={
          <Link
            href="/projetos/novo"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
          >
            <span>+</span> Novo Projeto
          </Link>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card">
        {/* Toggle view */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          {VIEW_OPTIONS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "kanban" ? "⬛ Kanban" : "☰ Lista"}
            </button>
          ))}
        </div>

        {/* Filtro de status (apenas na lista) */}
        {view === "lista" && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ProjectStatus | "all")}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground"
          >
            <option value="all">Todos os status</option>
            {STATUS_COLS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {projects.length} projetos
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* ── KANBAN ── */}
          {view === "kanban" && (
            <div className="flex gap-4 p-6 h-full min-w-max">
              {STATUS_COLS.map((col) => {
                const colProjects = byStatus(col.key);
                return (
                  <div key={col.key} className="flex flex-col w-72 flex-shrink-0">
                    {/* Cabeçalho da coluna */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: col.color }}
                        />
                        <span className="text-sm font-semibold text-foreground">{col.label}</span>
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                          {colProjects.length}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {colProjects.length > 0
                          ? `R$ ${colProjects.reduce((s, p) => s + p.value, 0).toLocaleString("pt-BR")}`
                          : ""}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="flex flex-col gap-3 flex-1 overflow-y-auto pb-4">
                      {colProjects.map((project) => (
                        <KanbanCard key={project.id} project={project} />
                      ))}

                      {colProjects.length === 0 && (
                        <div
                          className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed text-xs text-muted-foreground"
                          style={{ borderColor: col.color + "40" }}
                        >
                          Sem projetos
                        </div>
                      )}

                      {col.key === "prospecting" && (
                        <Link
                          href="/projetos/novo"
                          className="flex items-center justify-center gap-1 py-2 rounded-xl border-2 border-dashed border-border text-xs text-muted-foreground hover:border-brand-teal hover:text-brand-teal transition-colors"
                        >
                          + Novo projeto
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── LISTA ── */}
          {view === "lista" && (
            <div className="p-6">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Projeto</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Cliente</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Valor</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Equipe</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Atualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((project, i) => {
                      const col = STATUS_COLS.find((c) => c.key === project.status);
                      return (
                        <tr
                          key={project.id}
                          className={`border-b border-border last:border-0 hover:bg-muted/50 transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/projetos/${project.id}`}
                              className="font-medium text-sm text-foreground hover:text-brand-teal transition-colors"
                            >
                              {project.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{project.client_name}</td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: col?.bg, color: col?.color }}
                            >
                              {col?.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">
                            R$ {project.value.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3">
                            <AvatarStack allocations={project.allocations ?? []} />
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(project.updated_at).toLocaleDateString("pt-BR")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <span className="text-4xl mb-2">📁</span>
                    <p className="text-muted-foreground font-medium">Nenhum projeto encontrado</p>
                    <Link href="/projetos/novo" className="mt-3 text-sm text-brand-teal hover:underline">
                      Criar primeiro projeto →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Card do Kanban ────────────────────────────────────────────
function KanbanCard({ project }: { project: Project }) {
  const col = STATUS_COLS.find((c) => c.key === project.status);
  return (
    <Link
      href={`/projetos/${project.id}`}
      className="block bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-brand-teal/40 transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-foreground group-hover:text-brand-teal transition-colors leading-tight">
          {project.name}
        </p>
        <span className="text-xs font-bold text-foreground ml-2 flex-shrink-0">
          R$ {(project.value / 1000).toFixed(0)}k
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{project.client_name}</p>

      <div className="flex items-center justify-between">
        <AvatarStack allocations={project.allocations ?? []} />
        {project.end_date && (
          <span className="text-xs text-muted-foreground">
            até {new Date(project.end_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Stack de avatares da equipe ───────────────────────────────
function AvatarStack({ allocations }: { allocations: { user: { full_name: string; avatar_url: string | null } }[] }) {
  const shown = allocations.slice(0, 3);
  const extra = allocations.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((a, i) => (
        <div
          key={i}
          title={a.user.full_name}
          className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #09254D, #4E378C)", zIndex: shown.length - i }}
        >
          {a.user.avatar_url ? (
            <img src={a.user.avatar_url} alt={a.user.full_name} className="w-full h-full rounded-full object-cover" />
          ) : (
            a.user.full_name.charAt(0)
          )}
        </div>
      ))}
      {extra > 0 && (
        <div className="w-6 h-6 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
          +{extra}
        </div>
      )}
    </div>
  );
}
