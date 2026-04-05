"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isWhitelistedDomain, resolvePlanTier } from "@/lib/auth/domain-check";

type Step = 1 | 2 | 3;

export default function RegisterPage() {
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos do formulário
  const [ejName, setEjName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const supabase = createClient();
  const isInternal = email ? isWhitelistedDomain(email) : false;
  const plan = email ? resolvePlanTier(email) : "free";

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: {
          full_name: fullName,
          organization_name: ejName,
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback/magic`,
      },
    });

    if (error) {
      setError("Erro ao criar conta. Verifique os dados e tente novamente.");
      setIsLoading(false);
      return;
    }

    setStep(3);
    setIsLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8 space-y-3">
          <img
            src="/logos/logo-vertical.svg"
            alt="Hï Tech Hub"
            className="h-12 mx-auto"
          />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Cadastre sua Empresa Júnior
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Comece grátis. Sem cartão de crédito.
            </p>
          </div>
        </div>

        {/* Stepper */}
        {step < 3 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {([1, 2] as Step[]).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    s <= step
                      ? "bg-brand-teal text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s < step ? "✓" : s}
                </div>
                {s < 2 && (
                  <div className={`w-16 h-0.5 transition-colors ${s < step ? "bg-brand-teal" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── Passo 1: Dados da EJ ─── */}
        {step === 1 && (
          <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
            <div>
              <h2 className="font-semibold text-foreground">Dados da sua EJ</h2>
              <p className="text-sm text-muted-foreground">Como se chama a sua Empresa Júnior?</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Nome da EJ</label>
                <input
                  type="text"
                  value={ejName}
                  onChange={(e) => setEjName(e.target.value)}
                  placeholder="ex: Hï Tech Empresa Júnior"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-teal/50 focus:border-brand-teal transition-colors"
                />
              </div>
            </div>

            <button
              onClick={() => ejName.trim() && setStep(2)}
              disabled={!ejName.trim()}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
            >
              Continuar →
            </button>
          </div>
        )}

        {/* ─── Passo 2: Dados pessoais e plano ─── */}
        {step === 2 && (
          <form onSubmit={handleRegister} className="bg-card rounded-2xl border border-border p-8 space-y-6">
            <div>
              <h2 className="font-semibold text-foreground">Seus dados</h2>
              <p className="text-sm text-muted-foreground">Você será o owner da organização</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Nome completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="João da Silva"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-teal/50 focus:border-brand-teal transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">E-mail institucional</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@suaej.com.br"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-teal/50 focus:border-brand-teal transition-colors"
                  />
                  {isInternal && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="badge-internal">✦ Internal</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card do plano */}
              {email && (
                <div
                  className={`p-4 rounded-xl border-2 transition-colors ${
                    isInternal
                      ? "border-brand-teal bg-brand-teal/5"
                      : "border-border bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground text-sm">
                        {isInternal ? "✦ Plano Internal" : "Plano Gratuito"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isInternal
                          ? "Acesso Premium completo — gratuito vitalício para @hitech.org.br"
                          : "Funcionalidades básicas. Faça upgrade para Premium por R$ 50/mês."}
                      </p>
                    </div>
                    <span className={isInternal ? "badge-internal" : "badge-free"}>
                      {isInternal ? "Premium" : "Free"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl font-medium border border-border text-foreground hover:bg-muted transition-colors"
              >
                ← Voltar
              </button>
              <button
                type="submit"
                disabled={isLoading || !fullName || !email}
                className="flex-1 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
              >
                {isLoading ? "Criando..." : "Criar conta"}
              </button>
            </div>
          </form>
        )}

        {/* ─── Passo 3: Confirmação ─── */}
        {step === 3 && (
          <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-brand-teal/20 flex items-center justify-center mx-auto">
              <span className="text-3xl">🎉</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Conta criada!</h2>
              <p className="text-muted-foreground text-sm mt-2">
                Enviamos um link de acesso para <strong>{email}</strong>.
                Clique nele para entrar no Hub.
              </p>
            </div>
            {isInternal && (
              <div className="p-3 rounded-xl bg-brand-teal/10 border border-brand-teal/30">
                <p className="text-sm text-brand-teal font-medium">
                  ✦ Seu plano Premium Internal já está ativo!
                </p>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-brand-teal font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
