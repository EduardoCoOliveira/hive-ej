/**
 * POST /api/atomic/retrigger
 * Reaciona a Iniciação Atômica para um projeto que não passou pelo fluxo original.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventBus } from "@/lib/events/event-bus";
import { DEFAULT_INTEGRATIONS } from "@/lib/events/payloads";
import type { ProjectCreatedPayload } from "@/lib/events/payloads";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await req.json();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, rank, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const { data: project } = await admin
    .from("projects")
    .select(`
      *, allocations:project_allocations(
        user:profiles(id, full_name, email, rank, discord_id, google_calendar_id)
      )
    `)
    .eq("id", projectId)
    .eq("org_id", profile.organization_id)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const team = (project.allocations as Array<{ user: {
    id: string; full_name: string; email: string; rank: string;
    discord_id: string | null; google_calendar_id: string | null;
  } }>)?.map((a) => ({
    id: a.user.id,
    fullName: a.user.full_name,
    email: a.user.email,
    role: a.user.rank,
    discordId: a.user.discord_id ?? undefined,
    googleCalendarId: a.user.google_calendar_id ?? undefined,
    skills: [],
    completedProjects: 0,
  })) ?? [];

  const enabledIntegrations = (project.enabled_integrations as typeof DEFAULT_INTEGRATIONS) ?? DEFAULT_INTEGRATIONS;

  const payload: ProjectCreatedPayload = {
    projectId: project.id,
    orgId: profile.organization_id,
    project: {
      name: project.name,
      slug: project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      clientName: project.client_name,
      clientContext: project.client_context ?? "",
      value: project.value,
      startDate: project.start_date ?? undefined,
      endDate: project.end_date ?? undefined,
      requiredSkills: project.required_skills ?? [],
      estimatedHours: project.estimated_hours ?? undefined,
    },
    team,
    leaderId: project.leader_id ?? profile.id,
    enabledIntegrations,
    autoAllocate: false,
    scheduleKickoff: false,
  };

  // Re-register handler and re-emit
  const { onProjectCreated } = await import("@/lib/automations/handlers/project-created");
  eventBus.on("PROJECT_CREATED", onProjectCreated);
  eventBus.emit("PROJECT_CREATED", payload).catch(console.error); // background

  return NextResponse.json({
    success: true,
    message: "Automações disparadas em segundo plano",
    projectId,
  });
}
