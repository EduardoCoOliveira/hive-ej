import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/callback/magic
 *
 * Callback do Magic Link (OTP por e-mail) — Supabase PKCE flow.
 *
 * O Supabase envia o e-mail com um link para esta rota contendo:
 *   ?token_hash=...  → hash do token OTP
 *   ?type=email      → tipo de verificação
 *   ?next=...        → rota para redirecionar após login (nosso parâmetro)
 *
 * IMPORTANTE: Esta URL deve estar na whitelist do Supabase Dashboard em:
 *   Authentication > URL Configuration > Redirect URLs
 *   Adicione: http://localhost:3000/api/auth/callback/magic
 *             https://seudominio.com/api/auth/callback/magic
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type      = searchParams.get("type") as "email" | "recovery" | "invite" | null;
  const next      = searchParams.get("next") ?? "/dashboard";

  // Parâmetros obrigatórios
  if (!tokenHash || !type) {
    console.error("[auth/callback/magic] Missing token_hash or type params");
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = createServerClient();

  // Verifica o OTP e cria a sessão
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    console.error("[auth/callback/magic] verifyOtp error:", error.message);

    const isExpired = error.message.toLowerCase().includes("expired") ||
                      error.message.toLowerCase().includes("invalid");

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(isExpired ? "invalid_link" : error.message)}`
    );
  }

  // Garante que next aponta para o próprio domínio (evita open redirect)
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  return NextResponse.redirect(`${origin}${safeNext}`);
}
