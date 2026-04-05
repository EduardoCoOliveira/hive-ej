/**
 * Shared OAuth token exchange + persistence logic.
 * Called by each provider's callback route.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/integrations/token-vault";

export interface OAuthHandlerConfig {
  provider: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  callbackPath: string;
  getWorkspaceName?: (tokenData: Record<string, unknown>, accessToken: string) => Promise<string | null>;
}

export async function handleOAuthCallback(
  req: NextRequest,
  config: OAuthHandlerConfig
): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/integracoes?error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/integracoes?error=invalid_callback", req.url));
  }

  // Validate state
  let userId: string;
  try {
    const decoded = Buffer.from(state, "base64url").toString();
    const [uid] = decoded.split(":");
    userId = uid;
  } catch {
    return NextResponse.redirect(new URL("/integracoes?error=invalid_state", req.url));
  }

  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL("/integracoes?error=profile_not_found", req.url));
  }

  // Exchange code for tokens
  const clientId = process.env[config.clientIdEnv]!;
  const clientSecret = process.env[config.clientSecretEnv]!;
  const redirectUri = `${req.nextUrl.origin}${config.callbackPath}`;

  const tokenRes = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error(`[${config.provider}] Token exchange failed:`, text);
    return NextResponse.redirect(new URL("/integracoes?error=token_exchange_failed", req.url));
  }

  const tokenData = await tokenRes.json() as Record<string, unknown>;
  const accessToken = tokenData.access_token as string;
  const refreshToken = tokenData.refresh_token as string | undefined;
  const expiresIn = tokenData.expires_in as number | undefined;
  const scopes = (tokenData.scope as string | undefined)?.split(/[\s,]+/) ?? [];

  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // Encrypt tokens
  const encryptedAccess = await encryptToken(accessToken);
  const encryptedRefresh = refreshToken ? await encryptToken(refreshToken) : null;

  // Optional: fetch workspace/guild name
  let workspaceName: string | null = null;
  if (config.getWorkspaceName) {
    try {
      workspaceName = await config.getWorkspaceName(tokenData, accessToken);
    } catch {
      // non-critical
    }
  }

  // Persist to org_integrations
  const admin = createAdminClient();
  const { error: upsertError } = await admin.from("org_integrations").upsert(
    {
      org_id: profile.organization_id,
      provider: config.provider,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      scopes,
      workspace_name: workspaceName,
      connected_by: user.id,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "org_id,provider" }
  );

  if (upsertError) {
    console.error(`[${config.provider}] DB upsert failed:`, upsertError.message);
    return NextResponse.redirect(new URL("/integracoes?error=db_error", req.url));
  }

  return NextResponse.redirect(
    new URL(`/integracoes?success=${config.provider}`, req.url)
  );
}
