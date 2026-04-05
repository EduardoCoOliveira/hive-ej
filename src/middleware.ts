import { type NextRequest } from "next/server";
import { authMiddleware } from "@/lib/auth/middleware";

export async function middleware(request: NextRequest) {
  return authMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Executa em todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico, logos, fontes
     */
    "/((?!_next/static|_next/image|favicon.ico|logos|fonts|patterns).*)",
  ],
};
