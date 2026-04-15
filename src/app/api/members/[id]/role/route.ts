/**
 * PATCH /api/members/[id]/role
 * Body: { rank: string; department?: string }
 * Permite alterar cargo/departamento de um membro.
 *
 * Permissões:
 *   - dept_leader: pode promover dentro do próprio dept (até assessor)
 *   - director: pode promover até project_leader em qualquer dept
 *   - president: pode promover qualquer cargo
 *
 * Regras adicionais de segurança:
 *   - ninguém pode alterar o próprio cargo por aqui
 *   - ninguém abaixo de president pode editar alguém do mesmo nível ou superior
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventBus } from "@/lib/events/event-bus";

interface CallerProfileRow {
  organization_id: string;
  rank: string;
  department: string | null;
}

interface TargetProfileRow {
  id: string;
  full_name: string | null;
  rank: string;
  department: string | null;
  organization_id: string;
}

const RANK_ORDER: Record<string, number> = {
  trainee: 1,
  assessor: 2,
  project_leader: 3,
  dept_leader: 4,
  director: 5,
  president: 6,
};

const MAX_PROMOTE_TO: Record<string, string> = {
  dept_leader: "assessor",
  director: "project_leader",
  president: "president",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.id === params.id) {
    return NextResponse.json(
      { error: "Use as configurações de perfil para editar sua própria conta" },
      { status: 403 }
    );
  }

  const { data: callerRow } = await supabase
    .from("profiles")
    .select("organization_id, rank, department")
    .eq("id", user.id)
    .single();
  const caller = callerRow as CallerProfileRow | null;

  if (!caller || (RANK_ORDER[caller.rank] ?? 0) < RANK_ORDER.dept_leader) {
    return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
  }

  const body = (await req.json()) as { rank?: string; department?: string };
  if (!body.rank && body.department === undefined) {
    return NextResponse.json(
      { error: "Nenhum campo para atualizar" },
      { status: 400 }
    );
  }

  if (body.rank && !(body.rank in RANK_ORDER)) {
    return NextResponse.json({ error: "Cargo inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: targetRow } = await admin
    .from("profiles")
    .select("id, full_name, rank, department, organization_id")
    .eq("id", params.id)
    .eq("organization_id", caller.organization_id)
    .single();
  const target = targetRow as TargetProfileRow | null;

  if (!target) {
    return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  }

  const callerLevel = RANK_ORDER[caller.rank] ?? 0;
  const targetLevel = RANK_ORDER[target.rank] ?? 0;

  if (caller.rank !== "president" && targetLevel >= callerLevel) {
    return NextResponse.json(
      {
        error:
          "Você só pode gerenciar membros com cargo inferior ao seu.",
      },
      { status: 403 }
    );
  }

  // dept_leader só pode mudar membros do próprio departamento
  if (caller.rank === "dept_leader" && target.department !== caller.department) {
    return NextResponse.json(
      { error: "Você só pode gerenciar membros do seu departamento" },
      { status: 403 }
    );
  }

  if (
    caller.rank === "dept_leader" &&
    body.department !== undefined &&
    body.department !== caller.department
  ) {
    return NextResponse.json(
      {
        error:
          "Líderes de diretoria só podem manter membros no próprio departamento.",
      },
      { status: 403 }
    );
  }

  if (body.rank) {
    const maxRank = MAX_PROMOTE_TO[caller.rank];
    if (
      maxRank &&
      (RANK_ORDER[body.rank] ?? 0) > (RANK_ORDER[maxRank] ?? 0)
    ) {
      return NextResponse.json(
        { error: `Você pode promover membros até o cargo de ${maxRank}` },
        { status: 403 }
      );
    }
  }

  const updates: Record<string, string> = {};
  if (body.rank) updates.rank = body.rank;
  if (body.department !== undefined) updates.department = body.department;

  const { data: updated, error } = await admin
    .from("profiles")
    .update(updates as never)
    .eq("id", params.id)
    .eq("organization_id", caller.organization_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Emite evento de mudança de cargo
  eventBus.emit("MEMBER_ROLE_CHANGED", {
    memberId: params.id,
    memberName: target.full_name,
    oldRank: target.rank,
    newRank: body.rank ?? target.rank,
    department: body.department ?? target.department,
    orgId: caller.organization_id,
    changedBy: user.id,
  }).catch(console.error);

  return NextResponse.json({ success: true, member: updated });
}
