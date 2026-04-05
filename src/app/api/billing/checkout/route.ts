import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" });

/**
 * POST /api/billing/checkout
 * Cria uma sessão de checkout Stripe para upgrade para Premium.
 * Preço fixo: R$ 50/mês por organização.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization:organizations(id, name, plan_tier, stripe_customer_id)")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Apenas owners/admins podem gerenciar assinaturas" }, { status: 403 });
  }

  const org = Array.isArray(profile.organization) ? profile.organization[0] : profile.organization;
  if (!org) return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });

  // Usuários internos (@hitech.org.br) não pagam
  if (org.plan_tier === "internal") {
    return NextResponse.json({ error: "Plano Internal não requer pagamento" }, { status: 400 });
  }

  // Cria ou reutiliza customer no Stripe
  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email!,
      name: org.name,
      metadata: { organization_id: org.id },
    });
    customerId = customer.id;
    await supabase.from("organizations").update({ stripe_customer_id: customerId }).eq("id", org.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID_PREMIUM!,
        quantity: 1,
      },
    ],
    metadata: { organization_id: org.id },
    success_url: `${appUrl}/configuracoes/upgrade?success=1`,
    cancel_url: `${appUrl}/configuracoes/upgrade?cancelled=1`,
    locale: "pt-BR",
    subscription_data: {
      metadata: { organization_id: org.id },
      trial_period_days: 7, // 7 dias de trial gratuito
    },
  });

  return NextResponse.json({ url: session.url });
}
