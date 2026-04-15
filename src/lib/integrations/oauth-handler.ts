/**
 * Shared OAuth token exchange + persistence logic.
 * Called by each provider's callback route.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/integrations/token-vault";

const OAUTH_STATE_COOKIE = "hive_oauth_state";
const ALLOWED_RANKS = new Set(["director", "president"]);

interface OAuthStatePayload {
  userId: string;
  provider: string;
  nonce: string;
}

interface IntegrationProfileRow {
  organization_id: string;
  rank: string;
}

export interface OAuthHandlerConfig {
  provider: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  callbackPath: string;
  getWorkspaceName?: (
    tokenData: Record<string, unknown>,
    accessToken: string
  ) => Promise<string | null>;
}

function redirectWithStateCleanup(req: NextRequest, target: string): NextResponse {
  const response = NextResponse.redirect(new URL(target, req.url));
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

function parseState(rawState: string): OAuthStatePayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(rawState, "base64url").toString()
    ) as Partial<OAuthStatePayload>;

    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.provider !== "string" ||
      typeof parsed.nonce !== "string"
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      provider: parsed.provider,
      nonce: parsed.nonce,
    };
  } catch {
    return null;
  }
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
    return redirectWithStateCleanup(
      req,
      `/integracoes?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return redirectWithStateCleanup(req, "/integracoes?error=invalid_callback");
  }

  const parsedState = parseState(state);
  const storedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (
    !parsedState ||
    parsedState.provider !== config.provider ||
    !storedState ||
    storedState !== state
  ) {
    return redirectWithStateCleanup(req, "/integracoes?error=invalid_state");
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== parsedState.userId) {
    return redirectWithStateCleanup(req, "/login");
  }

  const admin = createAdminClient();
  const { data: profileRow } = await admin
    .from("profiles")
    .select("organization_id, rank")
    .eq("id", user.id)
    .single();
  const profile = profileRow as IntegrationProfileRow | null;

  if (!profile) {
    return redirectWithStateCleanup(req, "/integracoes?error=profile_not_found");
  }

  if (!ALLOWED_RANKS.has(profile.rank)) {
    return redirectWithStateCleanup(req, "/integracoes?error=forbidden");
  }

  // Exchange code for tokens
  const clientId = process.env[config.clientIdEnv]!;
  const clientSecret = process.env[config.clientSecretEnv]!;
  const redirectUri = `${req.nextUrl.origin}${config.callbackPath}`;

  const tokenRes = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
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
    return redirectWithStateCleanup(
      req,
      "/integracoes?error=token_exchange_failed"
    );
  }

  const tokenData = (await tokenRes.json()) as Record<string, unknown>;
  const accessToken = tokenData.access_token as string;
  const refreshToken = tokenData.refresh_token as string | undefined;
  const expiresIn = tokenData.expires_in as number | undefined;
  const scopes = (tokenData.scope as string | undefined)?.split(/[\s,]+/) ?? [];

  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // Encrypt tokens
  const encryptedAccess = await encryptToken(accessToken);
  const encryptedRefresh = refreshToken
    ? await encryptToken(refreshToken)
    : null;

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
  const integrationUpsert = {
    org_id: profile.organization_id,
    provider: config.provider,
    access_token: encryptedAccess,
    refresh_token: encryptedRefresh,
    expires_at: expiresAt,
    scopes,
    workspace_name: workspaceName,
    connected_by: user.id,
    connected_at: new Date().toISOString(),
  } as never;

  const { error: upsertError } = await admin
    .from("org_integrations")
    .upsert(integrationUpsert, { onConflict: "org_id,provider" });

  if (upsertError) {
    console.error(`[${config.provider}] DB upsert failed:`, upsertError.message);
    return redirectWithStateCleanup(req, "/integracoes?error=db_error");
  }

  return redirectWithStateCleanup(
    req,
    `/integracoes?success=${config.provider}`
  );
}
