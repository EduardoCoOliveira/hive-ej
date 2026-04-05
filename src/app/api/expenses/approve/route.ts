/**
 * POST /api/expenses/approve
 * Body: { expenseId: string; approved: boolean; reason?: string }
 *
 * Permissões: director ou president apenas.
 * Atualiza status, notifica membro por email, atualiza Google Sheets.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { approveExpense } from "@/services/expenses/receipt.service";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, rank")
    .eq("id", user.id)
    .single();

  if (!profile || !["director", "president"].includes(profile.rank)) {
    return NextResponse.json(
      { error: "Apenas Diretores e Presidentes podem aprovar reembolsos" },
      { status: 403 }
    );
  }

  const body = await req.json() as { expenseId?: string; approved?: boolean; reason?: string };

  if (!body.expenseId || body.approved === undefined) {
    return NextResponse.json(
      { error: "expenseId e approved são obrigatórios" },
      { status: 400 }
    );
  }

  if (!body.approved && !body.reason) {
    return NextResponse.json(
      { error: "Informe o motivo da reprovação" },
      { status: 400 }
    );
  }

  // Verifica que a despesa pertence à org do aprovador
  const { data: expense } = await supabase
    .from("expenses")
    .select("id, status, organization_id")
    .eq("id", body.expenseId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!expense) {
    return NextResponse.json({ error: "Despesa não encontrada" }, { status: 404 });
  }

  if (expense.status !== "pending") {
    return NextResponse.json(
      { error: `Esta despesa já foi ${expense.status === "approved" ? "aprovada" : "reprovada"}` },
      { status: 409 }
    );
  }

  await approveExpense(
    body.expenseId,
    user.id,
    profile.organization_id,
    body.approved,
    body.reason
  );

  return NextResponse.json({
    success: true,
    status: body.approved ? "approved" : "rejected",
    message: body.approved
      ? "Reembolso aprovado. Membro notificado por email."
      : "Reembolso reprovado. Membro notificado com o motivo.",
  });
}
