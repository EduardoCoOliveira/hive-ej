/**
 * GET /api/integracoes/status
 * Retorna o status de conexão de todas as integrações da organização.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export interface IntegrationStatus {
  provider: string;
  connected: boolean;
  connectedAt?: string;
  connectedBy?: string;
  scopes?: string[];
  expiresAt?: string;
  workspaceName?: string;
  error?: string;
}

export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const { data: integrations } = await supabase
    .from("org_integrations")
    .select("provider, connected_at, connected_by, scopes, expires_at, workspace_name")
    .eq("org_id", profile.organization_id);

  const PROVIDERS = ["google_workspace", "discord", "clickup", "notion", "miro"];
  const statusMap: Record<string, IntegrationStatus> = {};

  for (const p of PROVIDERS) {
    statusMap[p] = { provider: p, connected: false };
  }

  for (const row of integrations ?? []) {
    const expired =
      row.expires_at ? new Date(row.expires_at) < new Date() : false;
    statusMap[row.provider] = {
      provider: row.provider,
      connected: !expired,
      connectedAt: row.connected_at,
      connectedBy: row.connected_by,
      scopes: row.scopes,
      expiresAt: row.expires_at,
      workspaceName: row.workspace_name,
    };
  }

  return NextResponse.json({ integrations: Object.values(statusMap) });
}
