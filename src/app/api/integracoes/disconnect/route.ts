/**
 * POST /api/integracoes/disconnect
 * Desconecta uma integração da organização.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await req.json();
  if (!provider) return NextResponse.json({ error: "provider required" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, rank")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  // Only directors/presidents can disconnect integrations
  const allowedRanks = ["director", "president"];
  if (!allowedRanks.includes(profile.rank)) {
    return NextResponse.json(
      { error: "Apenas Diretores e Presidentes podem gerenciar integrações" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("org_integrations")
    .delete()
    .eq("org_id", profile.organization_id)
    .eq("provider", provider);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, provider });
}
