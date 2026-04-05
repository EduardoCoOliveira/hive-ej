/**
 * ─────────────────────────────────────────────────────────────
 *  Hïve Score Service
 *  Índice de saúde 0-100 por projeto. Composto por:
 *
 *  Fórmula:
 *    score = taskCompletion(30) + timeline(25) + sentiment(20)
 *            + engagement(15) + deliveryRisk(10)
 *
 *  Ranges de qualidade:
 *    90-100 → Excelente  🟢
 *    70-89  → Bom        🟡
 *    50-69  → Atenção    🟠
 *    0-49   → Crítico    🔴
 * ─────────────────────────────────────────────────────────────
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface HiveScoreBreakdown {
  total: number;
  grade: "excellent" | "good" | "attention" | "critical";
  components: {
    taskCompletion: number;   // 0-30
    timeline: number;         // 0-25
    sentiment: number;        // 0-20
    engagement: number;       // 0-15
    deliveryRisk: number;     // 0-10
  };
  insights: string[];
}

// ─── Grade helper ────────────────────────────────────────────

function toGrade(score: number): HiveScoreBreakdown["grade"] {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "attention";
  return "critical";
}

// ─── Main calculation ────────────────────────────────────────

export async function calculateHiveScore(
  projectId: string
): Promise<HiveScoreBreakdown> {
  const admin = createAdminClient();
  const insights: string[] = [];

  // ── 1. Task Completion (30 pts) ──────────────────────────
  // Busca tasks do ClickUp via external_ids ou member_task_stats
  const { data: project } = await admin
    .from("projects")
    .select("id, status, start_date, end_date, external_ids, enabled_integrations, leader_id")
    .eq("id", projectId)
    .single();

  // Task completion via member_task_stats (proxy para tasks completadas por projeto)
  const { data: allocations } = await admin
    .from("project_allocations")
    .select("member_id")
    .eq("project_id", projectId);

  const memberIds = (allocations ?? []).map((a) => a.member_id);

  // Total de tasks completadas pela equipe no projeto
  const { data: taskStats } = await admin
    .from("member_task_stats")
    .select("task_count")
    .in("member_id", memberIds.length > 0 ? memberIds : ["__none__"]);

  const totalTasksDone = (taskStats ?? []).reduce((sum, t) => sum + t.task_count, 0);
  const expectedTasksPerMember = 5; // baseline por membro por projeto
  const expectedTotal = Math.max(memberIds.length * expectedTasksPerMember, 1);
  const taskRatio = Math.min(totalTasksDone / expectedTotal, 1);
  const taskScore = Math.round(taskRatio * 30);

  if (taskRatio < 0.5) insights.push("⚠️ Menos de 50% das tarefas esperadas concluídas");
  if (taskRatio >= 1) insights.push("✅ Meta de tarefas atingida");

  // ── 2. Timeline (25 pts) ─────────────────────────────────
  let timelineScore = 25; // começa em 25 e desconta
  const now = new Date();
  const startDate = project?.start_date ? new Date(project.start_date) : null;
  const endDate = project?.end_date ? new Date(project.end_date) : null;

  if (startDate && endDate && endDate > startDate) {
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    const progressRatio = Math.min(Math.max(elapsed / totalDuration, 0), 1);
    const taskProgressRatio = taskRatio;

    // Se tarefas estão atrasadas em relação ao tempo decorrido
    const delay = progressRatio - taskProgressRatio;
    if (delay > 0.3) {
      timelineScore = Math.max(0, 25 - Math.round(delay * 40));
      insights.push(`🕐 Projeto ${Math.round(delay * 100)}% atrasado em relação ao cronograma`);
    }
    if (endDate < now && project?.status !== "completed") {
      timelineScore = Math.max(0, timelineScore - 10);
      insights.push("🔴 Data de entrega ultrapassada");
    }
  } else {
    timelineScore = 15; // sem datas definidas = penalidade parcial
    insights.push("📅 Datas do projeto não definidas");
  }

  // ── 3. Sentiment (20 pts) ────────────────────────────────
  const { data: sentimentLogs } = await admin
    .from("discord_sentiment_log")
    .select("sentiment, score, analyzed_at")
    .eq("project_id", projectId)
    .order("analyzed_at", { ascending: false })
    .limit(10);

  let sentimentScore = 15; // neutro por padrão

  if (sentimentLogs && sentimentLogs.length > 0) {
    const avgScore =
      sentimentLogs.reduce((sum, s) => sum + s.score, 0) / sentimentLogs.length;
    // score varia de -1 a 1 → mapeia para 0-20
    sentimentScore = Math.round(((avgScore + 1) / 2) * 20);
    if (avgScore < -0.3) insights.push("😟 Sentimento da equipe preocupante");
    if (avgScore > 0.5) insights.push("😊 Equipe com sentimento positivo");
  } else {
    insights.push("💬 Nenhuma análise de sentimento ainda");
  }

  // ── 4. Engagement (15 pts) ───────────────────────────────
  // Mede atividade recente: point_transactions nos últimos 30 dias
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: recentPoints } = await admin
    .from("point_transactions")
    .select("id")
    .in("member_id", memberIds.length > 0 ? memberIds : ["__none__"])
    .gte("created_at", thirtyDaysAgo);

  const activityCount = recentPoints?.length ?? 0;
  const engagementRatio = Math.min(activityCount / Math.max(memberIds.length * 3, 1), 1);
  const engagementScore = Math.round(engagementRatio * 15);

  if (engagementRatio < 0.3) insights.push("📉 Baixa atividade da equipe nos últimos 30 dias");
  if (engagementRatio >= 0.8) insights.push("🔥 Equipe muito ativa");

  // ── 5. Delivery Risk (10 pts) ────────────────────────────
  let deliveryRisk = 10;
  if (!project?.enabled_integrations) {
    deliveryRisk -= 3;
    insights.push("🔌 Integrações não configuradas");
  }
  if (memberIds.length < 2) {
    deliveryRisk -= 5;
    insights.push("👤 Projeto com menos de 2 membros alocados");
  }
  if (!project?.leader_id) {
    deliveryRisk -= 5;
    insights.push("🎯 Sem líder definido para o projeto");
  }
  deliveryRisk = Math.max(0, deliveryRisk);

  // ── Total ────────────────────────────────────────────────
  const total = Math.min(
    taskScore + timelineScore + sentimentScore + engagementScore + deliveryRisk,
    100
  );

  // ── Persist to DB ────────────────────────────────────────
  await admin
    .from("projects")
    .update({ hive_score: total })
    .eq("id", projectId);

  if (total >= 90) insights.unshift("🌟 Projeto saudável — mantendo excelência");
  else if (total < 50) insights.unshift("🚨 Projeto em zona crítica — ação imediata necessária");

  return {
    total,
    grade: toGrade(total),
    components: {
      taskCompletion: taskScore,
      timeline: timelineScore,
      sentiment: sentimentScore,
      engagement: engagementScore,
      deliveryRisk,
    },
    insights,
  };
}

/**
 * Calcula e persiste o Hïve Score de TODOS os projetos ativos de uma organização.
 * Retorna um mapa projectId → score para relatórios.
 */
export async function calculateOrgHiveScores(
  orgId: string
): Promise<Record<string, number>> {
  const admin = createAdminClient();

  const { data: projects } = await admin
    .from("projects")
    .select("id")
    .eq("organization_id", orgId)
    .in("status", ["active", "paused"]);

  const result: Record<string, number> = {};
  const promises = (projects ?? []).map(async (p) => {
    const breakdown = await calculateHiveScore(p.id);
    result[p.id] = breakdown.total;
  });

  await Promise.allSettled(promises);
  return result;
}
