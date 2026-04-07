import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/callback/magic
 *
 * Callback do Magic Link — suporta dois fluxos do Supabase:
 *
 * 1. PKCE flow (padrão do createClientComponentClient):
 *    ?code=...   → exchangeCodeForSession
 *
 * 2. OTP hash flow (legado):
 *    ?token_hash=...&type=email → verifyOtp
 *
 * ?next=...  → rota para redirecionar após login (nosso parâmetro)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code      = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type      = searchParams.get("type") as "email" | "recovery" | "invite" | null;
  const next      = searchParams.get("next") ?? "/dashboard";
  const safeNext  = next.startsWith("/") ? next : "/dashboard";

  const supabase = createServerClient();

  // ── PKCE flow (code) ─────────────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback/magic] exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(`${origin}/login?error=invalid_link`);
    }

    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  // ── OTP hash flow (token_hash) ────────────────────────────────
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error) {
      console.error("[auth/callback/magic] verifyOtp error:", error.message);
      return NextResponse.redirect(`${origin}/login?error=invalid_link`);
    }

    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  // Nenhum parâmetro válido encontrado
  console.error("[auth/callback/magic] Missing code or token_hash params", Object.fromEntries(searchParams));
  return NextResponse.redirect(`${origin}/login?error=invalid_link`);
}
