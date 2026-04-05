"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  participants: string[];
  summary: string;
  next_steps: string;
  doc_url: string | null;
  project_id: string | null;
  created_at: string;
}

interface ProcessingStep {
  step: string;
  ok: boolean;
  error?: string;
}

const STEP_LABELS: Record<string, string> = {
  whisper_transcription: "Transcrição (Whisper)",
  gpt4o_minutes: "Geração da ata (GPT-4o)",
  google_docs_create: "Criar Google Doc",
  clickup_tasks: "Tasks no ClickUp",
  discord_minutes_notification: "Notificação Discord",
  gmail_minutes_email: "Email de resumo",
  save_to_db: "Salvar no banco",
};

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function AudioUploadZone({
  onFileSelected,
}: {
  onFileSelected: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
        dragging
          ? "border-[#4E378C] bg-[#4E378C]/5"
          : "border-slate-200 hover:border-[#4E378C]/50 hover:bg-slate-50"
      }`}
    >
      <div className="w-14 h-14 bg-[#4E378C]/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">🎙️</span>
      </div>
      <p className="text-slate-700 font-medium">Arraste o arquivo de áudio</p>
      <p className="text-slate-400 text-sm mt-1">ou clique para selecionar</p>
      <p className="text-slate-400 text-xs mt-3">MP3, MP4, M4A, WebM, WAV • máx 100MB</p>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/mp4"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelected(f); }}
      />
    </div>
  );
}

// ─── Processing Status ────────────────────────────────────────────────────────

function ProcessingStatus({ steps }: { steps: ProcessingStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div key={step.step} className="flex items-center gap-3">
          <span className="text-lg">{step.ok ? "✅" : "⚠️"}</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700">
              {STEP_LABELS[step.step] ?? step.step}
            </p>
            {step.error && <p className="text-xs text-rose-500">{step.error}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Meeting Card ─────────────────────────────────────────────────────────────

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const [expanded, setExpanded] = useState(false);

  const date = meeting.meeting_date
    ? new Date(meeting.meeting_date.split("/").reverse().join("-")).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : new Date(meeting.created_at).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "short", year: "numeric",
      });

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-md transition-all">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 text-sm line-clamp-1">{meeting.title}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-slate-400">📅 {date}</span>
              <span className="text-xs text-slate-400">👥 {meeting.participants?.length ?? 0} participantes</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {meeting.doc_url && (
              <a
                href={meeting.doc_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-[#4E378C]/10 text-[#4E378C] font-medium px-3 py-1.5 rounded-lg hover:bg-[#4E378C]/20 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                📄 Google Doc
              </a>
            )}
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-slate-400 hover:text-slate-600 text-sm"
            >
              {expanded ? "▲" : "▼"}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-3 line-clamp-2">{meeting.summary}</p>
      </div>

      {expanded && (
        <div className="border-t border-slate-50 px-5 pb-5 pt-4 bg-slate-50/50">
          <div className="space-y-4">
            {meeting.participants?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Participantes</p>
                <div className="flex flex-wrap gap-1.5">
                  {meeting.participants.map(p => (
                    <span key={p} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-lg">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {meeting.next_steps && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Próximos Passos</p>
                <p className="text-xs text-slate-600 leading-relaxed">{meeting.next_steps}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReunioesPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<"idle" | "transcribing" | "generating" | "done" | "error">("idle");
  const [processedSteps, setProcessedSteps] = useState<ProcessingStep[]>([]);
  const [result, setResult] = useState<{
    title: string;
    docUrl?: string;
    actionItems: number;
    decisions: number;
    summary: string;
    nextSteps: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function loadMeetings() {
    setLoadingMeetings(true);
    try {
      const res = await fetch("/api/meetings/process?limit=20");
      const data = await res.json();
      setMeetings(data.meetings ?? []);
    } finally {
      setLoadingMeetings(false);
    }
  }

  useEffect(() => { loadMeetings(); }, []);

  async function handleProcess() {
    if (!selectedFile) return;
    setUploading(true);
    setProgress("transcribing");
    setErrorMsg("");
    setProcessedSteps([]);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("audio", selectedFile);
      if (title) formData.append("title", title);
      if (participants) {
        formData.append("participants", JSON.stringify(
          participants.split(",").map(p => p.trim()).filter(Boolean)
        ));
      }

      setProgress("generating");

      const res = await fetch("/api/meetings/process", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setProgress("error");
        setErrorMsg(data.error ?? "Erro ao processar áudio");
        return;
      }

      setProcessedSteps(data.processing?.steps ?? []);
      setResult({
        title: data.minutes.title,
        docUrl: data.docUrl,
        actionItems: data.minutes.actionItems?.length ?? 0,
        decisions: data.minutes.decisions?.length ?? 0,
        summary: data.minutes.summary,
        nextSteps: data.minutes.nextSteps,
      });
      setProgress("done");
      loadMeetings();
    } catch (err) {
      setProgress("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setUploading(false);
    }
  }

  function resetUpload() {
    setSelectedFile(null);
    setTitle("");
    setParticipants("");
    setProgress("idle");
    setProcessedSteps([]);
    setResult(null);
    setErrorMsg("");
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#09254D]">Reuniões</h1>
        <p className="text-slate-500 text-sm mt-1">Gere atas automáticas com IA a partir de gravações</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Panel */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Nova Ata</h2>

            {progress === "idle" && (
              <div className="space-y-4">
                <AudioUploadZone onFileSelected={setSelectedFile} />

                {selectedFile && (
                  <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-2xl">🎵</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Título da reunião</label>
                  <input
                    type="text" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Reunião de Diretoria — Jan/2024"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Participantes <span className="text-slate-400 font-normal">(separados por vírgula)</span>
                  </label>
                  <input
                    type="text" value={participants} onChange={e => setParticipants(e.target.value)}
                    placeholder="João, Maria, Carlos..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E378C]/30"
                  />
                </div>

                <button
                  onClick={handleProcess}
                  disabled={!selectedFile || uploading}
                  className="w-full bg-gradient-to-r from-[#09254D] to-[#4E378C] text-white rounded-xl py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  🎙️ Gerar Ata com IA
                </button>
              </div>
            )}

            {(progress === "transcribing" || progress === "generating") && (
              <div className="py-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-[#4E378C]/10 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-[#4E378C] border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">
                    {progress === "transcribing" ? "Transcrevendo áudio..." : "Gerando ata com GPT-4o..."}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    {progress === "transcribing"
                      ? "Whisper está processando o áudio em português"
                      : "Identificando decisões e action items"}
                  </p>
                </div>
                <p className="text-xs text-slate-300">Isso pode levar alguns minutos para arquivos longos</p>
              </div>
            )}

            {progress === "error" && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-700">❌ Erro ao processar</p>
                  <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
                </div>
                <button onClick={resetUpload} className="w-full border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50">
                  Tentar novamente
                </button>
              </div>
            )}

            {progress === "done" && result && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-green-700">✅ Ata gerada com sucesso!</p>
                  <p className="text-sm text-green-600 mt-1 font-medium">{result.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-[#09254D]">{result.decisions}</p>
                    <p className="text-xs text-slate-500">Decisões</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-[#4E378C]">{result.actionItems}</p>
                    <p className="text-xs text-slate-500">Action Items</p>
                  </div>
                </div>

                {result.nextSteps && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Próximos Passos</p>
                    <p className="text-xs text-blue-600">{result.nextSteps}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {result.docUrl && (
                    <a
                      href={result.docUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 bg-[#09254D] text-white text-sm font-medium py-2.5 rounded-xl text-center hover:bg-[#0a2f61] transition-colors"
                    >
                      📄 Abrir no Google Docs
                    </a>
                  )}
                  <button onClick={resetUpload} className="flex-1 border border-slate-200 text-slate-600 text-sm rounded-xl py-2.5 hover:bg-slate-50">
                    Nova ata
                  </button>
                </div>

                {processedSteps.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-slate-400 hover:text-slate-600">Ver detalhes do processamento</summary>
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                      <ProcessingStatus steps={processedSteps} />
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-gradient-to-br from-[#09254D] to-[#4E378C] rounded-2xl p-5 text-white">
            <h3 className="font-semibold text-sm mb-3">Como funciona</h3>
            <div className="space-y-2.5">
              {[
                { icon: "🎙️", text: "Upload do áudio da reunião" },
                { icon: "📝", text: "Whisper transcreve em português" },
                { icon: "🤖", text: "GPT-4o gera ata estruturada" },
                { icon: "📄", text: "Google Doc criado automaticamente" },
                { icon: "✅", text: "Tasks extraídas para o ClickUp" },
                { icon: "📢", text: "Resumo enviado no Discord/Gmail" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2.5 text-sm text-white/90">
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Meetings List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">Atas Recentes</h2>
            <span className="text-sm text-slate-400">{meetings.length} atas</span>
          </div>

          {loadingMeetings ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[#4E378C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium text-slate-600">Nenhuma ata gerada ainda</p>
              <p className="text-sm text-slate-400 mt-1">Faça o upload de uma gravação para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map(meeting => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
