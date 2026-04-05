/**
 * POST /api/members/onboard
 * Dispara o onboarding automatizado para um membro.
 * Chamado pelo Supabase webhook (auth.users INSERT) ou manualmente.
 *
 * Body: { memberId: string }  — ou "all" para re-onboarding em lote
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleMemberJoined } from "@/lib/automations/handlers/member-joined";
import { eventBus } from "@/lib/events/event-bus";

// Registra handler no event bus (idempotente via singleton)
eventBus.on("MEMBER_JOINED", handleMemberJoined as (payload: unknown) => Promise<void>);

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("organization_id, rank")
    .eq("id", user.id)
    .single();

  if (!callerProfile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const allowedRanks = ["dept_leader", "director", "president"];
  if (!allowedRanks.includes(callerProfile.rank)) {
    return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
  }

  const body = await req.json() as { memberId: string };
  if (!body.memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  const admin = createAdminClient();

  // Busca perfil do membro
  const { data: memberProfile } = await admin
    .from("profiles")
    .select("id, full_name, email, rank, department, discord_id, organization_id")
    .eq("id", body.memberId)
    .eq("organization_id", callerProfile.organization_id)
    .single();

  if (!memberProfile) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

  // Busca nome da org
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", callerProfile.organization_id)
    .single();

  // Dispara evento em background
  const payload = {
    memberId: memberProfile.id,
    memberName: memberProfile.full_name ?? "Novo Membro",
    memberEmail: memberProfile.email ?? "",
    memberDiscordId: memberProfile.discord_id ?? undefined,
    orgId: callerProfile.organization_id,
    orgName: org?.name ?? "Sua EJ",
    rank: memberProfile.rank,
    department: memberProfile.department ?? undefined,
  };

  // Responde imediatamente, onboarding roda em background
  eventBus.emit("MEMBER_JOINED", payload).catch((err: unknown) => {
    console.error("[Onboard] Event bus error:", err);
  });

  return NextResponse.json({
    success: true,
    message: `Onboarding de ${payload.memberName} disparado em background`,
    member: {
      id: memberProfile.id,
      name: payload.memberName,
      rank: memberProfile.rank,
    },
  });
}
