import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProjectAutomation } from "@/lib/automations/project-automation";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(2),
  client_name: z.string().min(2),
  value: z.number().min(0),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  // IDs de integrações externas (opcionais)
  clickup_list_id: z.string().optional(),
  notion_parent_id: z.string().optional(),
});

/** GET /api/projetos — lista projetos da organização */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const perPage = parseInt(url.searchParams.get("per_page") ?? "20");

  let query = supabase
    .from("projects")
    .select(`
      *,
      allocations:project_allocations(
        id, role_in_project, hours_per_week,
        user:profiles(id, full_name, avatar_url)
      )
    `, { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data,
    total: count,
    page,
    per_page: perPage,
    has_more: (count ?? 0) > page * perPage,
  });
}

/** POST /api/projetos — cria projeto + dispara automações */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Busca org + integrações
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, full_name, organization:organizations(name, plan_tier)")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  // Cria o projeto no banco
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      ...parsed.data,
      organization_id: profile.organization_id,
      created_by: user.id,
      status: "prospecting",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Dispara automações em background (sem bloquear a resposta) ──
  const automation = new ProjectAutomation(profile.organization_id, supabase);
  automation.onProjectCreated(project, profile.full_name).catch((err) =>
    console.error("[automation] onProjectCreated failed:", err)
  );

  return NextResponse.json({ data: project }, { status: 201 });
}
