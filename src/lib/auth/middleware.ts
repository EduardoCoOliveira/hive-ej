// ─────────────────────────────────────────────
//  Middleware de Autenticação e Sessão
// ─────────────────────────────────────────────

import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

// Rotas que não exigem autenticação
const PUBLIC_ROUTES = ["/", "/login", "/register", "/api/webhooks"];

// Rotas apenas para usuários não autenticados
// Nota: /register NÃO entra aqui — usuário pode estar logado e ainda precisar
// completar o cadastro da organização (sem perfil no banco ainda)
const AUTH_ONLY_ROUTES = ["/login"];

export async function authMiddleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createMiddlewareClient<Database>({ req: request, res: response });

  // Refresh da sessão (mantém cookie atualizado)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;

  // Se está em rota de auth mas já está logado, redireciona para dashboard
  if (session && AUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Se não está autenticado e a rota precisa de auth, redireciona para login
  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith("/api/auth")
  );

  if (!session && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
