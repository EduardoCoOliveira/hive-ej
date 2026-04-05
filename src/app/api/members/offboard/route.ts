/**
 * POST /api/members/offboard
 * Body: { memberId: string; reason?: string }
 *
 * Permissões: director ou president apenas.
 * Revoga todos os acessos do membro em background e retorna imediatamente.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventBus } from "@/lib/events/event-bus";
import { registerAllHandlers } from "@/lib/automations/register-handlers";

// Garante que MEMBER_LEFT handler está registrado
registerAllHandlers().catch(console.error);

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabase
    .from("profiles")
    .select("organization_id, rank")
    .eq("id", user.id)
    .single();

  if (!caller || !["director", "president"].includes(caller.rank)) {
    return NextResponse.json({ error: "Apenas Diretores e Presidentes podem realizar offboarding" }, { status: 403 });
  }

  const body = await req.json() as { memberId: string; reason?: string };
  if (!body.memberId) return NextResponse.json({ error: "memberId obrigatório" }, { status: 400 });

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("profiles")
    .select("id, full_name, email, rank, discord_id, organization_id")
    .eq("id", body.memberId)
    .eq("organization_id", caller.organization_id)
    .single();

  if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

  // Não pode fazer offboarding do presidente
  if (member.rank === "president" && caller.rank !== "president") {
    return NextResponse.json({ error: "Não é possível remover o Presidente" }, { status: 403 });
  }

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", caller.organization_id)
    .single();

  // Dispara em background — responde imediatamente
  eventBus.emit("MEMBER_LEFT", {
    memberId: member.id,
    memberName: member.full_name ?? "Membro",
    memberEmail: member.email ?? "",
    memberDiscordId: member.discord_id ?? undefined,
    orgId: caller.organization_id,
    orgName: org?.name ?? "Sua EJ",
    rank: member.rank,
    triggeredBy: user.id,
    reason: body.reason,
  }).catch(console.error);

  return NextResponse.json({
    success: true,
    message: `Offboarding de ${member.full_name} iniciado. Acessos sendo revogados em background.`,
    member: { id: member.id, name: member.full_name, rank: member.rank },
  });
}
