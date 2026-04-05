/**
 * Hïve — ClickUp Expert Ranking Service
 *
 * Rastreia conclusão de tarefas por categoria.
 * Quando um membro atinge 10 tarefas em uma categoria → badge automático.
 * O Hïve passa a sugerir esse membro para projetos da mesma categoria.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { eventBus } from "@/lib/events/event-bus";
import type { TaskCompletedPayload, ExpertIdentifiedPayload } from "@/lib/events/payloads";

// Mapeamento de categorias de tarefas → skills do Hïve
const TASK_CATEGORY_MAP: Record<string, string> = {
  "design":         "Design",
  "ui":             "Design",
  "ux":             "Design",
  "dev":            "Desenvolvimento Web",
  "desenvolvimento":"Desenvolvimento Web",
  "frontend":       "Desenvolvimento Web",
  "backend":        "Desenvolvimento Web",
  "mobile":         "Desenvolvimento Mobile",
  "dados":          "Análise de Dados",
  "data":           "Análise de Dados",
  "gestão":         "Gestão de Projetos",
  "gerenciamento":  "Gestão de Projetos",
  "marketing":      "Marketing Digital",
  "vendas":         "Vendas",
  "financeiro":     "Consultoria Financeira",
  "rh":             "Consultoria de RH",
  "estratégia":     "Consultoria Estratégica",
};

const EXPERT_THRESHOLD = 10; // Tarefas para ganhar badge

interface CategoryStat {
  category: string;
  count: number;
  onTimeCount: number;
  avgDaysToComplete: number;
}

/**
 * Processa uma tarefa concluída:
 * 1. Incrementa o contador da categoria para o membro
 * 2. Verifica se atingiu o threshold de especialista
 * 3. Se sim, dispara o evento EXPERT_IDENTIFIED
 */
export async function processTaskCompleted(payload: TaskCompletedPayload): Promise<void> {
  const supabase = createAdminClient();

  // Resolve member from email
  const { data: member } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("email", payload.assigneeEmail)
    .eq("org_id", payload.orgId)
    .single();

  if (!member) {
    console.debug(`[RankingService] Member not found for email ${payload.assigneeEmail}`);
    return;
  }

  // Map task category to Hïve skill
  const categoryKey = Object.keys(TASK_CATEGORY_MAP).find((key) =>
    payload.taskCategory.toLowerCase().includes(key)
  );
  const skillCategory = categoryKey ? TASK_CATEGORY_MAP[categoryKey] : payload.taskCategory;

  // Upsert task completion record
  await supabase.rpc("increment_member_task_count", {
    p_member_id: member.id,
    p_org_id: payload.orgId,
    p_category: skillCategory,
    p_on_time: payload.completedOnTime,
    p_early: payload.completedEarly,
  });

  // Check if expert threshold reached
  const { data: stats } = await supabase
    .from("member_task_stats")
    .select("category, count, on_time_count")
    .eq("member_id", member.id)
    .eq("org_id", payload.orgId)
    .eq("category", skillCategory)
    .single();

  if (stats && stats.count >= EXPERT_THRESHOLD) {
    // Check if badge already exists
    const { data: existingBadge } = await supabase
      .from("member_badges")
      .select("id")
      .eq("member_id", member.id)
      .eq("category", skillCategory)
      .single();

    if (!existingBadge) {
      // Award new badge
      const badgeName = getBadgeName(skillCategory, stats.count);

      await supabase.from("member_badges").insert({
        member_id: member.id,
        org_id: payload.orgId,
        category: skillCategory,
        badge_name: badgeName,
        task_count: stats.count,
        earned_at: new Date().toISOString(),
      });

      // Emit expert event → triggers Discord message + points
      await eventBus.emit<ExpertIdentifiedPayload>("EXPERT_IDENTIFIED", {
        orgId: payload.orgId,
        userId: member.id,
        userName: member.full_name,
        category: skillCategory,
        taskCount: stats.count,
        badgeName,
      });

      console.info(`[RankingService] 🏆 Expert badge "${badgeName}" awarded to ${member.full_name}`);
    }
  }

  // Distribute points for task completion
  const points = getTaskPoints(payload);
  if (points !== 0) {
    await eventBus.emit("POINTS_AWARDED", {
      orgId: payload.orgId,
      userId: member.id,
      userName: member.full_name,
      amount: points,
      reason: points > 0
        ? `Tarefa concluída${payload.completedEarly ? " com antecedência" : ""}: ${payload.taskName}`
        : `Tarefa concluída com atraso: ${payload.taskName}`,
      sourceEvent: "TASK_COMPLETED",
      projectId: payload.projectId,
    });
  }
}

/**
 * Retorna os top membros especialistas para uma categoria de skill.
 * Usado pelo Smart Match para priorizar especialistas comprovados.
 */
export async function getTopExpertsByCategory(
  orgId: string,
  skillCategory: string,
  limit: number = 5
): Promise<{ memberId: string; fullName: string; taskCount: number; onTimeRate: number }[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("member_task_stats")
    .select(`
      member_id,
      count,
      on_time_count,
      profiles!inner(full_name)
    `)
    .eq("org_id", orgId)
    .ilike("category", `%${skillCategory}%`)
    .order("count", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    memberId: row.member_id,
    fullName: (row.profiles as { full_name: string }).full_name,
    taskCount: row.count,
    onTimeRate: row.count > 0 ? row.on_time_count / row.count : 0,
  }));
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getBadgeName(category: string, taskCount: number): string {
  if (taskCount >= 50) return `Mestre em ${category}`;
  if (taskCount >= 25) return `Especialista em ${category}`;
  return `Expert em ${category}`;
}

function getTaskPoints(payload: TaskCompletedPayload): number {
  if (payload.completedEarly) return 15;
  if (payload.completedOnTime) return 10;
  return -5; // Late
}
