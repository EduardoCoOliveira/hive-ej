// ═══════════════════════════════════════════════════════════════
//  Algoritmo de Alocação de Consultores
//
//  Score(membro, projeto) =
//    skill_match_score  × 0.60   (competências alinhadas)
//    + availability_score × 0.25   (horas livres via Calendar)
//    + experience_score   × 0.15   (projetos similares concluídos)
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCalendarAvailability } from "@/lib/integrations/google/calendar";
import { suggestAllocation } from "@/lib/integrations/openai/client";
import { getDecryptedToken } from "@/lib/integrations/token-vault";

export interface AllocationSuggestion {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  score: number;          // 0–100
  breakdown: {
    skillMatch: number;   // 0–100
    availability: number; // 0–100
    experience: number;   // 0–100
  };
  matchedSkills: string[];
  availableHoursPerWeek: number;
  aiJustification?: string;
}

export interface AllocationRequest {
  projectId: string;
  requiredSkillIds: string[];
  requiredHoursPerWeek: number;
  startDate: string;
  endDate?: string;
}

export async function suggestConsultants(
  request: AllocationRequest,
  orgId: string,
  supabase: SupabaseClient
): Promise<AllocationSuggestion[]> {
  // ── 1. Busca todos os membros ativos com suas competências ──
  const { data: members } = await supabase
    .from("profiles")
    .select(`
      id, full_name, avatar_url,
      skills:member_skills(
        level,
        skill:skills(id, name, category)
      )
    `)
    .eq("organization_id", orgId)
    .eq("is_active", true);

  if (!members?.length) return [];

  // ── 2. Busca nomes das skills requeridas ──
  const { data: requiredSkillRows } = await supabase
    .from("skills")
    .select("id, name")
    .in("id", request.requiredSkillIds);

  const requiredSkillNames = (requiredSkillRows ?? []).map((s) => s.name);
  const requiredSet = new Set(request.requiredSkillIds);

  // ── 3. Busca token Google para Calendar (se disponível) ──
  const { data: googleIntegration } = await supabase
    .from("integrations")
    .select("access_token_enc")
    .eq("organization_id", orgId)
    .eq("provider", "google")
    .eq("is_active", true)
    .single();

  let googleToken: string | null = null;
  if (googleIntegration) {
    googleToken = await getDecryptedToken(googleIntegration.access_token_enc);
  }

  // ── 4. Busca histórico de projetos por membro ──
  const { data: allocHistory } = await supabase
    .from("project_allocations")
    .select("user_id, project:projects(status)")
    .eq("projects.organization_id", orgId);

  const completedByMember: Record<string, number> = {};
  for (const alloc of allocHistory ?? []) {
    const proj = Array.isArray(alloc.project) ? alloc.project[0] : alloc.project;
    if (proj?.status === "completed") {
      completedByMember[alloc.user_id] = (completedByMember[alloc.user_id] ?? 0) + 1;
    }
  }

  // ── 5. Busca alocações atuais (horas ocupadas) ──
  const { data: currentAllocs } = await supabase
    .from("project_allocations")
    .select("user_id, hours_per_week, end_date")
    .or(`end_date.is.null,end_date.gte.${request.startDate}`);

  const busyHoursMap: Record<string, number> = {};
  for (const alloc of currentAllocs ?? []) {
    busyHoursMap[alloc.user_id] = (busyHoursMap[alloc.user_id] ?? 0) + alloc.hours_per_week;
  }

  // ── 6. Calcula score de cada membro ──
  const MAX_WEEKLY_HOURS = 20; // máximo razoável de horas/semana em EJ

  const suggestions: AllocationSuggestion[] = [];

  for (const member of members) {
    const memberSkills = (member.skills ?? []) as {
      level: number;
      skill: { id: string; name: string; category: string };
    }[];

    // SKILL MATCH SCORE (60%)
    const matchedSkills: string[] = [];
    let skillScore = 0;

    for (const ms of memberSkills) {
      if (requiredSet.has(ms.skill.id)) {
        matchedSkills.push(ms.skill.name);
        // Nível 1–5 → contribui proporcionalmente
        skillScore += (ms.level / 5) * (100 / Math.max(requiredSet.size, 1));
      }
    }
    skillScore = Math.min(100, skillScore);

    // AVAILABILITY SCORE (25%)
    const busyHours = busyHoursMap[member.id] ?? 0;
    const freeHours = Math.max(0, MAX_WEEKLY_HOURS - busyHours);
    let availabilityScore = Math.min(100, (freeHours / MAX_WEEKLY_HOURS) * 100);

    // Bonus: verifica Google Calendar se disponível
    if (googleToken) {
      try {
        const calAvailability = await getCalendarAvailability(
          googleToken,
          member.id,
          request.startDate,
          request.endDate ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
        );
        // Ajusta score com base em conflitos reais
        const conflictPenalty = Math.min(30, calAvailability.conflictCount * 5);
        availabilityScore = Math.max(0, availabilityScore - conflictPenalty);
      } catch {
        // Calendar não disponível para este membro, mantém score base
      }
    }

    // EXPERIENCE SCORE (15%)
    const completed = completedByMember[member.id] ?? 0;
    const experienceScore = Math.min(100, completed * 20); // 5 projetos = 100%

    // SCORE FINAL
    const finalScore =
      skillScore * 0.6 +
      availabilityScore * 0.25 +
      experienceScore * 0.15;

    // Filtra membros sem nenhuma skill relevante
    if (matchedSkills.length === 0 && requiredSet.size > 0) continue;

    suggestions.push({
      userId: member.id,
      userName: member.full_name,
      avatarUrl: member.avatar_url,
      score: Math.round(finalScore),
      breakdown: {
        skillMatch: Math.round(skillScore),
        availability: Math.round(availabilityScore),
        experience: Math.round(experienceScore),
      },
      matchedSkills,
      availableHoursPerWeek: Math.max(0, MAX_WEEKLY_HOURS - (busyHoursMap[member.id] ?? 0)),
    });
  }

  // ── 7. Ordena por score e pega top 5 ──
  const top5 = suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // ── 8. Enriquece com justificativa da IA (apenas para o top 5) ──
  if (top5.length > 0) {
    try {
      const { data: project } = await supabase
        .from("projects")
        .select("name, description")
        .eq("id", request.projectId)
        .single();

      const aiJustification = await suggestAllocation({
        projectDescription: project?.description ?? project?.name ?? "",
        requiredSkills: requiredSkillNames,
        availableMembers: top5.map((m) => ({
          name: m.userName,
          skills: m.matchedSkills,
          hoursPerWeek: m.availableHoursPerWeek,
        })),
      });

      // Atribui justificativa ao 1º lugar
      if (top5[0]) top5[0].aiJustification = aiJustification;
    } catch {
      // IA indisponível — retorna sem justificativa
    }
  }

  return top5;
}
