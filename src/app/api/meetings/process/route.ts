/**
 * POST /api/meetings/process
 *
 * Recebe um arquivo de áudio (multipart/form-data) e processa:
 *   1. Transcreve com Whisper
 *   2. Gera ata com GPT-4o
 *   3. Cria Google Doc
 *   4. Cria tasks no ClickUp
 *   5. Notifica Discord / Gmail
 *
 * Form fields:
 *   audio      — arquivo de áudio (mp3/mp4/webm/m4a/wav)
 *   title?     — título da reunião
 *   projectId? — ID do projeto associado
 *   participants? — JSON array de nomes
 *
 * Permissões: qualquer membro autenticado
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { processMeetingAudio } from "@/services/meetings/transcription.service";

// Limite de 100MB para arquivos de áudio
export const maxDuration = 300; // 5 minutos timeout para Vercel

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const title = formData.get("title") as string | null;
    const projectId = formData.get("projectId") as string | null;
    const participantsRaw = formData.get("participants") as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: "Campo 'audio' obrigatório" }, { status: 400 });
    }

    // Valida tipo de arquivo
    const allowedTypes = ["audio/mpeg", "audio/mp4", "audio/webm", "audio/wav", "audio/ogg", "video/mp4"];
    if (!allowedTypes.includes(audioFile.type) && !audioFile.name.match(/\.(mp3|mp4|m4a|webm|wav|ogg)$/i)) {
      return NextResponse.json({
        error: "Formato de áudio não suportado. Use MP3, MP4, M4A, WebM, WAV ou OGG."
      }, { status: 400 });
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    let participants: string[] | undefined;
    if (participantsRaw) {
      try { participants = JSON.parse(participantsRaw); } catch { /* ignora */ }
    }

    const { minutes, docUrl, results } = await processMeetingAudio({
      audioBuffer,
      audioFileName: audioFile.name,
      orgId: profile.organization_id,
      projectId: projectId ?? undefined,
      uploadedBy: user.id,
      title: title ?? undefined,
      participants,
    });

    return NextResponse.json({
      success: true,
      minutes: {
        title: minutes.title,
        date: minutes.date,
        participants: minutes.participants,
        summary: minutes.summary,
        decisions: minutes.decisions,
        actionItems: minutes.actionItems,
        nextSteps: minutes.nextSteps,
      },
      docUrl,
      processing: {
        steps: results.map(r => ({ step: r.step, ok: r.ok, error: r.error })),
        successCount: results.filter(r => r.ok).length,
        totalSteps: results.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API/meetings/process]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/meetings/process?projectId=...&limit=20&offset=0
 * Lista atas gravadas (alias para /api/meetings/list)
 */
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const params = req.nextUrl.searchParams;
  const projectId = params.get("projectId");
  const limit = Math.min(parseInt(params.get("limit") ?? "20"), 50);
  const offset = parseInt(params.get("offset") ?? "0");

  let query = supabase
    .from("meeting_minutes")
    .select("id, title, meeting_date, participants, summary, next_steps, doc_url, project_id, created_at")
    .eq("organization_id", profile.organization_id)
    .order("meeting_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (projectId) query = query.eq("project_id", projectId);

  const { data: meetings, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meetings });
}
