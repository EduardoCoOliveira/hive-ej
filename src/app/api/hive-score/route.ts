/**
 * POST /api/hive-score
 * Body: { projectId?: string }  — se omitido, calcula para todos da org
 *
 * GET  /api/hive-score?projectId=xxx  — retorna score salvo no DB
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { calculateHiveScore, calculateOrgHiveScores } from "@/services/hive-score/score.service";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  const projectId = req.nextUrl.searchParams.get("projectId");

  if (projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, hive_score")
      .eq("id", projectId)
      .eq("organization_id", profile!.organization_id)
      .single();

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ projectId, score: project.hive_score });
  }

  // Retorna scores de todos os projetos da org
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, hive_score, status")
    .eq("organization_id", profile!.organization_id)
    .in("status", ["active", "paused"]);

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { projectId?: string };

  if (body.projectId) {
    // Verifica que o projeto pertence à org
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", body.projectId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const breakdown = await calculateHiveScore(body.projectId);
    return NextResponse.json({ projectId: body.projectId, ...breakdown });
  }

  // Calcula para toda a org
  const scores = await calculateOrgHiveScores(profile.organization_id);
  return NextResponse.json({ scores });
}
