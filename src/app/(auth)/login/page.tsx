"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isWhitelistedDomain } from "@/lib/auth/domain-check";

// Mapa de erros para mensagens amigáveis em PT-BR
const ERROR_MESSAGES: Record<string, string> = {
  no_code: "Link inválido. Tente fazer login novamente.",
  invalid_link: "Link expirado ou inválido. Solicite um novo.",
  access_denied: "Acesso negado pelo Google. Tente novamente.",
  server_error: "Erro no servidor. Tente novamente em instantes.",
  temporarily_unavailable: "Serviço temporariamente indisponível. Tente novamente.",
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Exibe erros vindos da URL (?error=...) após redirect do OAuth
  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) {
      setError(ERROR_MESSAGES[urlError] ?? `Erro de autenticação: ${urlError}`);
    }
  }, [searchParams]);

  // ── Google OAuth ──────────────────────────────────────────────
  async function handleGoogleLogin() {
    setIsLoading(true);
    setError(null);

    const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Preserva o redirectTo passando como parâmetro ?next=
        redirectTo: `${window.location.origin}/api/auth/callback/google?next=${encodeURIComponent(redirectTo)}`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setError("Erro ao conectar com o Google. Verifique se o provedor está habilitado no Supabase.");
      setIsLoading(false);
    }
    // Se ok, o navegador vai redirecionar — não reseta isLoading
  }

  // ── Magic Link ────────────────────────────────────────────────
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    setError(null);

    const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        // Supabase vai adicionar token_hash + type na URL
        emailRedirectTo: `${window.location.origin}/api/auth/callback/magic?next=${encodeURIComponent(redirectTo)}`,
        shouldCreateUser: true,
      },
    });

    if (error) {
      // Erros comuns do magic link
      if (error.message.includes("rate limit") || error.message.includes("429")) {
        setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else if (error.message.includes("invalid")) {
        setError("E-mail inválido. Verifique o endereço e tente novamente.");
      } else {
        setError(`Não foi possível enviar o link: ${error.message}`);
      }
    } else {
      setMagicSent(true);
    }

    setIsLoading(false);
  }

  const isInternal = email ? isWhitelistedDomain(email) : false;

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-[#0a0e1a]">

      {/* ── Painel esquerdo (branding) ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #09254D 0%, #1a1060 50%, #4E378C 100%)" }}>

        {/* Grade de fundo */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Orbs decorativos */}
        <div className="absolute top-1/4 -left-16 w-72 h-72 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #41C5C6, transparent)" }} />
        <div className="absolute bottom-1/3 right-0 w-56 h-56 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #4E378C, transparent)" }} />

        <div className="relative z-10 flex flex-col justify-between h-full p-12">
          {/* Logo */}
          <div>
            <span className="text-2xl font-bold text-white tracking-tight">
              Hï<span style={{ color: "#41C5C6" }}>ve</span>
            </span>
          </div>

          {/* Copy principal */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5"
              style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#41C5C6" }} />
              <span className="text-white/80 text-sm font-medium">Hub de Gestão para EJs</span>
            </div>

            <h1 className="text-4xl font-bold text-white leading-tight">
              Centraliza tudo.
              <br />
              <span style={{ color: "#41C5C6" }}>Cresce mais.</span>
            </h1>

            <p className="text-white/70 text-lg leading-relaxed max-w-sm">
              Google Workspace, ClickUp, Notion, Discord e IA — tudo em um só lugar
              para a sua Empresa Júnior.
            </p>

            {/* Badges de integração */}
            <div className="flex flex-wrap gap-2">
              {["Google", "ClickUp", "Notion", "Discord", "OpenAI", "Canva"].map((tool) => (
                <span key={tool} className="px-3 py-1 rounded-full text-white/80 text-xs font-medium"
                  style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  {tool}
                </span>
              ))}
            </div>
          </div>

          {/* Destaque Plano Internal */}
          <div className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(65,197,198,0.25)" }}>
              <svg className="w-5 h-5" style={{ color: "#41C5C6" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Plano Internal</p>
              <p className="text-white/60 text-xs">@hitech.org.br — acesso Premium gratuito e vitalício</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Painel direito (formulário) ── */}
      <div className="flex-1 flex flex-col bg-[#0d1117]">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="lg:hidden text-lg font-bold text-white">
            Hï<span style={{ color: "#41C5C6" }}>ve</span>
          </span>
          <div className="hidden lg:block" />
          <Link href="/register"
            className="text-sm text-white/50 hover:text-white transition-colors">
            Cadastrar EJ →
          </Link>
        </div>

        {/* Formulário */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-7">

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">Bem-vindo de volta</h2>
              <p className="text-sm text-white/50">Entre na sua conta para acessar o Hub</p>
            </div>

            {/* Erro global (URL ou runtime) */}
            {error && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Botão Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.11)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
            >
              {/* Logo Google */}
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {isLoading ? "Conectando..." : "Entrar com Google"}
            </button>

            {/* Divisor */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 text-xs uppercase tracking-widest"
                  style={{ background: "#0d1117", color: "rgba(255,255,255,0.3)" }}>
                  ou por e-mail
                </span>
              </div>
            </div>

            {/* Formulário de magic link / confirmação */}
            {!magicSent ? (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
                    E-mail institucional
                  </label>
                  <div className="relative">
                    {/* Ícone de email */}
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@suaej.com.br"
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.10)",
                      }}
                      onFocus={e => (e.target.style.borderColor = "rgba(65,197,198,0.5)")}
                      onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.10)")}
                    />
                    {/* Badge Internal */}
                    {isInternal && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(65,197,198,0.15)", color: "#41C5C6", border: "1px solid rgba(65,197,198,0.3)" }}>
                        ✦ Internal
                      </span>
                    )}
                  </div>

                  {isInternal && (
                    <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: "#41C5C6" }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Domínio @hitech.org.br — você receberá Premium gratuitamente
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
                >
                  {isLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Enviando...
                    </>
                  ) : (
                    <>
                      Enviar link mágico
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Estado de confirmação */
              <div className="text-center space-y-4 p-6 rounded-2xl"
                style={{ border: "1px solid rgba(65,197,198,0.25)", background: "rgba(65,197,198,0.05)" }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: "rgba(65,197,198,0.15)" }}>
                  <svg className="w-6 h-6" style={{ color: "#41C5C6" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-white">Verifique seu e-mail</p>
                  <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                    Enviamos um link para{" "}
                    <strong className="text-white">{email}</strong>.
                    <br />
                    Clique nele para entrar automaticamente.
                  </p>
                </div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Não recebeu? Verifique o spam ou
                </p>
                <button
                  onClick={() => { setMagicSent(false); setEmail(""); setError(null); }}
                  className="text-sm font-medium hover:underline"
                  style={{ color: "#41C5C6" }}
                >
                  usar outro e-mail
                </button>
              </div>
            )}

            <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.40)" }}>
              Sua EJ ainda não tem conta?{" "}
              <Link href="/register"
                className="font-semibold hover:underline"
                style={{ color: "#41C5C6" }}>
                Cadastre-se grátis
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
