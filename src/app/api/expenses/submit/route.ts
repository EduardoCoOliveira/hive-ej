/**
 * POST /api/expenses/submit
 *
 * Recebe comprovante (multipart/form-data) e processa o reembolso:
 *   1. GPT-4o Vision extrai dados do recibo
 *   2. Sobe arquivo para Google Drive ("Comprovantes")
 *   3. Adiciona linha na planilha financeira
 *   4. Notifica financeiro no Discord (com reações ✅/❌)
 *   5. Registra no banco
 *
 * Form fields:
 *   receipt      — arquivo (JPG/PNG/PDF)
 *   description? — descrição do gasto
 *   category?    — categoria (alimentação, transporte, etc.)
 *   projectId?   — projeto associado
 *
 * GET /api/expenses/submit?status=pending&limit=20
 *   Lista despesas da org (filtros por status, projeto, membro)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { submitExpense } from "@/services/expenses/receipt.service";

export const maxDuration = 120; // 2 minutos para upload + Vision

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  try {
    const formData = await req.formData();
    const receiptFile = formData.get("receipt") as File | null;
    const description = formData.get("description") as string | null;
    const category = formData.get("category") as string | null;
    const projectId = formData.get("projectId") as string | null;

    if (!receiptFile) {
      return NextResponse.json({ error: "Campo 'receipt' obrigatório" }, { status: 400 });
    }

    // Valida tipo de arquivo
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const isAllowedExt = receiptFile.name.match(/\.(jpg|jpeg|png|webp|pdf)$/i);
    if (!allowedTypes.includes(receiptFile.type) && !isAllowedExt) {
      return NextResponse.json({
        error: "Formato não suportado. Use JPG, PNG, WebP ou PDF."
      }, { status: 400 });
    }

    // Limite de 10MB
    if (receiptFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande. Máximo 10MB." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await receiptFile.arrayBuffer());

    const result = await submitExpense({
      fileBuffer,
      fileName: receiptFile.name,
      mimeType: receiptFile.type || "image/jpeg",
      memberId: user.id,
      memberName: profile.full_name ?? "Membro",
      memberEmail: profile.email ?? "",
      orgId: profile.organization_id,
      description: description ?? undefined,
      category: category ?? undefined,
      projectId: projectId ?? undefined,
    });

    return NextResponse.json({
      success: true,
      expenseId: result.expenseId,
      extracted: result.extracted,
      driveFileUrl: result.driveFileUrl,
      sheetsRowNumber: result.sheetsRowNumber,
      discordMessageId: result.discordMessageId,
      message: `Reembolso de ${result.extracted.amountFormatted} submetido e financeiro notificado!`,
      processing: {
        steps: result.steps,
        successCount: result.steps.filter(s => s.ok).length,
        total: result.steps.length,
      },
    }, { status: 201 });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API/expenses/submit]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, rank")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  const projectId = params.get("projectId");
  const memberId = params.get("memberId");
  const limit = Math.min(parseInt(params.get("limit") ?? "20"), 50);
  const offset = parseInt(params.get("offset") ?? "0");

  // Financeiros (director+) veem todos; membros comuns só veem os seus
  const isDirector = ["director", "president"].includes(profile.rank);

  let query = supabase
    .from("expenses")
    .select(`
      id, amount, currency, date, cnpj, company_name, description,
      category, status, receipt_url, drive_file_id, sheets_row,
      discord_message_id, rejection_reason, created_at, reviewed_at,
      member_id, project_id
    `)
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!isDirector) {
    query = query.eq("member_id", user.id);
  } else if (memberId) {
    query = query.eq("member_id", memberId);
  }

  if (status) query = query.eq("status", status);
  if (projectId) query = query.eq("project_id", projectId);

  const { data: expenses, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Estatísticas rápidas para financeiros
  let stats = null;
  if (isDirector) {
    const { data: all } = await supabase
      .from("expenses")
      .select("amount, status")
      .eq("organization_id", profile.organization_id);

    if (all) {
      stats = {
        totalPending: all.filter(e => e.status === "pending").reduce((s, e) => s + e.amount, 0),
        totalApproved: all.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0),
        countPending: all.filter(e => e.status === "pending").length,
        countApproved: all.filter(e => e.status === "approved").length,
        countRejected: all.filter(e => e.status === "rejected").length,
      };
    }
  }

  return NextResponse.json({ expenses, stats });
}
