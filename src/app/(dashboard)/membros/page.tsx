"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  full_name: string;
  email: string;
  rank: string;
  department: string | null;
  discord_id: string | null;
  skills: string[];
  created_at: string;
  avatar_url: string | null;
}

interface CallerProfile {
  rank: string;
  department: string | null;
}

const RANK_ORDER: Record<string, number> = {
  trainee: 1, assessor: 2, project_leader: 3,
  dept_leader: 4, director: 5, president: 6,
};

const RANK_LABELS: Record<string, string> = {
  trainee: "Trainee", assessor: "Assessor",
  project_leader: "Líder de Projeto", dept_leader: "Líder de Diretoria",
  director: "Diretor", president: "Presidente",
};

const RANK_COLORS: Record<string, string> = {
  trainee: "bg-slate-100 text-slate-600",
  assessor: "bg-blue-100 text-blue-700",
  project_leader: "bg-purple-100 text-purple-700",
  dept_leader: "bg-amber-100 text-amber-700",
  director: "bg-orange-100 text-orange-700",
  president: "bg-rose-100 text-rose-700",
};

// ─── Add Member Modal ─────────────────────────────────────────────────────────

function AddMemberModal({
  caller,
  onClose,
  onSuccess,
}: {
  caller: CallerProfile;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    email: "", fullName: "", rank: "trainee",
    department: caller.department ?? "",
    discordId: "", skills: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allowedRanks = Object.entries(RANK_LABELS).filter(([r]) => {
    if (caller.rank === "dept_leader") return RANK_ORDER[r] < RANK_ORDER.dept_leader;
    if (caller.rank === "director") return RANK_ORDER[r] <= RANK_ORDER.project_leader;
    return true;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          fullName: form.fullName,
          rank: form.rank,
          department: form.department || undefined,
          discordId: form.discordId || undefined,
          skills: form.skills ? form.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      onSuccess();
      onClose();
    } catch {
      setError("Erro ao adicionar membro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Adicionar Membro</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo *</label>
            <input
              type="text" required value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30"
              placeholder="João Silva"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input
              type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30"
              placeholder="joao@email.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cargo *</label>
              <select
                value={form.rank}
                onChange={e => setForm(f => ({ ...f, rank: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30"
              >
                {allowedRanks.map(([r, label]) => (
                  <option key={r} value={r}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Diretoria</label>
              <input
                type="text"
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                disabled={caller.rank === "dept_leader"}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30 disabled:bg-slate-50 disabled:text-slate-400"
                placeholder="Marketing"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discord ID</label>
            <input
              type="text" value={form.discordId}
              onChange={e => setForm(f => ({ ...f, discordId: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30"
              placeholder="123456789012345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Skills <span className="text-slate-400 font-normal">(separadas por vírgula)</span>
            </label>
            <input
              type="text" value={form.skills}
              onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30"
              placeholder="React, Design, Python"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 bg-[#09254D] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#0a2f61] transition-colors disabled:opacity-60"
            >
              {loading ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────

function MemberCard({
  member,
  caller,
  onOffboard,
  onRoleChange,
}: {
  member: Member;
  caller: CallerProfile;
  onOffboard: (id: string, name: string) => void;
  onRoleChange: (member: Member) => void;
}) {
  const canManage =
    RANK_ORDER[caller.rank] >= RANK_ORDER.dept_leader &&
    RANK_ORDER[caller.rank] > RANK_ORDER[member.rank];

  const initials = (member.full_name ?? "?")
    .split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#09254D] to-[#4E378C] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          {member.avatar_url
            ? <img src={member.avatar_url} alt={member.full_name} className="w-11 h-11 rounded-full object-cover" />
            : initials
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm">{member.full_name}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RANK_COLORS[member.rank] ?? "bg-slate-100 text-slate-500"}`}>
              {RANK_LABELS[member.rank] ?? member.rank}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{member.email}</p>
          {member.department && (
            <p className="text-xs text-slate-400 mt-0.5">📁 {member.department}</p>
          )}
        </div>
      </div>

      {member.skills && member.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {member.skills.slice(0, 4).map(skill => (
            <span key={skill} className="text-xs bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
              {skill}
            </span>
          ))}
          {member.skills.length > 4 && (
            <span className="text-xs text-slate-400">+{member.skills.length - 4}</span>
          )}
        </div>
      )}

      {canManage && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-50">
          <button
            onClick={() => onRoleChange(member)}
            className="flex-1 text-xs text-[#4E378C] font-medium hover:bg-[#4E378C]/5 rounded-lg py-1.5 transition-colors"
          >
            Alterar cargo
          </button>
          <button
            onClick={() => onOffboard(member.id, member.full_name)}
            className="flex-1 text-xs text-rose-600 font-medium hover:bg-rose-50 rounded-lg py-1.5 transition-colors"
          >
            Offboarding
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Change Role Modal ────────────────────────────────────────────────────────

function ChangeRoleModal({
  member,
  caller,
  onClose,
  onSuccess,
}: {
  member: Member;
  caller: CallerProfile;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rank, setRank] = useState(member.rank);
  const [department, setDepartment] = useState(member.department ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const MAX_PROMOTE: Record<string, string> = {
    dept_leader: "assessor", director: "project_leader", president: "president",
  };

  const maxAllowed = MAX_PROMOTE[caller.rank];
  const allowedRanks = Object.entries(RANK_LABELS).filter(([r]) =>
    !maxAllowed || RANK_ORDER[r] <= RANK_ORDER[maxAllowed]
  );

  async function handleSave() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/members/${member.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rank, department: department || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onSuccess();
      onClose();
    } catch {
      setError("Erro ao atualizar cargo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Alterar cargo</h2>
        <p className="text-sm text-slate-500 mb-5">{member.full_name}</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Novo cargo</label>
            <select
              value={rank}
              onChange={e => setRank(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30"
            >
              {allowedRanks.map(([r, label]) => (
                <option key={r} value={r}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Diretoria</label>
            <input
              type="text" value={department}
              onChange={e => setDepartment(e.target.value)}
              disabled={caller.rank === "dept_leader"}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30 disabled:bg-slate-50"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 bg-[#09254D] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#0a2f61] disabled:opacity-60">
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MembrosPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [caller, setCaller] = useState<CallerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRank, setFilterRank] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [offboardTarget, setOffboardTarget] = useState<{ id: string; name: string } | null>(null);
  const [roleTarget, setRoleTarget] = useState<Member | null>(null);
  const [offboardReason, setOffboardReason] = useState("");
  const [offboardLoading, setOffboardLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const supabase = createClient();

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadMembers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRank) params.set("rank", filterRank);
      if (filterDept) params.set("department", filterDept);

      const res = await fetch(`/api/members?${params}`);
      const data = await res.json();
      setMembers(data.members ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadCaller() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("rank, department")
      .eq("id", user.id)
      .single();
    if (profile) setCaller(profile as CallerProfile);
  }

  useEffect(() => {
    loadCaller();
  }, []);

  useEffect(() => {
    if (caller) loadMembers();
  }, [caller, filterRank, filterDept]);

  async function handleOffboard() {
    if (!offboardTarget) return;
    setOffboardLoading(true);
    try {
      const res = await fetch("/api/members/offboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: offboardTarget.id, reason: offboardReason }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, "error"); return; }
      showToast(`Offboarding de ${offboardTarget.name} iniciado!`);
      setOffboardTarget(null);
      loadMembers();
    } catch {
      showToast("Erro ao iniciar offboarding", "error");
    } finally {
      setOffboardLoading(false);
    }
  }

  // Departamentos únicos para filtro
  const departments = [...new Set(members.map(m => m.department).filter(Boolean))] as string[];

  // Filtro de busca local
  const filtered = members.filter(m =>
    !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Agrupar por cargo para hierarquia visual
  const byRank = Object.entries(RANK_LABELS)
    .filter(([r]) => filtered.some(m => m.rank === r))
    .sort(([a], [b]) => RANK_ORDER[b] - RANK_ORDER[a]);

  const canAddMembers = caller && RANK_ORDER[caller.rank] >= RANK_ORDER.dept_leader;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#09254D]">Membros</h1>
        <p className="text-slate-500 text-sm mt-1">Gerencie os membros e hierarquia da sua EJ</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total de membros", value: members.length, icon: "👥" },
          { label: "Lideranças", value: members.filter(m => RANK_ORDER[m.rank] >= 4).length, icon: "⭐" },
          { label: "Directorias ativas", value: departments.length, icon: "📁" },
          { label: "Onboarding", value: members.filter(m => {
            const d = new Date(m.created_at);
            const diff = Date.now() - d.getTime();
            return diff < 30 * 24 * 60 * 60 * 1000; // últimos 30 dias
          }).length, icon: "🌱" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-100 rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#09254D]">{stat.icon} {stat.value}</p>
            <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text" placeholder="Buscar por nome ou email..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30"
        />
        <select
          value={filterRank} onChange={e => setFilterRank(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
        >
          <option value="">Todos os cargos</option>
          {Object.entries(RANK_LABELS).map(([r, l]) => (
            <option key={r} value={r}>{l}</option>
          ))}
        </select>
        <select
          value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
        >
          <option value="">Todas as diretorias</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {canAddMembers && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#09254D] text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-[#0a2f61] transition-colors whitespace-nowrap"
          >
            + Adicionar
          </button>
        )}
      </div>

      {/* Members by rank */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#4E378C] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">Nenhum membro encontrado</p>
        </div>
      ) : (
        <div className="space-y-8">
          {byRank.map(([rank, label]) => {
            const rankMembers = filtered.filter(m => m.rank === rank);
            if (rankMembers.length === 0) return null;
            return (
              <div key={rank}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{label}</h2>
                  <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">
                    {rankMembers.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {rankMembers.map(member => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      caller={caller!}
                      onOffboard={(id, name) => setOffboardTarget({ id, name })}
                      onRoleChange={setRoleTarget}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && caller && (
        <AddMemberModal
          caller={caller}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { showToast("Membro adicionado! Onboarding iniciado."); loadMembers(); }}
        />
      )}

      {/* Change Role Modal */}
      {roleTarget && caller && (
        <ChangeRoleModal
          member={roleTarget}
          caller={caller}
          onClose={() => setRoleTarget(null)}
          onSuccess={() => { showToast("Cargo atualizado!"); loadMembers(); }}
        />
      )}

      {/* Offboard Confirm Modal */}
      {offboardTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Confirmar Offboarding</h2>
            <p className="text-sm text-slate-500 mb-4">
              Esta ação vai revogar todos os acessos de <strong>{offboardTarget.name}</strong> (Google Workspace, Discord, ClickUp, Canva, Figma).
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Motivo <span className="text-slate-400 font-normal">(opcional)</span></label>
              <input
                type="text" value={offboardReason}
                onChange={e => setOffboardReason(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="Ex: Fim do mandato, desligamento..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setOffboardTarget(null); setOffboardReason(""); }}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleOffboard} disabled={offboardLoading}
                className="flex-1 bg-rose-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rose-700 disabled:opacity-60"
              >
                {offboardLoading ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
