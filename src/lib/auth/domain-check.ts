// ─────────────────────────────────────────────
//  Lógica de Whitelist de Domínio
//  Usuários @hitech.org.br recebem Premium vitalício
// ─────────────────────────────────────────────

import type { PlanTier } from "@/types";

/** Domínios que recebem Premium automaticamente (sem cobrança) */
const WHITELISTED_DOMAINS: readonly string[] = [
  process.env.WHITELISTED_DOMAIN ?? "hitech.org.br",
];

/**
 * Extrai o domínio de um endereço de e-mail.
 * @example getEmailDomain("joao@hitech.org.br") // "hitech.org.br"
 */
export function getEmailDomain(email: string): string {
  const parts = email.toLowerCase().trim().split("@");
  if (parts.length !== 2 || !parts[1]) {
    throw new Error("E-mail inválido");
  }
  return parts[1];
}

/**
 * Verifica se o domínio do e-mail está na whitelist interna.
 * Usuários whitelistados recebem plano "internal" (Premium gratuito vitalício).
 */
export function isWhitelistedDomain(email: string): boolean {
  try {
    const domain = getEmailDomain(email);
    return WHITELISTED_DOMAINS.includes(domain);
  } catch {
    return false;
  }
}

/**
 * Determina o plano inicial de um usuário com base no e-mail.
 *
 * Regras:
 *  - @hitech.org.br → "internal" (Premium vitalício, sem Stripe)
 *  - qualquer outro  → "free"    (upgrade via Stripe para "premium")
 */
export function resolvePlanTier(email: string): PlanTier {
  return isWhitelistedDomain(email) ? "internal" : "free";
}

/**
 * Retorna true se o plano tem acesso a funcionalidades Premium.
 * Tanto "premium" quanto "internal" têm acesso completo.
 */
export function hasPremiumAccess(plan: PlanTier): boolean {
  return plan === "premium" || plan === "internal";
}

/**
 * Guard para uso em Route Handlers e Server Actions.
 * Lança erro se o plano não tiver acesso Premium.
 */
export function assertPremiumAccess(plan: PlanTier): void {
  if (!hasPremiumAccess(plan)) {
    throw new Error(
      "Acesso Premium necessário. Faça upgrade do plano para utilizar este recurso."
    );
  }
}
