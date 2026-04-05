/**
 * POST /api/playbooks/generate
 * Gera um Playbook de Liderança via GPT-4o para uma etapa específica de projeto.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateLeaderPlaybook, type PlaybookStep } from "@/services/openai/playbook.service";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, step } = await req.json() as { projectId: string; step: PlaybookStep };
  if (!projectId || !step) {
    return NextResponse.json({ error: "projectId and step are required" }, { status: 400 });
  }

  // Load project + team context
  const { data: project } = await supabase
    .from("projects")
    .select(`
      name, client_name, client_context, value, start_date, end_date,
      required_skills, estimated_hours,
      leader:profiles!leader_id(full_name),
      allocations:project_allocations(user:profiles(full_name, rank))
    `)
    .eq("id", projectId)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const guide = await generateLeaderPlaybook(
    {
      projectName: project.name,
      clientName: project.client_name,
      clientContext: project.client_context ?? "",
      value: project.value,
      startDate: project.start_date ?? undefined,
      endDate: project.end_date ?? undefined,
      teamSize: (project.allocations as unknown[])?.length ?? 1,
      teamSkills: project.required_skills ?? [],
      leaderName: (project.leader as { full_name: string } | null)?.full_name ?? profile?.full_name ?? "Líder",
      completedProjects: 0,
      currentStatus: "active",
    },
    step
  );

  if (!guide) return NextResponse.json({ error: "Failed to generate playbook" }, { status: 500 });

  // Save to DB
  const { data: saved } = await supabase
    .from("playbooks")
    .insert({
      project_id: projectId,
      step,
      title: guide.title,
      content: guide,
    })
    .select("id")
    .single();

  return NextResponse.json({ id: saved?.id, ...guide });
}
