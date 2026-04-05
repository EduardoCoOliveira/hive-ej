/**
 * Hïve — Atomic Initiation API
 * POST /api/atomic
 *
 * O endpoint mais importante do sistema.
 * Um único submit inicia toda a cadeia de automações cross-platform.
 *
 * Mesh Thinking em ação:
 * PROJECT_CREATED → [Drive] → [Discord] → [ClickUp] → [Notion] → [Miro] → [Calendar] → [GPT-4o]
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventBus } from "@/lib/events/event-bus";
import type { ProjectCreatedPayload, EnabledIntegrations } from "@/lib/events/payloads";

// Lazy import of handlers (prevents cold-start issues)
async function registerHandlers() {
  const { onProjectCreated } = await import("@/lib/automations/handlers/project-created");
  eventBus.on("PROJECT_CREATED", onProjectCreated);
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const admin = createAdminClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Permission check — only project_leader and above can create projects
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, rank, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  const ALLOWED_RANKS = ["project_leader", "dept_leader", "director", "president"];
  if (!ALLOWED_RANKS.includes(profile.rank)) {
    return NextResponse.json(
      { error: "Apenas líderes de projeto ou superiores podem criar projetos" },
      { status: 403 }
    );
  }

  let body: {
    name: string;
    clientName: string;
    clientEmail?: string;
    clientContext?: string;
    value: number;
    startDate?: string;
    endDate?: string;
    requiredSkills?: string[];
    estimatedHours?: number;
    status?: string;
    description?: string;
    scope?: string;
    enabledIntegrations?: Partial<EnabledIntegrations>;
    autoAllocate?: boolean;
    scheduleKickoff?: boolean;
    teamMemberIds?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.name?.trim() || !body.clientName?.trim() || !body.value) {
    return NextResponse.json(
      { error: "name, clientName e value são obrigatórios" },
      { status: 400 }
    );
  }

  const enabledIntegrations: EnabledIntegrations = {
    googleDrive:    body.enabledIntegrations?.googleDrive    ?? true,
    googleDocs:     body.enabledIntegrations?.googleDocs     ?? true,
    googleCalendar: body.enabledIntegrations?.googleCalendar ?? true,
    discord:        body.enabledIntegrations?.discord        ?? true,
    clickup:        body.enabledIntegrations?.clickup        ?? true,
    notion:         body.enabledIntegrations?.notion         ?? true,
    miro:           body.enabledIntegrations?.miro           ?? false,
  };

  // ── STEP 1: Create project in Supabase (source of truth first) ──────────
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: body.name.trim(),
      client_name: body.clientName.trim(),
      status: body.status ?? "prospecting",
      value: body.value,
      start_date: body.startDate ?? null,
      end_date: body.endDate ?? null,
      description: body.description?.trim() ?? null,
      scope: body.scope?.trim() ?? null,
      required_skills: body.requiredSkills ?? [],
      estimated_hours: body.estimatedHours ?? null,
      client_context: body.clientContext?.trim() ?? null,
      leader_id: profile.id,
      enabled_integrations: enabledIntegrations,
    })
    .select("id, name, status")
    .single();

  if (projectError || !project) {
    console.error("[AtomicAPI] Failed to create project:", projectError);
    return NextResponse.json(
      { error: "Falha ao criar projeto no banco de dados" },
      { status: 500 }
    );
  }

  // ── STEP 2: Add initial team members ────────────────────────────────────
  const teamMemberIds = [profile.id, ...(body.teamMemberIds ?? [])];
  if (teamMemberIds.length > 0) {
    await admin.from("project_allocations").insert(
      teamMemberIds.map((userId) => ({
        project_id: project.id,
        user_id: userId,
        role_in_project: userId === profile.id ? "Líder de Projeto" : null,
        hours_per_week: 10,
      }))
    );
  }

  // ── STEP 3: Load team profiles for automations ───────────────────────────
  const { data: teamProfiles } = await admin
    .from("profiles")
    .select("id, full_name, email, rank, avatar_url, discord_id, google_calendar_id")
    .in("id", teamMemberIds);

  const team = (teamProfiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    role: p.rank,
    avatarUrl: p.avatar_url,
    discordId: p.discord_id,
    googleCalendarId: p.google_calendar_id,
    skills: [],
    completedProjects: 0,
  }));

  // ── STEP 4: Log initiation start ─────────────────────────────────────────
  await admin.from("audit_logs").insert({
    org_id: profile.organization_id,
    user_id: profile.id,
    action: "project.atomic_initiation.started",
    resource_type: "project",
    resource_id: project.id,
    metadata: {
      projectName: body.name,
      enabledIntegrations,
      teamSize: team.length,
    },
  }).catch(() => {});

  // ── STEP 5: Respond immediately, run automations in background ───────────
  // This is the key pattern: don't make the user wait for all integrations.
  // The project exists in the DB. Everything else is best-effort.

  const payload: ProjectCreatedPayload = {
    projectId: project.id,
    orgId: profile.organization_id,
    project: {
      name: body.name.trim(),
      slug: body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      clientName: body.clientName.trim(),
      clientEmail: body.clientEmail,
      clientContext: body.clientContext ?? "",
      value: body.value,
      startDate: body.startDate,
      endDate: body.endDate,
      requiredSkills: body.requiredSkills ?? [],
      estimatedHours: body.estimatedHours,
    },
    team,
    leaderId: profile.id,
    enabledIntegrations,
    autoAllocate: body.autoAllocate ?? false,
    scheduleKickoff: body.scheduleKickoff ?? false,
  };

  // Fire and forget — register handlers and emit event asynchronously
  registerHandlers().then(() => {
    eventBus.emit("PROJECT_CREATED", payload).catch((err) => {
      console.error("[AtomicAPI] Event emission failed:", err);
    });
  });

  // Return immediately with project ID so frontend can redirect
  return NextResponse.json({
    success: true,
    projectId: project.id,
    projectName: project.name,
    message: "Projeto criado! Iniciando automações em segundo plano...",
    enabledIntegrations,
  });
}
