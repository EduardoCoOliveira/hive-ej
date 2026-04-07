import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolvePlanTier } from "@/lib/auth/domain-check";

/**
 * GET /api/auth/callback/magic
 *
 * Callback do Magic Link — suporta dois fluxos do Supabase:
 *
 * 1. PKCE flow:   ?code=...               → exchangeCodeForSession
 * 2. Implicit:    ?token_hash=...&type=... → verifyOtp
 *
 * Após autenticar, verifica se o usuário já tem perfil no banco.
 * Se não tiver (primeiro login), cria a organização e o perfil
 * usando os dados enviados no user_metadata do signInWithOtp.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code      = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type      = searchParams.get("type") as "email" | "recovery" | "invite" | null;
  const next      = searchParams.get("next") ?? "/dashboard";
  const safeNext  = next.startsWith("/") ? next : "/dashboard";

  const supabase = createServerClient();

  // ── 1. Autenticar ────────────────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[callback/magic] exchangeCodeForSession:", error.message);
      return NextResponse.redirect(`${origin}/login?error=invalid_link`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.error("[callback/magic] verifyOtp:", error.message);
      return NextResponse.redirect(`${origin}/login?error=invalid_link`);
    }
  } else {
    console.error("[callback/magic] sem code nem token_hash", Object.fromEntries(searchParams));
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  // ── 2. Verificar/criar perfil no primeiro login ──────────────
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!existingProfile) {
      // Primeiro acesso: cria org + perfil com dados do cadastro
      const meta          = user.user_metadata ?? {};
      const orgName       = (meta.organization_name as string | undefined) ?? "Minha EJ";
      const fullName      = (meta.full_name      as string | undefined) ?? null;
      const email         = user.email ?? "";
      const planTier      = resolvePlanTier(email);

      const slug = orgName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        || "minha-ej";

      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({ name: orgName, slug, plan_tier: planTier })
        .select("id")
        .single();

      if (orgErr || !org) {
        console.error("[callback/magic] erro ao criar organização:", orgErr?.message);
        // Não bloqueia o login — usuário acessa /dashboard e vê mensagem de erro lá
      } else {
        const { error: profileErr } = await supabase
          .from("profiles")
          .insert({ id: user.id, organization_id: org.id, full_name: fullName, email });

        if (profileErr) {
          console.error("[callback/magic] erro ao criar perfil:", profileErr.message);
        } else {
          console.log("[callback/magic] org + perfil criados para", user.id);
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
