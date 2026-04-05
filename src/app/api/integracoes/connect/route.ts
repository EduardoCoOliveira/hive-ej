/**
 * GET /api/integracoes/connect?provider=discord|clickup|notion|google_workspace
 * Inicia o fluxo OAuth do provedor solicitado.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const OAUTH_CONFIGS: Record<
  string,
  { authUrl: string; scopes: string; callbackPath: string; clientIdEnv: string }
> = {
  discord: {
    authUrl: "https://discord.com/api/oauth2/authorize",
    scopes: "bot guilds identify email",
    callbackPath: "/api/auth/oauth/discord/callback",
    clientIdEnv: "DISCORD_CLIENT_ID",
  },
  clickup: {
    authUrl: "https://app.clickup.com/api",
    scopes: "",
    callbackPath: "/api/auth/oauth/clickup/callback",
    clientIdEnv: "CLICKUP_CLIENT_ID",
  },
  notion: {
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    scopes: "",
    callbackPath: "/api/auth/oauth/notion/callback",
    clientIdEnv: "NOTION_CLIENT_ID",
  },
  google_workspace: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/documents",
      "openid",
      "email",
      "profile",
    ].join(" "),
    callbackPath: "/api/auth/oauth/google-workspace/callback",
    clientIdEnv: "GOOGLE_CLIENT_ID",
  },
};

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const provider = req.nextUrl.searchParams.get("provider");
  if (!provider || !OAUTH_CONFIGS[provider]) {
    return NextResponse.json({ error: "Provider inválido" }, { status: 400 });
  }

  const config = OAUTH_CONFIGS[provider];
  const clientId = process.env[config.clientIdEnv];
  if (!clientId) {
    return NextResponse.json(
      { error: `${config.clientIdEnv} não configurado` },
      { status: 500 }
    );
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}${config.callbackPath}`;

  // State = userId:provider (base64) for CSRF protection
  const state = Buffer.from(`${user.id}:${provider}`).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });

  if (config.scopes) params.set("scope", config.scopes);

  // Provider-specific params
  if (provider === "notion") {
    params.set("owner", "user");
  }
  if (provider === "google_workspace") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }
  if (provider === "discord") {
    params.set("permissions", "8"); // Administrator for guild management
  }

  const authUrl =
    provider === "clickup"
      ? `${config.authUrl}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
      : `${config.authUrl}?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
