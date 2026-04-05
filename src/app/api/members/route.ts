/**
 * GET  /api/members          — lista membros da org (filtros: dept, rank)
 * POST /api/members          — adiciona novo membro à org
 *
 * Permissões:
 *   - dept_leader: pode adicionar membros apenas no próprio departamento
 *   - director/president: podem adicionar em qualquer departamento
 *   - trainee/assessor/project_leader: somente leitura
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventBus } from "@/lib/events/event-bus";
import { registerAllHandlers } from "@/lib/automations/register-handlers";

// Hierarchy order for permission checks
const RANK_ORDER: Record<string, number> = {
  trainee: 1, assessor: 2, project_leader: 3,
  dept_leader: 4, director: 5, president: 6,
};

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabase
    .from("profiles")
    .select("organization_id, rank, department")
    .eq("id", user.id)
    .single();
  if (!caller) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const params = req.nextUrl.searchParams;
  const filterDept = params.get("department");
  const filterRank = params.get("rank");

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, rank, department, discord_id, skills, created_at, avatar_url")
    .eq("organization_id", caller.organization_id)
    .order("rank", { ascending: false })
    .order("full_name");

  // dept_leader only sees their own department by default
  if (caller.rank === "dept_leader" && !filterDept) {
    query = query.eq("department", caller.department ?? "");
  } else if (filterDept) {
    query = query.eq("department", filterDept);
  }
  if (filterRank) query = query.eq("rank", filterRank);

  const { data: members, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabase
    .from("profiles")
    .select("organization_id, rank, department, full_name")
    .eq("id", user.id)
    .single();
  if (!caller) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  // Apenas dept_leader+ podem adicionar membros
  if ((RANK_ORDER[caller.rank] ?? 0) < RANK_ORDER.dept_leader) {
    return NextResponse.json({ error: "Permissão insuficiente. Apenas líderes de diretoria ou superiores podem adicionar membros." }, { status: 403 });
  }

  const body = await req.json() as {
    email: string;
    fullName: string;
    rank: string;
    department?: string;
    discordId?: string;
    skills?: string[];
  };

  // Validação
  if (!body.email || !body.fullName || !body.rank) {
    return NextResponse.json({ error: "email, fullName e rank são obrigatórios" }, { status: 400 });
  }

  // dept_leader só pode adicionar no próprio departamento e com rank <= seu próprio
  if (caller.rank === "dept_leader") {
    if (body.department && body.department !== caller.department) {
      return NextResponse.json({ error: "Líderes de diretoria só podem adicionar membros no próprio departamento" }, { status: 403 });
    }
    if ((RANK_ORDER[body.rank] ?? 0) >= RANK_ORDER.dept_leader) {
      return NextResponse.json({ error: "Você não pode adicionar membros com cargo igual ou superior ao seu" }, { status: 403 });
    }
    body.department = caller.department ?? body.department;
  }

  const admin = createAdminClient();

  // Busca nome da org
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", caller.organization_id)
    .single();

  // Verifica se já existe um perfil com esse email
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", body.email)
    .eq("organization_id", caller.organization_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Já existe um membro com esse e-mail" }, { status: 409 });
  }

  // Cria o perfil — o usuário auth será criado quando ele fizer login pela primeira vez
  const { data: newProfile, error: insertError } = await admin
    .from("profiles")
    .insert({
      organization_id: caller.organization_id,
      full_name: body.fullName,
      email: body.email,
      rank: body.rank,
      department: body.department ?? null,
      discord_id: body.discordId ?? null,
      skills: body.skills ?? [],
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Dispara onboarding em background
  await registerAllHandlers();
  eventBus.emit("MEMBER_JOINED", {
    memberId: newProfile.id,
    memberName: body.fullName,
    memberEmail: body.email,
    memberDiscordId: body.discordId,
    orgId: caller.organization_id,
    orgName: org?.name ?? "Sua EJ",
    rank: body.rank,
    department: body.department,
  }).catch(console.error);

  return NextResponse.json({
    success: true,
    member: newProfile,
    message: `${body.fullName} adicionado(a) e onboarding disparado em background`,
  }, { status: 201 });
}
