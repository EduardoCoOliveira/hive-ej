import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/callback/google
 *
 * Callback do OAuth2 do Google via Supabase PKCE flow.
 *
 * Parâmetros que o Supabase envia de volta:
 *   ?code=...        → código de autorização para trocar por sessão
 *   ?error=...       → erro retornado pelo provider (ex: access_denied)
 *   ?next=...        → rota para redirecionar após login (opcional)
 *
 * IMPORTANTE: Esta URL deve estar na whitelist do Supabase Dashboard em:
 *   Authentication > URL Configuration > Redirect URLs
 *   Adicione: http://localhost:3000/api/auth/callback/google
 *             https://seudominio.com/api/auth/callback/google
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code  = searchParams.get("code");
  const next  = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");

  // Erro retornado pelo Google ou Supabase
  if (error) {
    console.error("[auth/callback/google] Provider error:", error);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    console.error("[auth/callback/google] Missing code param");
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = createServerClient();

  // Troca o código por uma sessão (PKCE — usa o code_verifier do cookie)
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback/google] exchangeCodeForSession error:", exchangeError.message);

    // Código expirado ou já usado
    const isExpired = exchangeError.message.toLowerCase().includes("expired") ||
                      exchangeError.message.toLowerCase().includes("invalid");

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(isExpired ? "link_expired" : exchangeError.message)}`
    );
  }

  // Garante que next aponta para o próprio domínio (evita open redirect)
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  return NextResponse.redirect(`${origin}${safeNext}`);
}
