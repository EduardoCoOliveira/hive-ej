/**
 * ─────────────────────────────────────────────────────────────
 *  Weekly Report Service
 *  Gera e envia relatório semanal da EJ via Gmail.
 *
 *  Conteúdo do relatório:
 *    - Resumo executivo (GPT-4o)
 *    - Projetos ativos com Hïve Score
 *    - Tarefas em atraso
 *    - Top performers (pontos)
 *    - Alertas de sentimento
 *    - Próximos passos sugeridos
 *
 *  Destinatários: Diretores + Presidentes da organização
 * ─────────────────────────────────────────────────────────────
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { calculateOrgHiveScores } from "@/services/hive-score/score.service";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface WeeklyReportData {
  orgName: string;
  period: string;
  activeProjects: number;
  completedThisWeek: number;
  totalRevenuePipeline: number;
  avgHiveScore: number;
  projects: ProjectSummary[];
  topPerformers: { name: string; points: number }[];
  alerts: string[];
  aiSummary: string;
  nextActions: string[];
}

interface ProjectSummary {
  id: string;
  name: string;
  client: string;
  status: string;
  hiveScore: number | null;
  daysToDeadline: number | null;
  value: number | null;
}

// ─── Build report data ───────────────────────────────────────

export async function buildWeeklyReport(orgId: string): Promise<WeeklyReportData> {
  const admin = createAdminClient();

  // Organização
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const period = `${weekAgo.toLocaleDateString("pt-BR")} – ${now.toLocaleDateString("pt-BR")}`;

  // Projetos ativos
  const { data: projects } = await admin
    .from("projects")
    .select("id, name, client_name, status, value, end_date, hive_score")
    .eq("organization_id", orgId)
    .in("status", ["active", "paused"]);

  const activeProjects = projects ?? [];

  // Recalcula scores em background
  const scores = await calculateOrgHiveScores(orgId);
  const avgScore =
    Object.values(scores).length > 0
      ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length)
      : 0;

  // Projetos completados essa semana
  const { data: completed } = await admin
    .from("projects")
    .select("id")
    .eq("organization_id", orgId)
    .eq("status", "completed")
    .gte("updated_at", weekAgo.toISOString());

  // Pipeline de receita
  const totalRevenue = activeProjects.reduce((sum, p) => sum + (p.value ?? 0), 0);

  // Top performers (pontos na semana)
  const { data: topPoints } = await admin
    .from("point_transactions")
    .select("member_id, points")
    .eq("organization_id", orgId)
    .gte("created_at", weekAgo.toISOString());

  const pointMap: Record<string, number> = {};
  for (const tx of topPoints ?? []) {
    pointMap[tx.member_id] = (pointMap[tx.member_id] ?? 0) + tx.points;
  }

  const topMemberIds = Object.entries(pointMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id]) => id);

  const { data: topProfiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", topMemberIds.length > 0 ? topMemberIds : ["__none__"]);

  const topPerformers = topMemberIds.map((id) => ({
    name: topProfiles?.find((p) => p.id === id)?.full_name ?? "Membro",
    points: pointMap[id] ?? 0,
  }));

  // Alertas de sentimento
  const { data: sentimentAlerts } = await admin
    .from("discord_sentiment_log")
    .select("project_id, sentiment")
    .in("sentiment", ["negative", "concerned"])
    .gte("analyzed_at", weekAgo.toISOString());

  const alerts: string[] = [];
  for (const alert of sentimentAlerts ?? []) {
    const proj = activeProjects.find((p) => p.id === alert.project_id);
    if (proj) {
      alerts.push(
        alert.sentiment === "negative"
          ? `🔴 Sentimento negativo detectado em "${proj.name}"`
          : `🟡 Sentimento preocupante em "${proj.name}"`
      );
    }
  }

  // Projetos com score crítico
  for (const [projId, score] of Object.entries(scores)) {
    if (score < 50) {
      const proj = activeProjects.find((p) => p.id === projId);
      if (proj) alerts.push(`🚨 Hïve Score crítico (${score}/100) em "${proj.name}"`);
    }
  }

  // Projetos com deadline próximo (< 7 dias)
  for (const p of activeProjects) {
    if (p.end_date) {
      const days = Math.ceil(
        (new Date(p.end_date).getTime() - now.getTime()) / 86400000
      );
      if (days <= 7 && days > 0) {
        alerts.push(`⏰ "${p.name}" entrega em ${days} dias`);
      }
    }
  }

  // Project summaries
  const projectSummaries: ProjectSummary[] = activeProjects.map((p) => ({
    id: p.id,
    name: p.name,
    client: p.client_name ?? "—",
    status: p.status,
    hiveScore: scores[p.id] ?? p.hive_score,
    daysToDeadline: p.end_date
      ? Math.ceil((new Date(p.end_date).getTime() - now.getTime()) / 86400000)
      : null,
    value: p.value,
  }));

  // ── GPT-4o Executive Summary ────────────────────────────
  const prompt = `Você é o assistente executivo da EJ "${org?.name}".
Gere um resumo semanal executivo em português brasileiro com base nos dados:

PERÍODO: ${period}
PROJETOS ATIVOS: ${activeProjects.length}
COMPLETADOS ESSA SEMANA: ${completed?.length ?? 0}
PIPELINE DE RECEITA: R$ ${totalRevenue.toLocaleString("pt-BR")}
HÏVE SCORE MÉDIO: ${avgScore}/100

PROJETOS:
${projectSummaries.map((p) => `- ${p.name} (${p.client}): Score ${p.hiveScore ?? "N/A"}/100, deadline em ${p.daysToDeadline ?? "?"} dias`).join("\n")}

ALERTAS: ${alerts.length > 0 ? alerts.join("; ") : "Nenhum"}

TOP PERFORMERS: ${topPerformers.map((t) => `${t.name} (${t.points} pts)`).join(", ") || "N/A"}

Escreva 2-3 parágrafos objetivos (máx 150 palavras total) cobrindo: situação geral, principais riscos e uma recomendação de foco para a semana.`;

  let aiSummary = "Resumo automático não disponível.";
  let nextActions: string[] = [];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.5,
    });
    aiSummary = completion.choices[0]?.message?.content ?? aiSummary;

    // Sugestões de próximos passos
    const actionsCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `Com base nos dados abaixo, liste EXATAMENTE 3 próximos passos prioritários para a diretoria da EJ "${org?.name}" nessa semana. Formato: lista com 3 itens curtos (máx 10 palavras cada).

${aiSummary}

Alertas: ${alerts.join("; ") || "nenhum"}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.4,
    });
    const raw = actionsCompletion.choices[0]?.message?.content ?? "";
    nextActions = raw.split("\n").filter((l) => l.trim()).slice(0, 3);
  } catch (err) {
    console.error("[WeeklyReport] OpenAI error:", err);
  }

  return {
    orgName: org?.name ?? "Sua EJ",
    period,
    activeProjects: activeProjects.length,
    completedThisWeek: completed?.length ?? 0,
    totalRevenuePipeline: totalRevenue,
    avgHiveScore: avgScore,
    projects: projectSummaries,
    topPerformers,
    alerts,
    aiSummary,
    nextActions,
  };
}

// ─── HTML Email Template ─────────────────────────────────────

export function buildEmailHTML(report: WeeklyReportData): string {
  const scoreColor =
    report.avgHiveScore >= 90
      ? "#41C5C6"
      : report.avgHiveScore >= 70
      ? "#FEC045"
      : report.avgHiveScore >= 50
      ? "#f97316"
      : "#ef4444";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:Inter,-apple-system,sans-serif;background:#f8fafc">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#09254D,#4E378C);padding:32px 40px">
    <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px">Hïve</div>
    <div style="color:rgba(255,255,255,0.7);font-size:14px;margin-top:4px">Relatório Semanal · ${report.period}</div>
    <div style="margin-top:20px;font-size:13px;color:rgba(255,255,255,0.6)">${report.orgName}</div>
  </div>

  <div style="padding:32px 40px">

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:32px">
      ${[
        { label: "Projetos Ativos", value: String(report.activeProjects) },
        { label: "Concluídos", value: String(report.completedThisWeek) },
        { label: "Pipeline", value: `R$ ${(report.totalRevenuePipeline / 1000).toFixed(0)}k` },
        { label: "Hïve Score", value: `${report.avgHiveScore}/100`, color: scoreColor },
      ]
        .map(
          (k) => `
      <div style="background:#f8fafc;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:${k.color ?? "#09254D"}">${k.value}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">${k.label}</div>
      </div>`
        )
        .join("")}
    </div>

    <!-- AI Summary -->
    <div style="background:#f0f9ff;border-left:4px solid #41C5C6;border-radius:0 12px 12px 0;padding:20px;margin-bottom:24px">
      <div style="font-size:12px;font-weight:600;color:#41C5C6;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">✨ Análise Executiva</div>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6">${report.aiSummary}</p>
    </div>

    <!-- Projects Table -->
    ${
      report.projects.length > 0
        ? `
    <h3 style="font-size:14px;font-weight:700;color:#09254D;margin:0 0 12px">Projetos em Andamento</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr style="background:#f8fafc">
        <th style="text-align:left;padding:8px 12px;font-size:11px;color:#94a3b8">Projeto</th>
        <th style="text-align:left;padding:8px 12px;font-size:11px;color:#94a3b8">Cliente</th>
        <th style="text-align:center;padding:8px 12px;font-size:11px;color:#94a3b8">Score</th>
        <th style="text-align:right;padding:8px 12px;font-size:11px;color:#94a3b8">Entrega</th>
      </tr>
      ${report.projects
        .map((p) => {
          const sc = p.hiveScore ?? 0;
          const col = sc >= 70 ? "#41C5C6" : sc >= 50 ? "#FEC045" : "#ef4444";
          return `
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:10px 12px;font-size:13px;color:#09254D;font-weight:600">${p.name}</td>
        <td style="padding:10px 12px;font-size:12px;color:#64748b">${p.client}</td>
        <td style="padding:10px 12px;text-align:center">
          <span style="background:${col}22;color:${col};font-weight:700;font-size:12px;padding:2px 8px;border-radius:20px">${sc}/100</span>
        </td>
        <td style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b">${
          p.daysToDeadline !== null
            ? p.daysToDeadline <= 0
              ? "<span style='color:#ef4444'>Vencido</span>"
              : `${p.daysToDeadline}d`
            : "—"
        }</td>
      </tr>`;
        })
        .join("")}
    </table>`
        : ""
    }

    <!-- Alerts -->
    ${
      report.alerts.length > 0
        ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin-bottom:24px">
      <div style="font-size:12px;font-weight:700;color:#ea580c;margin-bottom:8px">⚠️ ALERTAS</div>
      ${report.alerts.map((a) => `<div style="font-size:13px;color:#9a3412;margin-bottom:4px">${a}</div>`).join("")}
    </div>`
        : ""
    }

    <!-- Top Performers -->
    ${
      report.topPerformers.length > 0
        ? `
    <h3 style="font-size:14px;font-weight:700;color:#09254D;margin:0 0 12px">🏆 Top Performers da Semana</h3>
    <div style="display:flex;gap:12px;margin-bottom:24px">
      ${report.topPerformers
        .map(
          (p, i) => `
      <div style="flex:1;background:${["#FEC045", "#e2e8f0", "#cd7c2f"][i] ?? "#f8fafc"}22;border-radius:12px;padding:14px;text-align:center;border:1px solid ${["#FEC045", "#e2e8f0", "#cd7c2f"][i] ?? "#f8fafc"}44">
        <div style="font-size:18px">${["🥇", "🥈", "🥉"][i] ?? "⭐"}</div>
        <div style="font-size:13px;font-weight:600;color:#09254D;margin-top:4px">${p.name}</div>
        <div style="font-size:12px;color:#64748b">${p.points} pts</div>
      </div>`
        )
        .join("")}
    </div>`
        : ""
    }

    <!-- Next Actions -->
    ${
      report.nextActions.length > 0
        ? `
    <div style="background:linear-gradient(135deg,rgba(9,37,77,0.04),rgba(78,55,140,0.04));border:1px solid rgba(9,37,77,0.08);border-radius:12px;padding:20px">
      <div style="font-size:12px;font-weight:700;color:#4E378C;margin-bottom:10px">🎯 PRÓXIMOS PASSOS RECOMENDADOS</div>
      ${report.nextActions.map((a, i) => `<div style="font-size:13px;color:#334155;margin-bottom:6px"><strong>${i + 1}.</strong> ${a}</div>`).join("")}
    </div>`
        : ""
    }

  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center">
    <div style="font-size:11px;color:#94a3b8">Gerado automaticamente pelo Hïve · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard" style="color:#41C5C6;text-decoration:none">Abrir Dashboard</a></div>
  </div>
</div>
</body>
</html>`;
}

// ─── Gmail sender ────────────────────────────────────────────

export async function sendWeeklyReportEmail(
  orgId: string,
  recipientEmails: string[],
  report: WeeklyReportData
): Promise<{ sent: number; failed: number }> {
  const html = buildEmailHTML(report);
  const subject = `📊 Relatório Semanal Hïve — ${report.orgName} · ${report.period}`;

  // Usa Gmail API via fetch (não requer googleapis extra)
  const { getDecryptedToken } = await import("@/lib/integrations/token-vault");
  const admin = createAdminClient();

  const { data: integration } = await admin
    .from("org_integrations")
    .select("access_token")
    .eq("org_id", orgId)
    .eq("provider", "google_workspace")
    .single();

  if (!integration) {
    console.warn("[WeeklyReport] Google Workspace não conectado");
    return { sent: 0, failed: recipientEmails.length };
  }

  const accessToken = await getDecryptedToken(integration.access_token);
  let sent = 0;
  let failed = 0;

  for (const to of recipientEmails) {
    try {
      // RFC 2822 message
      const message = [
        `From: Hïve <noreply@hive.ej>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        html,
      ].join("\r\n");

      const encoded = Buffer.from(message).toString("base64url");

      const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: encoded }),
        }
      );

      if (res.ok) {
        sent++;
      } else {
        const err = await res.json() as { error?: { message?: string } };
        console.error(`[WeeklyReport] Failed to send to ${to}:`, err?.error?.message);
        failed++;
      }
    } catch (err) {
      console.error(`[WeeklyReport] Error sending to ${to}:`, err);
      failed++;
    }
  }

  return { sent, failed };
}
