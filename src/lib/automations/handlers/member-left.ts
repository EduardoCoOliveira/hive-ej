/**
 * MEMBER_LEFT Handler — Offboarding Completo
 *
 * Revoga todos os acessos de uma vez:
 *   1. Google Workspace: suspende conta
 *   2. Discord: remove do servidor
 *   3. ClickUp: remove do time
 *   4. Canva: remove do time
 *   5. Figma: remove do time
 *   6. Supabase: desativa perfil
 *   7. Projetos: remove de alocações ativas
 *   8. Discord: notifica gestores
 *   9. Gmail: envia e-mail de saída
 *  10. Audit log com log de offboarding
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getDecryptedToken } from "@/lib/integrations/token-vault";
import { revokeAllAccess, type MemberAccessProfile } from "@/services/members/access.service";

export interface MemberLeftPayload {
  memberId: string;
  memberName: string;
  memberEmail: string;
  institutionalEmail?: string;
  memberDiscordId?: string;
  orgId: string;
  orgName: string;
  rank: string;
  triggeredBy: string;   // userId de quem iniciou o offboarding
  reason?: string;
}

interface StepResult { step: string; ok: boolean; data?: unknown; error?: string; }

async function runStep(name: string, fn: () => Promise<unknown>): Promise<StepResult> {
  try {
    const data = await fn();
    console.log(`[Offboarding] ✅ ${name}`);
    return { step: name, ok: true, data };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`[Offboarding] ⚠️ ${name}: ${error}`);
    return { step: name, ok: false, error };
  }
}

export async function handleMemberLeft(payload: MemberLeftPayload) {
  const admin = createAdminClient();
  const results: StepResult[] = [];

  const accessProfile: MemberAccessProfile = {
    memberId: payload.memberId,
    memberName: payload.memberName,
    memberEmail: payload.memberEmail,
    institutionalEmail: payload.institutionalEmail,
    memberDiscordId: payload.memberDiscordId,
    rank: payload.rank,
    orgId: payload.orgId,
  };

  // ── 1-5. Revogar acesso em todas as ferramentas ───────────
  const revokeResults = await revokeAllAccess(accessProfile);
  results.push(...revokeResults);

  // ── 6. Supabase: marcar perfil como inativo ───────────────
  results.push(await runStep("supabase_deactivate", async () => {
    await admin
      .from("profiles")
      .update({ rank: "trainee", department: null, discord_id: null })
      .eq("id", payload.memberId);
    // Nota: não deletamos o perfil para preservar histórico de pontos/tarefas
    return { deactivated: true };
  }));

  // ── 7. Projetos: remover de alocações ativas ─────────────
  results.push(await runStep("remove_from_projects", async () => {
    // Busca projetos ativos do membro
    const { data: allocations } = await admin
      .from("project_allocations")
      .select("id, project_id, projects(name, status)")
      .eq("member_id", payload.memberId);

    const activeAllocations = (allocations ?? []).filter(a => {
      const project = Array.isArray(a.projects) ? a.projects[0] : a.projects;
      return project?.status === "active";
    });

    if (activeAllocations.length > 0) {
      await admin
        .from("project_allocations")
        .delete()
        .in("id", activeAllocations.map(a => a.id));
    }

    return { removedFromProjects: activeAllocations.length };
  }));

  // ── 8. Discord: notificar gestores ────────────────────────
  results.push(await runStep("discord_notify_managers", async () => {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) return { skipped: "no bot token" };

    // Busca canal de gestão da org
    const { data: channels } = await admin
      .from("discord_role_channels")
      .select("channel_id")
      .eq("organization_id", payload.orgId)
      .in("rank", ["director", "president"])
      .limit(1);

    const channelId = channels?.[0]?.channel_id;
    if (!channelId) return { skipped: "no management channel" };

    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: "👋 Membro saiu da organização",
          description: `**${payload.memberName}** (${payload.rank}) deixou a ${payload.orgName}.`,
          color: 0xFEC045,
          fields: [
            { name: "Email", value: payload.institutionalEmail ?? payload.memberEmail, inline: true },
            { name: "Motivo", value: payload.reason ?? "Não informado", inline: true },
            { name: "Acessos revogados", value: revokeResults.filter(r => r.ok).map(r => `✅ ${r.step}`).join("\n") || "Nenhum" },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "Hïve — Offboarding Automático" },
        }],
      }),
    });
    return { notified: true, channelId };
  }));

  // ── 9. Gmail: e-mail de saída ─────────────────────────────
  results.push(await runStep("gmail_offboarding_email", async () => {
    const { data: integration } = await admin
      .from("org_integrations")
      .select("access_token")
      .eq("org_id", payload.orgId)
      .eq("provider", "google_workspace")
      .single();

    if (!integration) return { skipped: "no google_workspace" };
    const token = await getDecryptedToken(integration.access_token);

    const html = `<div style="font-family:Inter,sans-serif;max-width:580px;margin:0 auto">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
        <h2 style="color:#09254D">Saída da ${payload.orgName}</h2>
        <p style="color:#64748b;line-height:1.6">
          Olá ${payload.memberName.split(" ")[0]},<br><br>
          Seu acesso à <strong>${payload.orgName}</strong> foi encerrado.
          Agradecemos sua contribuição durante sua passagem pela EJ!
        </p>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#9a3412;font-size:14px">
            ⚠️ Seu e-mail institucional (${payload.institutionalEmail ?? "N/A"}) foi suspenso.
            Entre em contato com a diretoria se tiver dúvidas.
          </p>
        </div>
        <p style="color:#94a3b8;font-size:12px">Este é um e-mail automático gerado pelo Hïve.</p>
      </div>
    </div>`;

    const message = [
      `To: ${payload.memberEmail}`,
      `Subject: Encerramento de acesso — ${payload.orgName}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      html,
    ].join("\r\n");

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(message).toString("base64url") }),
    });
    return { sent: res.ok };
  }));

  // ── 10. Salva log de offboarding ─────────────────────────
  const googleStep = revokeResults.find(r => r.step === "google_workspace_suspend");
  const discordStep = revokeResults.find(r => r.step === "discord_remove");
  const clickupStep = revokeResults.find(r => r.step === "clickup_remove");
  const canvaStep   = revokeResults.find(r => r.step === "canva_remove");
  const figmaStep   = revokeResults.find(r => r.step === "figma_remove");

  await admin.from("member_offboarding_log").insert({
    organization_id: payload.orgId,
    member_id: payload.memberId,
    member_name: payload.memberName,
    member_email: payload.institutionalEmail ?? payload.memberEmail,
    triggered_by: payload.triggeredBy,
    steps: results,
    google_suspended: googleStep?.ok ?? false,
    discord_removed: discordStep?.ok ?? false,
    clickup_removed: clickupStep?.ok ?? false,
    notion_removed: false, // Notion não tem API de remoção pública
    figma_removed: figmaStep?.ok ?? false,
    canva_removed: canvaStep?.ok ?? false,
  });

  await admin.from("audit_logs").insert({
    organization_id: payload.orgId,
    user_id: payload.triggeredBy,
    action: "MEMBER_OFFBOARDED",
    entity_type: "member",
    entity_id: payload.memberId,
    metadata: {
      memberName: payload.memberName,
      reason: payload.reason,
      success: results.filter(r => r.ok).length,
      total: results.length,
    },
  });

  console.log(`[Offboarding] ${payload.memberName} — ${results.filter(r => r.ok).length}/${results.length} etapas ✅`);
  return results;
}
