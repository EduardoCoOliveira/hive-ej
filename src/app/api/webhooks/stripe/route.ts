import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * POST /api/webhooks/stripe
 *
 * Processa eventos do Stripe e atualiza o plano da organização.
 * Eventos tratados:
 *  - checkout.session.completed → ativa Premium
 *  - customer.subscription.updated → sincroniza status
 *  - customer.subscription.deleted → downgrade para Free
 *  - invoice.payment_failed → notifica owner via Discord
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "Sem assinatura" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Assinatura inválida:", err);
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    // ─── Checkout concluído → ativa Premium ───────────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.organization_id;
      if (!orgId) break;

      await supabase
        .from("organizations")
        .update({
          plan_tier: "premium",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        })
        .eq("id", orgId);

      console.log(`[stripe] ✅ Org ${orgId} → Premium`);
      break;
    }

    // ─── Assinatura atualizada ────────────────────────────────
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("stripe_subscription_id", sub.id)
        .single();

      if (!org) break;

      const isActive = sub.status === "active" || sub.status === "trialing";

      await supabase
        .from("organizations")
        .update({ plan_tier: isActive ? "premium" : "free" })
        .eq("id", org.id);

      break;
    }

    // ─── Assinatura cancelada → downgrade para Free ───────────
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("stripe_subscription_id", sub.id)
        .single();

      if (!org) break;

      await supabase
        .from("organizations")
        .update({
          plan_tier: "free",
          stripe_subscription_id: null,
        })
        .eq("id", org.id);

      console.log(`[stripe] ⬇️ Org ${org.id} (${org.name}) → Free (subscription cancelada)`);
      break;
    }

    // ─── Pagamento falhou → notifica owner ───────────────────
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { data: org } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("stripe_customer_id", customerId)
        .single();

      if (!org) break;

      // Busca o owner para notificar
      const { data: owner } = await supabase
        .from("profiles")
        .select("full_name, id")
        .eq("organization_id", org.id)
        .eq("role", "owner")
        .single();

      // Log de auditoria
      await supabase.from("audit_logs").insert({
        organization_id: org.id,
        user_id: owner?.id,
        action: "billing.payment_failed",
        entity_type: "invoice",
        metadata: { invoice_id: invoice.id, amount: invoice.amount_due },
      });

      console.warn(`[stripe] ⚠️ Pagamento falhou para org ${org.id} (${org.name})`);
      break;
    }

    default:
      console.log(`[stripe] Evento não tratado: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
