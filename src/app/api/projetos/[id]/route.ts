import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProjectAutomation } from "@/lib/automations/project-automation";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  client_name: z.string().optional(),
  status: z.enum(["prospecting","proposal","negotiation","active","completed","cancelled"]).optional(),
  value: z.number().min(0).optional(),
  description: z.string().optional(),
  nps_score: z.number().min(0).max(10).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

/** GET /api/projetos/:id */
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      allocations:project_allocations(
        *, user:profiles(id, full_name, avatar_url, role)
      ),
      documents(id, type, status, title, pdf_url, created_at)
    `)
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({ data });
}

/** PATCH /api/projetos/:id — atualiza + dispara automação se mudar status */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Busca estado atual
  const { data: old } = await supabase.from("projects").select("status, organization_id").eq("id", params.id).single();
  const statusChanged = parsed.data.status && parsed.data.status !== old?.status;

  const { data: project, error } = await supabase
    .from("projects")
    .update(parsed.data)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Automações por mudança de status
  if (statusChanged && old?.organization_id) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    const automation = new ProjectAutomation(old.organization_id, supabase);

    if (parsed.data.status === "active") {
      automation.onProjectActivated(project, profile?.full_name ?? "").catch(console.error);
    }
    if (parsed.data.status === "completed") {
      automation.onProjectCompleted(project, profile?.full_name ?? "").catch(console.error);
    }
  }

  return NextResponse.json({ data: project });
}

/** DELETE /api/projetos/:id */
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { error } = await supabase.from("projects").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
