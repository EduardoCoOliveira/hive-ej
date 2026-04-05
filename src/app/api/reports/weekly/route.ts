/**
 * POST /api/reports/weekly
 * Gera e envia o relatório semanal para diretores e presidentes da org.
 * Pode ser chamado manualmente ou por um cron job externo.
 *
 * Body opcional: { preview: true }  → retorna HTML sem enviar
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWeeklyReport,
  buildEmailHTML,
  sendWeeklyReportEmail,
} from "@/services/reports/weekly-report.service";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, rank")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  // Apenas líderes ou superior podem disparar o relatório
  const allowedRanks = ["project_leader", "dept_leader", "director", "president"];
  if (!allowedRanks.includes(profile.rank)) {
    return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { preview?: boolean };

  // Constrói o relatório
  const report = await buildWeeklyReport(profile.organization_id);

  // Se preview, devolve o HTML sem enviar
  if (body.preview) {
    const html = buildEmailHTML(report);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Busca e-mails dos diretores/presidentes
  const admin = createAdminClient();
  const { data: leaders } = await admin
    .from("profiles")
    .select("id, email")
    .eq("organization_id", profile.organization_id)
    .in("rank", ["director", "president"]);

  const emails = (leaders ?? [])
    .map((l) => l.email)
    .filter((e): e is string => Boolean(e));

  if (emails.length === 0) {
    return NextResponse.json({
      success: false,
      error: "Nenhum diretor/presidente com e-mail cadastrado",
      report,
    });
  }

  const { sent, failed } = await sendWeeklyReportEmail(
    profile.organization_id,
    emails,
    report
  );

  return NextResponse.json({
    success: sent > 0,
    sent,
    failed,
    recipients: emails,
    reportSummary: {
      period: report.period,
      avgHiveScore: report.avgHiveScore,
      activeProjects: report.activeProjects,
      alerts: report.alerts.length,
    },
  });
}

// Endpoint para visualizar o relatório no browser (GET)
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const report = await buildWeeklyReport(profile.organization_id);
  const html = buildEmailHTML(report);

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
