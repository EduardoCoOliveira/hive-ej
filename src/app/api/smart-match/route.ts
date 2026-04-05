/**
 * POST /api/smart-match
 * Algoritmo de Alocação Inteligente: cruza skills + disponibilidade no Calendar + histórico ClickUp.
 * Score = skillMatch×0.60 + availability×0.25 + experience×0.15
 * Top 5 retornados + justificativa GPT-4o para o #1.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { findBestMeetingSlots } from "@/services/google/calendar.service";
import { getTopExpertsByCategory } from "@/services/clickup/ranking.service";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requiredSkills, hoursPerWeek = 10, projectId } = await req.json();
  if (!requiredSkills?.length) {
    return NextResponse.json({ error: "requiredSkills is required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  const orgId = profile.organization_id;

  // 1. Get all active members with their skills
  const { data: members } = await supabase
    .from("profiles")
    .select(`
      id, full_name, email, rank, avatar_url, discord_id, google_calendar_id,
      skills:member_skills(skill_id, level, skills(name))
    `)
    .eq("organization_id", orgId)
    .eq("is_active", true);

  if (!members?.length) return NextResponse.json({ suggestions: [] });

  // 2. Score each member
  const scoredMembers = await Promise.all(
    members.map(async (member) => {
      // ── Skill Score (60%) ──────────────────────────────────────────────
      const memberSkillNames = (member.skills as Array<{ level: number; skills: { name: string } | null }>)
        .filter((s) => s.skills)
        .map((s) => ({ name: s.skills!.name.toLowerCase(), level: s.level }));

      let skillMatchPoints = 0;
      let maxSkillPoints = 0;

      for (const required of requiredSkills) {
        const reqLower = required.toLowerCase();
        maxSkillPoints += 5;
        const found = memberSkillNames.find((s) =>
          s.name.includes(reqLower) || reqLower.includes(s.name)
        );
        skillMatchPoints += found ? found.level : 0;
      }

      const skillScore = maxSkillPoints > 0 ? skillMatchPoints / maxSkillPoints : 0;

      // ── Experience Score (15%) ─────────────────────────────────────────
      const { data: completedAllocations } = await supabase
        .from("project_allocations")
        .select("project_id, projects!inner(status)")
        .eq("user_id", member.id)
        .eq("projects.status", "completed");

      const experienceScore = Math.min((completedAllocations?.length ?? 0) / 10, 1);

      // ── Availability Score (25%) ───────────────────────────────────────
      // Simplified: check if they have calendar connected; if not, assume 0.7
      let availabilityScore = 0.7;
      if (member.google_calendar_id) {
        const slots = await findBestMeetingSlots(
          orgId,
          [{ id: member.id, fullName: member.full_name, email: member.email,
             role: member.rank, googleCalendarId: member.google_calendar_id,
             skills: [], completedProjects: completedAllocations?.length ?? 0 }],
          hoursPerWeek * 60,
          5
        ).catch(() => []);
        availabilityScore = slots.length > 0 ? slots[0].availabilityPercent / 100 : 0.5;
      }

      const totalScore = skillScore * 0.60 + availabilityScore * 0.25 + experienceScore * 0.15;

      return {
        memberId: member.id,
        memberName: member.full_name,
        avatarUrl: member.avatar_url,
        score: totalScore,
        skillScore,
        availabilityScore,
        experienceScore,
      };
    })
  );

  // 3. Sort and take top 5
  const top5 = scoredMembers
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // 4. GPT-4o justification for #1
  if (top5.length > 0 && process.env.OPENAI_API_KEY) {
    try {
      const best = top5[0];
      const bestMember = members.find((m) => m.id === best.memberId);
      const skillList = (bestMember?.skills as Array<{ level: number; skills: { name: string } | null }>)
        ?.filter((s) => s.skills && s.level > 0)
        .map((s) => `${s.skills!.name} (nível ${s.level})`)
        .join(", ");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.5,
        messages: [{
          role: "user",
          content: `Em 2-3 frases em português, justifique por que ${best.memberName} é a melhor escolha para um projeto que requer: ${requiredSkills.join(", ")}.
          Habilidades do membro: ${skillList || "não especificadas"}.
          Score: ${Math.round(best.score * 100)}/100 (skills: ${Math.round(best.skillScore * 100)}, disponibilidade: ${Math.round(best.availabilityScore * 100)}, experiência: ${Math.round(best.experienceScore * 100)}).
          Seja específico e direto.`,
        }],
        max_tokens: 200,
      });

      top5[0].justification = completion.choices[0].message.content ?? undefined;
    } catch {
      // Non-critical — justification is a bonus
    }
  }

  return NextResponse.json({ suggestions: top5 });
}
