"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  connectedAt?: string;
  connectedBy?: string;
  scopes?: string[];
  expiresAt?: string;
  workspaceName?: string;
}

type ProviderKey =
  | "google_workspace"
  | "discord"
  | "clickup"
  | "notion"
  | "miro"
  | "whatsapp"
  | "github"
  | "portal_bj";

// ─── Provider Metadata ──────────────────────────────────────────────────────

const PROVIDERS: Array<{
  key: ProviderKey;
  name: string;
  description: string;
  logo: string;
  color: string;
  accentColor: string;
  features: string[];
  comingSoon?: boolean;
  plan?: "free" | "growth" | "enterprise";
}> = [
  {
    key: "google_workspace",
    name: "Google Workspace",
    description:
      "Drive para pastas de projeto, Docs para escopos e contratos, Calendar para kickoffs automáticos.",
    logo: "G",
    color: "#4285F4",
    accentColor: "rgba(66,133,244,0.1)",
    features: ["Google Drive", "Google Docs", "Google Calendar", "Google Meet"],
    plan: "free",
  },
  {
    key: "discord",
    name: "Discord",
    description:
      "Canais automáticos por projeto, análise de sentimento e alertas diretos ao líder.",
    logo: "D",
    color: "#5865F2",
    accentColor: "rgba(88,101,242,0.1)",
    features: ["Canais por projeto", "Análise de sentimento", "DMs automáticos", "Bot Hïve"],
    plan: "free",
  },
  {
    key: "clickup",
    name: "ClickUp",
    description:
      "Listas de tarefas automáticas, ranking por categoria, webhooks de conclusão.",
    logo: "C",
    color: "#7B68EE",
    accentColor: "rgba(123,104,238,0.1)",
    features: ["Listas automáticas", "Expert Ranking", "Webhooks", "Histórico de tasks"],
    plan: "free",
  },
  {
    key: "notion",
    name: "Notion",
    description:
      "Páginas de projeto, wiki da EJ, decisões documentadas e Intelligence Backup.",
    logo: "N",
    color: "#000000",
    accentColor: "rgba(0,0,0,0.06)",
    features: ["Páginas de projeto", "Wiki da EJ", "Decisões", "Backup inteligente"],
    plan: "free",
  },
  {
    key: "miro",
    name: "Miro",
    description:
      "Boards visuais de projeto gerados automaticamente no kickoff.",
    logo: "M",
    color: "#FFD02F",
    accentColor: "rgba(255,208,47,0.1)",
    features: ["Boards automáticos", "Canvas de projeto", "Templates EJ"],
    comingSoon: true,
    plan: "growth",
  },
  {
    key: "github",
    name: "GitHub",
    description:
      "Repositórios por projeto, rastreamento de commits e automações de deploy.",
    logo: "GH",
    color: "#24292e",
    accentColor: "rgba(36,41,46,0.06)",
    features: ["Repos automáticos", "Rastreamento de commits", "Deploy hooks"],
    comingSoon: true,
    plan: "growth",
  },
  {
    key: "whatsapp",
    name: "WhatsApp Business",
    description:
      "Relatórios semanais automáticos e notificações críticas via WhatsApp.",
    logo: "W",
    color: "#25D366",
    accentColor: "rgba(37,211,102,0.1)",
    features: ["Relatórios semanais", "Alertas críticos", "Resumos de projeto"],
    comingSoon: true,
    plan: "enterprise",
  },
  {
    key: "portal_bj",
    name: "Portal BJ",
    description:
      "Sincronização com o Portal Brasil Júnior para certificações e dados oficiais.",
    logo: "BJ",
    color: "#003580",
    accentColor: "rgba(0,53,128,0.06)",
    features: ["Certificações", "Dados oficiais", "Conformidade MEJ"],
    comingSoon: true,
    plan: "enterprise",
  },
];

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Grátis", color: "#41C5C6" },
  growth: { label: "Growth", color: "#4E378C" },
  enterprise: { label: "Enterprise", color: "#FEC045" },
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days > 0) return `há ${days}d`;
  if (hours > 0) return `há ${hours}h`;
  return `há ${mins}m`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: connected ? "#41C5C6" : "#94a3b8",
        boxShadow: connected ? "0 0 0 3px rgba(65,197,198,0.25)" : "none",
      }}
    />
  );
}

function PlanBadge({ plan }: { plan?: string }) {
  if (!plan || plan === "free") return null;
  const meta = PLAN_LABELS[plan];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 20,
        background: meta.color,
        color: "#fff",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}
    >
      {meta.label}
    </span>
  );
}

// ─── Integration Card ────────────────────────────────────────────────────────

function IntegrationCard({
  provider,
  status,
  onConnect,
  onDisconnect,
  connecting,
  disconnecting,
}: {
  provider: (typeof PROVIDERS)[0];
  status?: IntegrationStatus;
  onConnect: (key: ProviderKey) => void;
  onDisconnect: (key: ProviderKey) => void;
  connecting: boolean;
  disconnecting: boolean;
}) {
  const connected = status?.connected ?? false;
  const [showDetails, setShowDetails] = useState(false);
  const isComingSoon = provider.comingSoon;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: `1px solid ${connected ? "rgba(65,197,198,0.4)" : "#e2e8f0"}`,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        transition: "all 0.2s",
        opacity: isComingSoon ? 0.75 : 1,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Coming soon overlay tag */}
      {isComingSoon && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "#f1f5f9",
            color: "#64748b",
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 20,
            letterSpacing: "0.04em",
          }}
        >
          Em breve
        </div>
      )}

      {/* Active glow bar */}
      {connected && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${provider.color}, #41C5C6)`,
            borderRadius: "16px 16px 0 0",
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: provider.accentColor,
            border: `1px solid ${provider.color}22`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: provider.color,
            fontWeight: 800,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {provider.logo}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 2,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 15, color: "#09254D" }}>
              {provider.name}
            </span>
            <PlanBadge plan={provider.plan} />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: connected ? "#41C5C6" : "#94a3b8",
            }}
          >
            <StatusDot connected={connected} />
            {connected
              ? status?.workspaceName
                ? `Conectado — ${status.workspaceName}`
                : "Conectado"
              : isComingSoon
              ? "Disponível em breve"
              : "Não conectado"}
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55, margin: 0 }}>
        {provider.description}
      </p>

      {/* Features */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {provider.features.map((f) => (
          <span
            key={f}
            style={{
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 20,
              background: connected ? provider.accentColor : "#f8fafc",
              color: connected ? provider.color : "#64748b",
              border: `1px solid ${connected ? provider.color + "22" : "#e2e8f0"}`,
              fontWeight: 500,
            }}
          >
            {f}
          </span>
        ))}
      </div>

      {/* Connected details */}
      {connected && status?.connectedAt && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            color: "#94a3b8",
            textAlign: "left",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>{showDetails ? "▲" : "▼"}</span>
          Conectado {timeAgo(status.connectedAt)}
          {status.expiresAt &&
            new Date(status.expiresAt) < new Date(Date.now() + 7 * 86400000) && (
              <span style={{ color: "#FEC045", marginLeft: 4 }}>
                · expira em breve
              </span>
            )}
        </button>
      )}

      {showDetails && connected && (
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 12,
            color: "#64748b",
            lineHeight: 1.7,
          }}
        >
          {status?.scopes?.length ? (
            <div>
              <strong style={{ color: "#09254D" }}>Escopos:</strong>{" "}
              {status.scopes.slice(0, 4).join(", ")}
              {status.scopes.length > 4 && ` +${status.scopes.length - 4}`}
            </div>
          ) : null}
          {status?.expiresAt && (
            <div>
              <strong style={{ color: "#09254D" }}>Expira:</strong>{" "}
              {new Date(status.expiresAt).toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      {!isComingSoon && (
        <button
          onClick={() =>
            connected ? onDisconnect(provider.key) : onConnect(provider.key)
          }
          disabled={connecting || disconnecting}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: connected ? "1.5px solid #fee2e2" : "none",
            background: connected
              ? "#fff"
              : `linear-gradient(135deg, ${provider.color}, ${provider.color}cc)`,
            color: connected ? "#ef4444" : "#fff",
            fontWeight: 600,
            fontSize: 13,
            cursor: connecting || disconnecting ? "wait" : "pointer",
            transition: "all 0.15s",
            opacity: connecting || disconnecting ? 0.7 : 1,
          }}
        >
          {connecting
            ? "Conectando..."
            : disconnecting
            ? "Desconectando..."
            : connected
            ? "Desconectar"
            : `Conectar ${provider.name}`}
        </button>
      )}

      {isComingSoon && (
        <button
          disabled
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "1.5px dashed #cbd5e1",
            background: "transparent",
            color: "#94a3b8",
            fontWeight: 600,
            fontSize: 13,
            cursor: "not-allowed",
          }}
        >
          Em breve
        </button>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function IntegracoesPage() {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<ProviderKey | null>(null);
  const [disconnecting, setDisconnecting] = useState<ProviderKey | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/integracoes/status");
      if (!res.ok) return;
      const data = await res.json() as { integrations: IntegrationStatus[] };
      const map: Record<string, IntegrationStatus> = {};
      for (const s of data.integrations) {
        map[s.provider] = s;
      }
      setStatuses(map);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();

    // Check for success/error in URL
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");

    if (success) {
      const meta = PROVIDERS.find((p) => p.key === success);
      showToast(`${meta?.name ?? success} conectado com sucesso! 🎉`, "success");
      window.history.replaceState({}, "", "/integracoes");
    }
    if (error) {
      showToast(`Erro ao conectar: ${decodeURIComponent(error)}`, "error");
      window.history.replaceState({}, "", "/integracoes");
    }
  }, [loadStatuses]);

  const handleConnect = (key: ProviderKey) => {
    setConnecting(key);
    window.location.href = `/api/integracoes/connect?provider=${key}`;
  };

  const handleDisconnect = async (key: ProviderKey) => {
    if (
      !confirm(
        `Tem certeza que deseja desconectar ${PROVIDERS.find((p) => p.key === key)?.name}? Todas as automações desse provedor serão pausadas.`
      )
    )
      return;

    setDisconnecting(key);
    try {
      const res = await fetch("/api/integracoes/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: key }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        showToast(data.error ?? "Erro ao desconectar", "error");
      } else {
        showToast("Integração removida com sucesso", "success");
        await loadStatuses();
      }
    } catch {
      showToast("Erro de rede ao desconectar", "error");
    } finally {
      setDisconnecting(null);
    }
  };

  const connectedCount = Object.values(statuses).filter((s) => s.connected).length;
  const activeProviders = PROVIDERS.filter((p) => !p.comingSoon);
  const healthScore = activeProviders.length > 0
    ? Math.round((connectedCount / activeProviders.length) * 100)
    : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "32px 40px",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            background: toast.type === "success" ? "#09254D" : "#ef4444",
            color: "#fff",
            padding: "14px 20px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            animation: "slideIn 0.3s ease",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #09254D, #4E378C)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            🔗
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#09254D", margin: 0 }}>
            Integrações
          </h1>
        </div>
        <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
          Conecte as ferramentas da sua EJ para ativar a Iniciação Atômica e o Mesh Thinking.
        </p>
      </div>

      {/* Health Banner */}
      {!loading && (
        <div
          style={{
            background: "linear-gradient(135deg, #09254D 0%, #4E378C 100%)",
            borderRadius: 16,
            padding: "20px 28px",
            marginBottom: 32,
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          {/* Score */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", width: 56, height: 56 }}>
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                <circle
                  cx="28" cy="28" r="24"
                  fill="none"
                  stroke="#41C5C6"
                  strokeWidth="4"
                  strokeDasharray={`${healthScore * 1.508} 150.8`}
                  strokeLinecap="round"
                  transform="rotate(-90 28 28)"
                />
              </svg>
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 800, fontSize: 14,
              }}>
                {healthScore}%
              </div>
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
                Mesh Score
              </div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                {connectedCount} de {activeProviders.length} integrações ativas
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.15)" }} />

          {/* Status pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {activeProviders.map((p) => {
              const s = statuses[p.key];
              const ok = s?.connected;
              return (
                <div
                  key={p.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 20,
                    background: ok ? "rgba(65,197,198,0.15)" : "rgba(255,255,255,0.08)",
                    border: `1px solid ${ok ? "#41C5C6" : "rgba(255,255,255,0.15)"}`,
                    fontSize: 12,
                    color: ok ? "#41C5C6" : "rgba(255,255,255,0.5)",
                    fontWeight: 500,
                  }}
                >
                  <StatusDot connected={ok ?? false} />
                  {p.name}
                </div>
              );
            })}
          </div>

          {/* Mesh tip */}
          {healthScore < 100 && (
            <div
              style={{
                marginLeft: "auto",
                background: "rgba(254,192,69,0.15)",
                border: "1px solid rgba(254,192,69,0.3)",
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 12,
                color: "#FEC045",
                maxWidth: 220,
              }}
            >
              ⚡ Conecte todas as integrações para ativar o Atomic Initiation completo
            </div>
          )}
          {healthScore === 100 && (
            <div
              style={{
                marginLeft: "auto",
                background: "rgba(65,197,198,0.15)",
                border: "1px solid rgba(65,197,198,0.3)",
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 12,
                color: "#41C5C6",
              }}
            >
              ✅ Mesh Thinking 100% ativo!
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#09254D", margin: "0 0 4px" }}>
          Integrações Ativas
        </h2>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 20px" }}>
          Disponíveis no plano atual — clique para conectar ou reconectar
        </p>
      </div>

      {/* Active provider grid */}
      {loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
            marginBottom: 40,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: "#e2e8f0",
                borderRadius: 16,
                height: 220,
                animation: "pulse 1.5s infinite",
              }}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
            marginBottom: 40,
          }}
        >
          {PROVIDERS.filter((p) => !p.comingSoon).map((provider) => (
            <IntegrationCard
              key={provider.key}
              provider={provider}
              status={statuses[provider.key]}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              connecting={connecting === provider.key}
              disconnecting={disconnecting === provider.key}
            />
          ))}
        </div>
      )}

      {/* Roadmap section */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#09254D", margin: "0 0 4px" }}>
          Roadmap de Integrações
        </h2>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 20px" }}>
          Em desenvolvimento — vote nas integrações que mais precisa
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 20,
          marginBottom: 48,
        }}
      >
        {PROVIDERS.filter((p) => p.comingSoon).map((provider) => (
          <IntegrationCard
            key={provider.key}
            provider={provider}
            status={statuses[provider.key]}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            connecting={connecting === provider.key}
            disconnecting={disconnecting === provider.key}
          />
        ))}
      </div>

      {/* Mesh info box */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(9,37,77,0.04) 0%, rgba(78,55,140,0.04) 100%)",
          border: "1px solid rgba(9,37,77,0.08)",
          borderRadius: 16,
          padding: "20px 24px",
          display: "flex",
          gap: 20,
          alignItems: "flex-start",
        }}
      >
        <div style={{ fontSize: 28, flexShrink: 0 }}>🕸️</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#09254D", marginBottom: 6 }}>
            Mesh Thinking
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
            No Hïve, cada evento ecoa por toda a rede. Ao criar um projeto, a Iniciação Atômica
            aciona Drive, Discord, ClickUp, Notion e Calendar em paralelo — nenhum dado fica
            isolado. Conecte todas as integrações para liberar o potencial completo do seu hub.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes slideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
