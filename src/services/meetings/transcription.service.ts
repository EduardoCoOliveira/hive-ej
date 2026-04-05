/**
 * Meeting Minutes AI Service
 *
 * Pipeline:
 *   1. OpenAI Whisper  — transcreve o áudio (mp3/mp4/webm/m4a)
 *   2. GPT-4o          — gera ata estruturada em PT-BR
 *   3. Google Docs     — cria documento formatado na pasta do projeto
 *   4. ClickUp         — cria tasks a partir dos action items extraídos
 *   5. Discord / Gmail — envia resumo dos próximos passos
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getDecryptedToken } from "@/lib/integrations/token-vault";
import OpenAI from "openai";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessMeetingOptions {
  audioBuffer: Buffer;
  audioFileName: string;   // e.g. "reuniao-2024-01-15.mp3"
  orgId: string;
  projectId?: string;
  uploadedBy: string;      // userId
  title?: string;
  participants?: string[];
}

export interface MeetingMinutes {
  title: string;
  date: string;
  duration?: string;
  participants: string[];
  summary: string;
  decisions: Decision[];
  actionItems: ActionItem[];
  nextSteps: string;
  rawTranscript: string;
}

export interface Decision {
  topic: string;
  decision: string;
  owner?: string;
}

export interface ActionItem {
  description: string;
  assignee?: string;
  deadline?: string;
  priority: "urgent" | "high" | "normal" | "low";
  clickupTaskId?: string;
}

interface StepResult { step: string; ok: boolean; data?: unknown; error?: string; }

async function runStep(name: string, fn: () => Promise<unknown>): Promise<StepResult> {
  try {
    const data = await fn();
    console.log(`[Minutes] ✅ ${name}`);
    return { step: name, ok: true, data };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`[Minutes] ⚠️ ${name}: ${error}`);
    return { step: name, ok: false, error };
  }
}

async function getOrgToken(orgId: string, provider: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_integrations")
    .select("access_token")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .single();
  if (!data) return null;
  return getDecryptedToken(data.access_token);
}

// ─── Step 1: Transcrição com Whisper ─────────────────────────────────────────

export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string
): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Whisper aceita File object — criamos um Blob
  const blob = new Blob([audioBuffer], { type: getMimeType(fileName) });
  const file = new File([blob], fileName, { type: getMimeType(fileName) });

  const response = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "pt",
    response_format: "text",
  });

  return response as unknown as string;
}

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    m4a: "audio/mp4",
    webm: "audio/webm",
    wav: "audio/wav",
    ogg: "audio/ogg",
  };
  return map[ext ?? ""] ?? "audio/mpeg";
}

// ─── Step 2: Geração da Ata com GPT-4o ───────────────────────────────────────

export async function generateMinutes(
  transcript: string,
  options: { title?: string; participants?: string[]; orgName: string }
): Promise<MeetingMinutes> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `Você é um assistente especializado em gerar atas de reunião estruturadas para empresas juniores brasileiras.
Analise a transcrição fornecida e gere uma ata completa e bem formatada em português brasileiro.
Retorne APENAS um JSON válido com a estrutura exata especificada, sem markdown ou texto adicional.`;

  const userPrompt = `Organização: ${options.orgName}
Título sugerido: ${options.title ?? "Reunião"}
Participantes mencionados: ${options.participants?.join(", ") ?? "extrair da transcrição"}

TRANSCRIÇÃO:
${transcript}

Gere a ata no seguinte formato JSON:
{
  "title": "título da reunião",
  "date": "data no formato DD/MM/YYYY (hoje se não mencionado)",
  "duration": "duração estimada da reunião",
  "participants": ["lista de participantes mencionados"],
  "summary": "resumo executivo de 2-3 parágrafos",
  "decisions": [
    {
      "topic": "tema da decisão",
      "decision": "descrição da decisão tomada",
      "owner": "responsável pela decisão (se mencionado)"
    }
  ],
  "actionItems": [
    {
      "description": "descrição clara da tarefa",
      "assignee": "responsável (se mencionado)",
      "deadline": "prazo no formato DD/MM/YYYY (se mencionado)",
      "priority": "urgent|high|normal|low"
    }
  ],
  "nextSteps": "parágrafo com os próximos passos mais importantes (máx 3 itens)"
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as MeetingMinutes;
  parsed.rawTranscript = transcript;
  return parsed;
}

// ─── Step 3: Criar Google Docs ───────────────────────────────────────────────

export async function createMeetingDoc(
  minutes: MeetingMinutes,
  orgId: string,
  projectName?: string
): Promise<{ docId: string; docUrl: string } | null> {
  const token = await getOrgToken(orgId, "google_workspace");
  if (!token) return null;

  // Cria o documento via Google Docs API
  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: `📋 ${minutes.title} — ${minutes.date}` }),
  });

  if (!createRes.ok) throw new Error(`Google Docs create failed: ${createRes.status}`);
  const doc = await createRes.json() as { documentId: string };
  const docId = doc.documentId;

  // Conteúdo estruturado da ata
  const decisionsText = minutes.decisions.map((d, i) =>
    `${i + 1}. ${d.topic}\n   Decisão: ${d.decision}${d.owner ? `\n   Responsável: ${d.owner}` : ""}`
  ).join("\n\n");

  const actionItemsText = minutes.actionItems.map((a, i) =>
    `${i + 1}. ${a.description}${a.assignee ? ` (@${a.assignee})` : ""}${a.deadline ? ` — Prazo: ${a.deadline}` : ""}${a.priority !== "normal" ? ` [${a.priority.toUpperCase()}]` : ""}`
  ).join("\n");

  const fullContent = [
    `ATA DE REUNIÃO`,
    ``,
    `Título: ${minutes.title}`,
    `Data: ${minutes.date}`,
    minutes.duration ? `Duração: ${minutes.duration}` : "",
    `Participantes: ${minutes.participants.join(", ")}`,
    projectName ? `Projeto: ${projectName}` : "",
    ``,
    `─────────────────────────────────────────`,
    ``,
    `RESUMO EXECUTIVO`,
    ``,
    minutes.summary,
    ``,
    `─────────────────────────────────────────`,
    ``,
    `DECISÕES TOMADAS`,
    ``,
    decisionsText || "Nenhuma decisão formal registrada.",
    ``,
    `─────────────────────────────────────────`,
    ``,
    `ACTION ITEMS`,
    ``,
    actionItemsText || "Nenhum action item identificado.",
    ``,
    `─────────────────────────────────────────`,
    ``,
    `PRÓXIMOS PASSOS`,
    ``,
    minutes.nextSteps,
    ``,
    `─────────────────────────────────────────`,
    ``,
    `TRANSCRIÇÃO COMPLETA`,
    ``,
    minutes.rawTranscript,
  ].filter(l => l !== undefined).join("\n");

  // Insere conteúdo no documento
  await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: fullContent,
          },
        },
        // Formata o título principal
        {
          updateParagraphStyle: {
            range: { startIndex: 1, endIndex: 16 }, // "ATA DE REUNIÃO\n"
            paragraphStyle: { namedStyleType: "HEADING_1" },
            fields: "namedStyleType",
          },
        },
      ],
    }),
  });

  return {
    docId,
    docUrl: `https://docs.google.com/document/d/${docId}/edit`,
  };
}

// ─── Step 4: Criar Tasks no ClickUp ──────────────────────────────────────────

export async function createClickUpTasks(
  actionItems: ActionItem[],
  orgId: string,
  projectName?: string
): Promise<ActionItem[]> {
  const token = await getOrgToken(orgId, "clickup");
  if (!token || actionItems.length === 0) return actionItems;

  const teamsRes = await fetch("https://api.clickup.com/api/v2/team", {
    headers: { Authorization: token },
  });
  const teams = await teamsRes.json() as { teams: Array<{ id: string }> };
  const teamId = teams.teams?.[0]?.id;
  if (!teamId) return actionItems;

  const priorityMap: Record<string, number> = {
    urgent: 1, high: 2, normal: 3, low: 4,
  };

  const enriched = await Promise.all(
    actionItems.map(async (item) => {
      try {
        const dueDate = item.deadline
          ? new Date(item.deadline.split("/").reverse().join("-")).getTime()
          : undefined;

        const res = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/task`, {
          method: "POST",
          headers: { Authorization: token, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.description,
            description: `Extraído automaticamente da ata de reunião${projectName ? ` — ${projectName}` : ""}`,
            status: "to do",
            priority: priorityMap[item.priority] ?? 3,
            due_date: dueDate,
            tags: ["ata-reuniao", ...(projectName ? [projectName.toLowerCase()] : [])],
          }),
        });

        if (res.ok) {
          const task = await res.json() as { id: string };
          return { ...item, clickupTaskId: task.id };
        }
      } catch {
        // falha silenciosa por item
      }
      return item;
    })
  );

  return enriched;
}

// ─── Step 5: Notificar via Discord / Gmail ────────────────────────────────────

export async function notifyMeetingResults(
  minutes: MeetingMinutes,
  docUrl: string,
  orgId: string,
  options: {
    projectId?: string;
    uploaderEmail?: string;
    discordChannelId?: string;
  }
): Promise<void> {
  const admin = createAdminClient();
  const results: StepResult[] = [];

  // Discord notification
  results.push(await runStep("discord_minutes_notification", async () => {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) return { skipped: "no bot token" };

    let channelId = options.discordChannelId;

    // Se não especificado, busca canal do projeto
    if (!channelId && options.projectId) {
      const { data } = await admin
        .from("projects")
        .select("discord_channel_id")
        .eq("id", options.projectId)
        .single();
      channelId = data?.discord_channel_id;
    }

    // Fallback: canal geral de gestão
    if (!channelId) {
      const { data: channels } = await admin
        .from("discord_role_channels")
        .select("channel_id")
        .eq("organization_id", orgId)
        .in("rank", ["director", "president"])
        .limit(1);
      channelId = channels?.[0]?.channel_id;
    }

    if (!channelId) return { skipped: "no channel found" };

    const tasksCreated = minutes.actionItems.filter(a => a.clickupTaskId).length;

    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: `📋 Ata Gerada — ${minutes.title}`,
          description: minutes.nextSteps,
          color: 0x41C5C6,
          fields: [
            { name: "📅 Data", value: minutes.date, inline: true },
            { name: "👥 Participantes", value: `${minutes.participants.length} pessoa(s)`, inline: true },
            { name: "✅ Tasks criadas no ClickUp", value: `${tasksCreated}/${minutes.actionItems.length}`, inline: true },
            {
              name: "📌 Decisões",
              value: minutes.decisions.slice(0, 3).map(d => `• ${d.topic}: ${d.decision}`).join("\n") || "Nenhuma",
            },
            {
              name: "🔗 Documento completo",
              value: `[Abrir no Google Docs](${docUrl})`,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "Hïve — Ata Automática" },
        }],
      }),
    });

    return { notified: true, channelId };
  }));

  // Gmail notification para o uploader
  results.push(await runStep("gmail_minutes_email", async () => {
    if (!options.uploaderEmail) return { skipped: "no uploader email" };
    const token = await getOrgToken(orgId, "google_workspace");
    if (!token) return { skipped: "no google_workspace" };

    const actionItemsHtml = minutes.actionItems.map(a =>
      `<li style="margin-bottom:8px">
        <strong>${a.description}</strong>
        ${a.assignee ? ` — <em>${a.assignee}</em>` : ""}
        ${a.deadline ? ` <span style="color:#64748b;font-size:12px">(${a.deadline})</span>` : ""}
        ${a.priority === "urgent" ? ' <span style="background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:4px;font-size:11px">URGENTE</span>' : ""}
        ${a.clickupTaskId ? ' <span style="background:#dcfce7;color:#16a34a;padding:2px 6px;border-radius:4px;font-size:11px">✅ ClickUp</span>' : ""}
      </li>`
    ).join("");

    const html = `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#09254D,#4E378C);padding:28px 32px;border-radius:16px 16px 0 0">
        <h1 style="color:#fff;font-size:20px;margin:0">📋 Ata de Reunião Gerada</h1>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:14px">Hïve — Transcrição Automática</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px">
        <h2 style="color:#09254D;font-size:18px">${minutes.title}</h2>
        <p style="color:#64748b;font-size:14px">📅 ${minutes.date}${minutes.duration ? ` · ⏱️ ${minutes.duration}` : ""} · 👥 ${minutes.participants.join(", ")}</p>

        <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:20px 0">
          <h3 style="color:#09254D;font-size:15px;margin:0 0 12px">Resumo</h3>
          <p style="color:#475569;line-height:1.6;margin:0">${minutes.summary}</p>
        </div>

        ${minutes.actionItems.length > 0 ? `
        <h3 style="color:#09254D;font-size:15px">Action Items (${minutes.actionItems.length})</h3>
        <ul style="color:#475569;padding-left:20px;line-height:1.8">${actionItemsHtml}</ul>
        ` : ""}

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:20px 0">
          <h3 style="color:#166534;font-size:14px;margin:0 0 8px">🚀 Próximos Passos</h3>
          <p style="color:#166534;margin:0;font-size:14px">${minutes.nextSteps}</p>
        </div>

        <a href="${docUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#09254D,#4E378C);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px">
          📄 Abrir Documento Completo →
        </a>
      </div>
    </div>`;

    const message = [
      `To: ${options.uploaderEmail}`,
      `Subject: 📋 Ata: ${minutes.title} — ${minutes.date}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      html,
    ].join("\r\n");

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(message).toString("base64url") }),
    });

    return { sent: res.ok };
  }));

  const ok = results.filter(r => r.ok).length;
  console.log(`[Minutes] Notificações: ${ok}/${results.length} ✅`);
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function processMeetingAudio(options: ProcessMeetingOptions): Promise<{
  minutes: MeetingMinutes;
  docUrl?: string;
  results: StepResult[];
}> {
  const admin = createAdminClient();
  const results: StepResult[] = [];

  // Busca info da org
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", options.orgId)
    .single();

  // Busca info do projeto se fornecido
  let projectName: string | undefined;
  let discordChannelId: string | undefined;
  if (options.projectId) {
    const { data: proj } = await admin
      .from("projects")
      .select("name, discord_channel_id")
      .eq("id", options.projectId)
      .single();
    projectName = proj?.name;
    discordChannelId = proj?.discord_channel_id;
  }

  // Busca email do uploader
  const { data: uploader } = await admin
    .from("profiles")
    .select("email")
    .eq("id", options.uploadedBy)
    .single();

  // ── 1. Transcrição ────────────────────────────────────────
  let transcript = "";
  const transcribeStep = await runStep("whisper_transcription", async () => {
    transcript = await transcribeAudio(options.audioBuffer, options.audioFileName);
    return { chars: transcript.length };
  });
  results.push(transcribeStep);
  if (!transcribeStep.ok) throw new Error("Transcription failed: " + transcribeStep.error);

  // ── 2. Geração da ata ─────────────────────────────────────
  let minutes!: MeetingMinutes;
  const minutesStep = await runStep("gpt4o_minutes", async () => {
    minutes = await generateMinutes(transcript, {
      title: options.title,
      participants: options.participants,
      orgName: org?.name ?? "EJ",
    });
    return { decisions: minutes.decisions.length, actionItems: minutes.actionItems.length };
  });
  results.push(minutesStep);
  if (!minutesStep.ok) throw new Error("Minutes generation failed: " + minutesStep.error);

  // ── 3. Google Docs ────────────────────────────────────────
  let docUrl: string | undefined;
  const docsStep = await runStep("google_docs_create", async () => {
    const doc = await createMeetingDoc(minutes, options.orgId, projectName);
    docUrl = doc?.docUrl;
    return doc ?? { skipped: "no google_workspace" };
  });
  results.push(docsStep);

  // ── 4. ClickUp tasks ──────────────────────────────────────
  const clickupStep = await runStep("clickup_tasks", async () => {
    minutes.actionItems = await createClickUpTasks(
      minutes.actionItems, options.orgId, projectName
    );
    const created = minutes.actionItems.filter(a => a.clickupTaskId).length;
    return { created, total: minutes.actionItems.length };
  });
  results.push(clickupStep);

  // ── 5. Notificações ───────────────────────────────────────
  if (docUrl) {
    await notifyMeetingResults(minutes, docUrl, options.orgId, {
      projectId: options.projectId,
      uploaderEmail: uploader?.email,
      discordChannelId,
    });
  }

  // ── 6. Salva no banco ─────────────────────────────────────
  await runStep("save_to_db", async () => {
    await admin.from("meeting_minutes").insert({
      organization_id: options.orgId,
      project_id: options.projectId ?? null,
      uploaded_by: options.uploadedBy,
      title: minutes.title,
      meeting_date: minutes.date,
      participants: minutes.participants,
      transcript: minutes.rawTranscript,
      summary: minutes.summary,
      decisions: minutes.decisions,
      action_items: minutes.actionItems,
      next_steps: minutes.nextSteps,
      doc_url: docUrl ?? null,
      processing_steps: results,
    });
    return { saved: true };
  });

  console.log(`[Minutes] Processamento completo — ${results.filter(r => r.ok).length}/${results.length} etapas ✅`);

  return { minutes, docUrl, results };
}
