/**
 * PATCH /api/members/[id]/role
 * Body: { rank: string; department?: string }
 * Permite alterar cargo/departamento de um membro.
 *
 * Permissões:
 *   - dept_leader: pode promover dentro do próprio dept (até assessor)
 *   - director: pode promover até project_leader em qualquer dept
 *   - president: pode promover qualquer cargo
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventBus } from "@/lib/events/event-bus";

const RANK_ORDER: Record<string, number> = {
  trainee: 1, assessor: 2, project_leader: 3,
  dept_leader: 4, director: 5, president: 6,
};

const MAX_PROMOTE_TO: Record<string, string> = {
  dept_leader: "assessor",
  director:    "project_leader",
  president:   "president",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabase
    .from("profiles")
    .select("organization_id, rank, department")
    .eq("id", user.id)
    .single();

  if (!caller || (RANK_ORDER[caller.rank] ?? 0) < RANK_ORDER.dept_leader) {
    return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
  }

  const body = await req.json() as { rank?: string; department?: string };
  if (!body.rank && !body.department) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  if (body.rank) {
    const maxRank = MAX_PROMOTE_TO[caller.rank];
    if (maxRank && (RANK_ORDER[body.rank] ?? 0) > (RANK_ORDER[maxRank] ?? 0)) {
      return NextResponse.json({
        error: `Você pode promover membros até o cargo de ${maxRank}`,
      }, { status: 403 });
    }
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, full_name, rank, department, organization_id")
    .eq("id", params.id)
    .eq("organization_id", caller.organization_id)
    .single();

  if (!target) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

  // dept_leader só pode mudar membros do próprio departamento
  if (caller.rank === "dept_leader" && target.department !== caller.department) {
    return NextResponse.json({ error: "Você só pode gerenciar membros do seu departamento" }, { status: 403 });
  }

  const updates: Record<string, string> = {};
  if (body.rank) updates.rank = body.rank;
  if (body.department) updates.department = body.department;

  const { data: updated, error } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
