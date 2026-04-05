"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";

interface MemberBalance {
  org_id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  rank: string;
  department: string | null;
  total_points: number;
  total_awarded: number;
  total_deducted: number;
  transaction_count: number;
}

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  source_event: string;
  created_at: string;
  awarded_by: string | null;
  profiles?: { full_name: string };
}

interface Badge {
  id: string;
  member_id: string;
  category: string;
  badge_name: string;
  task_count: number;
  earned_at: string;
  profiles?: { full_name: string; avatar_url: string | null };
}

const RANK_LABELS: Record<string, string> = {
  trainee: "Trainee",
  assessor: "Assessor",
  project_leader: "Líder de Projeto",
  dept_leader: "Líder de Departamento",
  director: "Diretor",
  president: "Presidente",
};

const RANK_COLORS: Record<string, string> = {
  trainee: "#6B7280",
  assessor: "#2563EB",
  project_leader: "#0891B2",
  dept_leader: "#7C3AED",
  director: "#D97706",
  president: "#DC2626",
};

function MedalIcon({ position }: { position: number }) {
  if (position === 1) return <span className="text-xl">🥇</span>;
  if (position === 2) return <span className="text-xl">🥈</span>;
  if (position === 3) return <span className="text-xl">🥉</span>;
  return <span className="text-sm font-bold text-muted-foreground">#{position}</span>;
}

export default function PontosPage() {
  const supabase = createClient();
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ranking" | "historico" | "badges">("ranking");
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardForm, setAwardForm] = useState({
    userId: "",
    amount: "10",
    reason: "",
    isPositive: true,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: bal }, { data: tx }, { data: bdg }] = await Promise.all([
        supabase
          .from("member_point_balances")
          .select("*")
          .order("total_points", { ascending: false }),
        supabase
          .from("point_transactions")
          .select("*, profiles(full_name)")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("member_badges")
          .select("*, profiles(full_name, avatar_url)")
          .order("earned_at", { ascending: false }),
      ]);
      setBalances(bal ?? []);
      setTransactions(tx ?? []);
      setBadges(bdg ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function awardPoints() {
    if (!awardForm.userId || !awardForm.reason || !awardForm.amount) return;
    const amount = parseInt(awardForm.amount) * (awardForm.isPositive ? 1 : -1);
    await supabase.rpc("award_points", {
      p_user_id: awardForm.userId,
      p_amount: amount,
      p_reason: awardForm.reason,
      p_source_event: "MANUAL",
    });
    setShowAwardModal(false);
    setAwardForm({ userId: "", amount: "10", reason: "", isPositive: true });
    window.location.reload();
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const topThree = balances.slice(0, 3);
  const restOfRanking = balances.slice(3);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Pontos & Ranking"
        subtitle="Sistema de reconhecimento da EJ"
        userName=""
        userEmail=""
        planTier="premium"
        actions={
          <button
            onClick={() => setShowAwardModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors"
          >
            ⭐ Atribuir Pontos
          </button>
        }
      />

      {/* Podium — Top 3 */}
      {topThree.length > 0 && (
        <div className="px-6 py-5 bg-card border-b border-border">
          <div className="flex items-end justify-center gap-4">
            {/* Silver — #2 */}
            {topThree[1] && (
              <PodiumCard member={topThree[1]} position={2} height="h-24" />
            )}
            {/* Gold — #1 */}
            {topThree[0] && (
              <PodiumCard member={topThree[0]} position={1} height="h-32" />
            )}
            {/* Bronze — #3 */}
            {topThree[2] && (
              <PodiumCard member={topThree[2]} position={3} height="h-20" />
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-4 border-b border-border">
        {(["ranking", "historico", "badges"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              tab === t
                ? "border-brand-teal text-brand-teal"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "ranking" ? "🏆 Ranking" : t === "historico" ? "📜 Histórico" : "🏅 Badges"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* ── RANKING TAB ── */}
        {tab === "ranking" && (
          <div className="max-w-2xl space-y-2">
            {restOfRanking.map((member, i) => (
              <div
                key={member.user_id}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl"
              >
                <div className="w-8 text-center flex-shrink-0">
                  <MedalIcon position={i + 4} />
                </div>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
                >
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.full_name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    member.full_name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{member.full_name}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        background: (RANK_COLORS[member.rank] ?? "#6B7280") + "20",
                        color: RANK_COLORS[member.rank] ?? "#6B7280",
                      }}
                    >
                      {RANK_LABELS[member.rank] ?? member.rank}
                    </span>
                    {member.department && (
                      <span className="text-[10px] text-muted-foreground">{member.department}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold" style={{ color: "#09254D" }}>{member.total_points}</p>
                  <p className="text-[10px] text-muted-foreground">pontos</p>
                </div>
                {/* Mini bar chart */}
                <div className="w-24 flex flex-col gap-0.5 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <div className="h-1 rounded-full bg-green-400"
                      style={{ width: `${Math.min((member.total_awarded / Math.max(...balances.map(b => b.total_awarded), 1)) * 100, 100)}%`, minWidth: 4 }} />
                    <span className="text-[9px] text-green-600">+{member.total_awarded}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-1 rounded-full bg-red-400"
                      style={{ width: `${Math.min((Math.abs(member.total_deducted) / Math.max(...balances.map(b => Math.abs(b.total_deducted)), 1)) * 100, 100)}%`, minWidth: member.total_deducted < 0 ? 4 : 0 }} />
                    <span className="text-[9px] text-red-500">{member.total_deducted}</span>
                  </div>
                </div>
              </div>
            ))}

            {balances.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-4xl mb-3">⭐</span>
                <p className="text-sm font-medium text-foreground">Nenhum ponto registrado ainda</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pontos são atribuídos automaticamente quando tarefas são concluídas no ClickUp
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORICO TAB ── */}
        {tab === "historico" && (
          <div className="max-w-2xl">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <span className="text-3xl mb-2">📜</span>
                  <p className="text-sm text-muted-foreground">Nenhuma transação registrada</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        tx.amount > 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : "-"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{tx.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.profiles?.full_name ?? "Membro"} · {tx.source_event === "MANUAL" ? "Manual" : "Automático"}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p
                        className={`text-sm font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}
                      >
                        {tx.amount > 0 ? "+" : ""}{tx.amount} pts
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── BADGES TAB ── */}
        {tab === "badges" && (
          <div className="max-w-3xl">
            {badges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-4xl mb-3">🏅</span>
                <p className="text-sm font-medium text-foreground">Nenhum badge conquistado ainda</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Badges são conquistados automaticamente quando um membro conclui 10+ tarefas na mesma categoria no ClickUp
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {badges.map((badge) => (
                  <div key={badge.id} className="bg-card border border-border rounded-2xl p-5 text-center">
                    <div className="text-3xl mb-2">🏅</div>
                    <p className="text-sm font-bold text-foreground">{badge.badge_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{badge.profiles?.full_name}</p>
                    <div className="mt-2 flex items-center justify-center gap-1">
                      <span className="text-[10px] font-medium text-brand-teal">{badge.task_count} tarefas concluídas</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Conquistado em {new Date(badge.earned_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Award modal */}
      {showAwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-semibold text-foreground mb-4">Atribuir Pontos Manualmente</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Membro</label>
                <select
                  value={awardForm.userId}
                  onChange={(e) => setAwardForm((f) => ({ ...f, userId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                >
                  <option value="">Selecionar...</option>
                  {balances.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tipo</label>
                <div className="flex gap-2">
                  {[true, false].map((pos) => (
                    <button
                      key={String(pos)}
                      onClick={() => setAwardForm((f) => ({ ...f, isPositive: pos }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                        awardForm.isPositive === pos
                          ? pos ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {pos ? "⭐ Recompensa" : "⚠️ Punição"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={awardForm.amount}
                  onChange={(e) => setAwardForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Motivo</label>
                <input
                  type="text"
                  value={awardForm.reason}
                  onChange={(e) => setAwardForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Ex: Excelente apresentação ao cliente"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAwardModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={awardPoints}
                disabled={!awardForm.userId || !awardForm.reason}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PodiumCard({
  member,
  position,
  height,
}: {
  member: MemberBalance;
  position: number;
  height: string;
}) {
  const colors = { 1: "#FEC045", 2: "#9CA3AF", 3: "#D97706" };
  const color = colors[position as 1 | 2 | 3];

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white border-2"
        style={{ background: "linear-gradient(135deg, #09254D, #4E378C)", borderColor: color }}
      >
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.full_name} className="w-full h-full rounded-full object-cover" />
        ) : (
          member.full_name.charAt(0)
        )}
      </div>
      <p className="text-xs font-semibold text-foreground text-center max-w-20 truncate">{member.full_name}</p>
      <p className="text-sm font-bold" style={{ color }}>{member.total_points} pts</p>
      <div
        className={`w-20 ${height} rounded-t-lg flex items-end justify-center pb-2`}
        style={{ background: color + "30", border: `2px solid ${color}`, borderBottom: "none" }}
      >
        <span className="text-lg">{position === 1 ? "🥇" : position === 2 ? "🥈" : "🥉"}</span>
      </div>
    </div>
  );
}
