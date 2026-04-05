"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import Link from "next/link";

interface ProjectHubItem {
  id: string;
  name: string;
  client_name: string;
  status: string;
  value: number;
  external_ids: {
    driveFolderId?: string;
    driveDocId?: string;
    discordChannelId?: string;
    clickupListId?: string;
    notionPageId?: string;
    miroBoardId?: string;
    calendarEventId?: string;
  } | null;
  enabled_integrations: {
    googleDrive?: boolean;
    discord?: boolean;
    clickup?: boolean;
    notion?: boolean;
    miro?: boolean;
    googleCalendar?: boolean;
  } | null;
  leader?: { full_name: string; avatar_url: string | null };
  allocations_count?: number;
  sentiment?: "positive" | "neutral" | "concerned" | "negative" | null;
}

interface Integration {
  id: string;
  name: string;
  icon: string;
  key: string;
  getLink: (ids: ProjectHubItem["external_ids"]) => string | null;
  getStatus: (project: ProjectHubItem) => "connected" | "missing" | "disabled";
}

const INTEGRATIONS: Integration[] = [
  {
    id: "drive",
    name: "Google Drive",
    icon: "📁",
    key: "googleDrive",
    getLink: (ids) => ids?.driveFolderId
      ? `https://drive.google.com/drive/folders/${ids.driveFolderId}`
      : null,
    getStatus: (p) =>
      !p.enabled_integrations?.googleDrive ? "disabled"
      : p.external_ids?.driveFolderId ? "connected"
      : "missing",
  },
  {
    id: "discord",
    name: "Discord",
    icon: "💬",
    key: "discord",
    getLink: (ids) => ids?.discordChannelId
      ? `https://discord.com/channels/@me/${ids.discordChannelId}`
      : null,
    getStatus: (p) =>
      !p.enabled_integrations?.discord ? "disabled"
      : p.external_ids?.discordChannelId ? "connected"
      : "missing",
  },
  {
    id: "clickup",
    name: "ClickUp",
    icon: "🟣",
    key: "clickup",
    getLink: (ids) => ids?.clickupListId
      ? `https://app.clickup.com/l/${ids.clickupListId}`
      : null,
    getStatus: (p) =>
      !p.enabled_integrations?.clickup ? "disabled"
      : p.external_ids?.clickupListId ? "connected"
      : "missing",
  },
  {
    id: "notion",
    name: "Notion",
    icon: "📝",
    key: "notion",
    getLink: (ids) => ids?.notionPageId
      ? `https://notion.so/${ids.notionPageId.replace(/-/g, "")}`
      : null,
    getStatus: (p) =>
      !p.enabled_integrations?.notion ? "disabled"
      : p.external_ids?.notionPageId ? "connected"
      : "missing",
  },
  {
    id: "miro",
    name: "Miro",
    icon: "🗺️",
    key: "miro",
    getLink: (ids) => ids?.miroBoardId
      ? `https://miro.com/app/board/${ids.miroBoardId}`
      : null,
    getStatus: (p) =>
      !p.enabled_integrations?.miro ? "disabled"
      : p.external_ids?.miroBoardId ? "connected"
      : "missing",
  },
];

const SENTIMENT_META = {
  positive:  { label: "Ótimo",        color: "#16A34A", bg: "#F0FDF4", icon: "😊" },
  neutral:   { label: "Neutro",       color: "#6B7280", bg: "#F9FAFB", icon: "😐" },
  concerned: { label: "Atenção",      color: "#D97706", bg: "#FFFBEB", icon: "😟" },
  negative:  { label: "Crítico",      color: "#DC2626", bg: "#FEF2F2", icon: "🚨" },
};

const STATUS_COLORS: Record<string, string> = {
  prospecting: "#6B7280",
  proposal:    "#2563EB",
  negotiation: "#D97706",
  active:      "#0891B2",
  completed:   "#16A34A",
  cancelled:   "#DC2626",
};

const STATUS_LABELS: Record<string, string> = {
  prospecting: "Prospecção",
  proposal:    "Proposta",
  negotiation: "Negociação",
  active:      "Ativo",
  completed:   "Concluído",
  cancelled:   "Cancelado",
};

export default function ProjectHubPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<ProjectHubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProjectHubItem | null>(null);
  const [filter, setFilter] = useState<string>("active");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("projects")
        .select(`
          id, name, client_name, status, value, external_ids, enabled_integrations,
          leader:profiles!leader_id(full_name, avatar_url),
          allocations_count:project_allocations(count)
        `)
        .order("updated_at", { ascending: false });

      // Fetch latest sentiment for each project
      const projectsWithSentiment = await Promise.all(
        (data ?? []).map(async (p) => {
          const { data: sentiment } = await supabase
            .from("discord_sentiment_log")
            .select("sentiment")
            .eq("project_id", p.id)
            .order("analyzed_at", { ascending: false })
            .limit(1)
            .single();

          return {
            ...p,
            allocations_count: Array.isArray(p.allocations_count)
              ? p.allocations_count[0]?.count ?? 0
              : 0,
            sentiment: sentiment?.sentiment ?? null,
          };
        })
      );

      setProjects(projectsWithSentiment);
      if (projectsWithSentiment.length > 0) {
        setSelected(projectsWithSentiment.find((p) => p.status === "active") ?? projectsWithSentiment[0]);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filtered = filter === "all"
    ? projects
    : projects.filter((p) => p.status === filter);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Project Hub"
        subtitle="Status unificado de todos os projetos em tempo real"
        userName=""
        userEmail=""
        planTier="premium"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Project list sidebar */}
        <div className="w-80 border-r border-border bg-card flex flex-col overflow-hidden">
          {/* Filter */}
          <div className="p-3 border-b border-border">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
            >
              <option value="all">Todos os projetos</option>
              <option value="active">Ativos</option>
              <option value="negotiation">Em Negociação</option>
              <option value="proposal">Proposta</option>
              <option value="prospecting">Prospecção</option>
              <option value="completed">Concluídos</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <span className="text-3xl mb-2">📂</span>
                <p className="text-sm text-muted-foreground">Nenhum projeto encontrado</p>
                <Link href="/projetos/novo" className="mt-2 text-xs text-brand-teal hover:underline">
                  Criar novo projeto →
                </Link>
              </div>
            ) : (
              filtered.map((p) => {
                const statusColor = STATUS_COLORS[p.status] ?? "#6B7280";
                const connectedCount = INTEGRATIONS.filter((i) => i.getStatus(p) === "connected").length;
                const sentimentMeta = p.sentiment ? SENTIMENT_META[p.sentiment] : null;

                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={`w-full text-left p-4 border-b border-border transition-colors ${
                      selected?.id === p.id
                        ? "bg-brand-teal/5 border-l-2 border-l-brand-teal"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: statusColor }}
                      />
                      <span className="text-sm font-semibold text-foreground truncate flex-1">{p.name}</span>
                      {sentimentMeta && (
                        <span className="text-sm" title={`Sentimento: ${sentimentMeta.label}`}>
                          {sentimentMeta.icon}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{p.client_name}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {INTEGRATIONS.map((integ) => {
                          const status = integ.getStatus(p);
                          return (
                            <span
                              key={integ.id}
                              className="text-[11px]"
                              style={{ opacity: status === "connected" ? 1 : status === "missing" ? 0.3 : 0.15 }}
                              title={`${integ.name}: ${status}`}
                            >
                              {integ.icon}
                            </span>
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {connectedCount}/{INTEGRATIONS.filter((i) => i.getStatus(p) !== "disabled").length} conectados
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Project detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-5xl mb-4">⚡</span>
              <h2 className="text-xl font-bold text-foreground mb-2">Project Hub</h2>
              <p className="text-muted-foreground max-w-sm text-sm">
                Selecione um projeto para ver o status de todas as suas integrações em um único lugar.
              </p>
            </div>
          ) : (
            <div className="max-w-4xl">
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-foreground">{selected.name}</h1>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={{
                        background: (STATUS_COLORS[selected.status] ?? "#6B7280") + "20",
                        color: STATUS_COLORS[selected.status] ?? "#6B7280",
                      }}
                    >
                      {STATUS_LABELS[selected.status] ?? selected.status}
                    </span>
                    {selected.sentiment && (
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{
                          background: SENTIMENT_META[selected.sentiment].bg,
                          color: SENTIMENT_META[selected.sentiment].color,
                        }}
                      >
                        {SENTIMENT_META[selected.sentiment].icon} {SENTIMENT_META[selected.sentiment].label}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground">{selected.client_name} · R$ {selected.value?.toLocaleString("pt-BR")}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/projetos/${selected.id}`}
                    className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    Ver projeto →
                  </Link>
                  <Link
                    href={`/playbooks?project=${selected.id}`}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
                  >
                    📖 Playbook
                  </Link>
                </div>
              </div>

              {/* Integration widgets grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {INTEGRATIONS.map((integ) => {
                  const status = integ.getStatus(selected);
                  const link = integ.getLink(selected.external_ids);

                  return (
                    <IntegrationWidget
                      key={integ.id}
                      name={integ.name}
                      icon={integ.icon}
                      status={status}
                      link={link}
                    />
                  );
                })}

                {/* Calendar widget */}
                <IntegrationWidget
                  name="Google Calendar"
                  icon="📅"
                  status={selected.external_ids?.calendarEventId ? "connected" : selected.enabled_integrations?.googleCalendar ? "missing" : "disabled"}
                  link={selected.external_ids?.calendarEventId
                    ? `https://calendar.google.com/calendar/event?eid=${selected.external_ids.calendarEventId}`
                    : null}
                />
              </div>

              {/* Atomic initiation re-trigger */}
              {!selected.external_ids || Object.keys(selected.external_ids).length === 0 ? (
                <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl">
                  <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Automações não executadas</p>
                  <p className="text-xs text-amber-700 mb-3">
                    Este projeto não passou pela Iniciação Atômica. As integrações com Drive, Discord, ClickUp e Notion não foram configuradas automaticamente.
                  </p>
                  <button
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
                    onClick={async () => {
                      await fetch("/api/atomic/retrigger", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ projectId: selected.id }),
                      });
                    }}
                  >
                    🚀 Disparar Automações Agora
                  </button>
                </div>
              ) : null}

              {/* Quick actions */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-foreground mb-3">Ações Rápidas</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Sumarizar Ata",
                      icon: "✨",
                      href: `/projetos/${selected.id}?tab=atas`,
                      desc: "GPT-4o → Notion",
                    },
                    {
                      label: "Análise de Sentimento",
                      icon: "🔍",
                      href: `/projetos/${selected.id}?action=sentiment`,
                      desc: "Analisar Discord agora",
                    },
                    {
                      label: "Backup de Inteligência",
                      icon: "🗄️",
                      href: `/projetos/${selected.id}?action=backup`,
                      desc: "Pausar com contexto salvo",
                    },
                  ].map((action) => (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="flex flex-col gap-1 p-3 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                    >
                      <span className="text-lg">{action.icon}</span>
                      <span className="text-xs font-semibold text-foreground">{action.label}</span>
                      <span className="text-[10px] text-muted-foreground">{action.desc}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IntegrationWidget({
  name,
  icon,
  status,
  link,
}: {
  name: string;
  icon: string;
  status: "connected" | "missing" | "disabled";
  link: string | null;
}) {
  const statusMeta = {
    connected: { label: "Conectado",    color: "#16A34A", bg: "#F0FDF4", dot: "#22C55E" },
    missing:   { label: "Não criado",   color: "#D97706", bg: "#FFFBEB", dot: "#F59E0B" },
    disabled:  { label: "Desativado",   color: "#9CA3AF", bg: "#F9FAFB", dot: "#D1D5DB" },
  }[status];

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
        status === "connected" ? "border-green-200" : "border-border"
      }`}
      style={{ background: statusMeta.bg }}
    >
      <span className="text-2xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.dot }} />
          <span className="text-xs" style={{ color: statusMeta.color }}>{statusMeta.label}</span>
        </div>
      </div>
      {link && status === "connected" && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-black/5"
        >
          Abrir →
        </a>
      )}
    </div>
  );
}
