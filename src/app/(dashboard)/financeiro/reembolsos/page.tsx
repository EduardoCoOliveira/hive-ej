"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  amount: number;
  currency: string;
  date: string;
  cnpj: string | null;
  company_name: string | null;
  description: string | null;
  category: string;
  status: "pending" | "approved" | "rejected";
  receipt_url: string | null;
  drive_file_id: string | null;
  sheets_row: number | null;
  discord_message_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  member_id: string;
  project_id: string | null;
}

interface Stats {
  totalPending: number;
  totalApproved: number;
  countPending: number;
  countApproved: number;
  countRejected: number;
}

const CATEGORY_EMOJI: Record<string, string> = {
  alimentação: "🍽️", transporte: "🚗", material: "📦",
  hospedagem: "🏨", serviço: "🔧", evento: "🎉", outro: "📄",
};

const STATUS_CONFIG = {
  pending: { label: "Pendente", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400" },
  approved: { label: "Aprovado", bg: "bg-green-100", text: "text-green-700", dot: "bg-green-400" },
  rejected: { label: "Reprovado", bg: "bg-red-100", text: "text-red-700", dot: "bg-red-400" },
};

function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// ─── Submit Modal ─────────────────────────────────────────────────────────────

function SubmitExpenseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("outro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(f: File) {
    setFile(f);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("receipt", file);
      if (description) formData.append("description", description);
      formData.append("category", category);

      const res = await fetch("/api/expenses/submit", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      onSuccess();
      onClose();
    } catch {
      setError("Erro ao enviar comprovante");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Solicitar Reembolso</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Comprovante *</label>
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#4E378C]/50 transition-colors"
            >
              {preview ? (
                <img src={preview} alt="preview" className="max-h-32 mx-auto rounded-lg object-contain" />
              ) : file ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl">📄</span>
                  <span className="text-sm text-slate-600 truncate max-w-[200px]">{file.name}</span>
                </div>
              ) : (
                <div>
                  <span className="text-3xl">📸</span>
                  <p className="text-sm text-slate-500 mt-2">Foto do recibo ou PDF</p>
                  <p className="text-xs text-slate-400">JPG, PNG, WebP, PDF • máx 10MB</p>
                </div>
              )}
            </div>
            <input
              ref={inputRef} type="file" className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Almoço com cliente, passagem para evento..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
            <select
              value={category} onChange={e => setCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30"
            >
              {Object.entries(CATEGORY_EMOJI).map(([cat, emoji]) => (
                <option key={cat} value={cat}>{emoji} {cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-700">
              🤖 A IA vai extrair automaticamente o valor, data e CNPJ do comprovante. O financeiro será notificado no Discord.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={!file || loading} className="flex-1 bg-[#09254D] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#0a2f61] disabled:opacity-50">
              {loading ? "Processando IA..." : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Expense Row ──────────────────────────────────────────────────────────────

function ExpenseRow({
  expense,
  isDirector,
  onApprove,
}: {
  expense: Expense;
  isDirector: boolean;
  onApprove: (id: string, approved: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[expense.status];
  const catEmoji = CATEGORY_EMOJI[expense.category] ?? "📄";

  return (
    <>
      <tr
        className="hover:bg-slate-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{catEmoji}</span>
            <div>
              <p className="text-sm font-medium text-slate-700 line-clamp-1">{expense.description ?? expense.company_name ?? "Sem descrição"}</p>
              <p className="text-xs text-slate-400">{expense.date ?? new Date(expense.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">{formatBRL(expense.amount)}</p>
        </td>
        <td className="px-4 py-3 hidden sm:table-cell">
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full capitalize">
            {expense.category}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {expense.receipt_url && (
              <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#4E378C] hover:underline">
                Ver
              </a>
            )}
            {isDirector && expense.status === "pending" && (
              <>
                <button onClick={() => onApprove(expense.id, true)}
                  className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200 font-medium">
                  ✅
                </button>
                <button onClick={() => onApprove(expense.id, false)}
                  className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg hover:bg-red-200 font-medium">
                  ❌
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-slate-50/70">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {expense.company_name && (
                <div><p className="text-slate-400 font-medium">Empresa</p><p className="text-slate-700">{expense.company_name}</p></div>
              )}
              {expense.cnpj && (
                <div><p className="text-slate-400 font-medium">CNPJ</p><p className="text-slate-700">{expense.cnpj}</p></div>
              )}
              {expense.sheets_row && (
                <div><p className="text-slate-400 font-medium">Linha na Planilha</p><p className="text-slate-700">#{expense.sheets_row}</p></div>
              )}
              {expense.rejection_reason && (
                <div className="col-span-2"><p className="text-slate-400 font-medium">Motivo da reprovação</p><p className="text-red-600">{expense.rejection_reason}</p></div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReembolsosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDirector, setIsDirector] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [approveTarget, setApproveTarget] = useState<{ id: string; approved: boolean } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approving, setApproving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const supabase = createClient();

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles").select("rank").eq("id", user.id).single();
      const director = ["director", "president"].includes(profile?.rank ?? "");
      setIsDirector(director);

      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/expenses/submit?${params}`);
      const data = await res.json();
      setExpenses(data.expenses ?? []);
      setStats(data.stats ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [filterStatus]);

  async function handleApprove() {
    if (!approveTarget) return;
    setApproving(true);
    try {
      const res = await fetch("/api/expenses/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseId: approveTarget.id,
          approved: approveTarget.approved,
          reason: rejectReason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, "error"); return; }
      showToast(approveTarget.approved ? "Reembolso aprovado!" : "Reembolso reprovado.");
      setApproveTarget(null);
      setRejectReason("");
      loadData();
    } catch {
      showToast("Erro ao processar aprovação", "error");
    } finally {
      setApproving(false);
    }
  }

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#09254D]">Reembolsos</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isDirector ? "Gerencie e aprove as solicitações de reembolso" : "Solicite e acompanhe seus reembolsos"}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#09254D] text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-[#0a2f61] transition-colors"
        >
          + Solicitar
        </button>
      </div>

      {/* Stats */}
      {isDirector && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Pendentes", value: stats.countPending, amount: formatBRL(stats.totalPending), color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
            { label: "Aprovados", value: stats.countApproved, amount: formatBRL(stats.totalApproved), color: "text-green-600", bg: "bg-green-50 border-green-100" },
            { label: "Reprovados", value: stats.countRejected, amount: "—", color: "text-red-500", bg: "bg-red-50 border-red-100" },
            { label: "Total do período", value: expenses.length, amount: formatBRL(totalAmount), color: "text-[#09254D]", bg: "bg-white border-slate-100" },
          ].map((s) => (
            <div key={s.label} className={`border rounded-2xl p-4 ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              <p className={`text-sm font-semibold mt-1 ${s.color}`}>{s.amount}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        {["", "pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-sm px-4 py-2 rounded-xl font-medium transition-colors ${
              filterStatus === s
                ? "bg-[#09254D] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s === "" ? "Todos" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-[#4E378C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💰</p>
            <p className="font-medium text-slate-600">Nenhum reembolso encontrado</p>
            <p className="text-sm text-slate-400 mt-1">
              {filterStatus ? "Tente mudar o filtro" : "Clique em \"Solicitar\" para enviar um comprovante"}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Despesa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {expenses.map(expense => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  isDirector={isDirector}
                  onApprove={(id, approved) => setApproveTarget({ id, approved })}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Submit Modal */}
      {showModal && (
        <SubmitExpenseModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { showToast("Reembolso enviado! Financeiro notificado no Discord."); loadData(); }}
        />
      )}

      {/* Approve/Reject Modal */}
      {approveTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${approveTarget.approved ? "bg-green-100" : "bg-red-100"}`}>
              <span className="text-2xl">{approveTarget.approved ? "✅" : "❌"}</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              {approveTarget.approved ? "Aprovar reembolso" : "Reprovar reembolso"}
            </h2>

            {!approveTarget.approved && (
              <div className="mt-3 mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da reprovação *</label>
                <input
                  type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  placeholder="Ex: Valor não condiz com política, falta CNPJ..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
            )}

            <p className="text-sm text-slate-500 mb-5">
              {approveTarget.approved
                ? "O membro será notificado por email."
                : "O motivo será enviado ao membro por email."}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => { setApproveTarget(null); setRejectReason(""); }}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleApprove}
                disabled={approving || (!approveTarget.approved && !rejectReason)}
                className={`flex-1 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 ${
                  approveTarget.approved ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {approving ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
