/**
 * MEMBER_JOINED Handler — Onboarding Completo
 *
 * Etapas:
 *   1. grantAllAccess() — Google Workspace email, Discord roles,
 *                          ClickUp, Notion, Canva, Figma
 *   2. Notion: página de boas-vindas
 *   3. ClickUp: task de onboarding "Primeiros passos"
 *   4. Gmail: e-mail de boas-vindas personalizado (GPT-4o)
 *   5. Pontos: +50 pts bônus de ingresso
 *   6. Audit log
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getDecryptedToken } from "@/lib/integrations/token-vault";
import { grantAllAccess, type MemberAccessProfile } from "@/services/members/access.service";

export interface MemberJoinedPayload {
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberDiscordId?: string;
  institutionalEmail?: string;
  orgId: string;
  orgName: string;
  rank: string;
  department?: string;
}

interface StepResult { step: string; ok: boolean; data?: unknown; error?: string; }

async function runStep(name: string, fn: () => Promise<unknown>): Promise<StepResult> {
  try {
    const data = await fn();
    console.log(`[Onboarding] ✅ ${name}`);
    return { step: name, ok: true, data };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`[Onboarding] ⚠️ ${name}: ${error}`);
    return { step: name, ok: false, error };
  }
}

async function getOrgToken(orgId: string, provider: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("org_integrations")
    .select("access_token").eq("org_id", orgId).eq("provider", provider).single();
  if (!data) return null;
  return getDecryptedToken(data.access_token);
}

export async function handleMemberJoined(payload: MemberJoinedPayload) {
  const admin = createAdminClient();
  const results: StepResult[] = [];

  const accessProfile: MemberAccessProfile = {
    memberId: payload.memberId,
    memberName: payload.memberName,
    memberEmail: payload.memberEmail,
    institutionalEmail: payload.institutionalEmail,
    memberDiscordId: payload.memberDiscordId,
    rank: payload.rank,
    department: payload.department,
    orgId: payload.orgId,
  };

  // ── 1. Conceder acesso em todas as ferramentas ────────────
  const accessResults = await grantAllAccess(accessProfile);
  results.push(...accessResults);

  // Atualiza email institucional se foi criado
  const wsStep = accessResults.find(r => r.step === "google_workspace_email");
  const institutionalEmail =
    (wsStep?.data as { institutionalEmail?: string })?.institutionalEmail
    ?? payload.institutionalEmail
    ?? payload.memberEmail;

  // ── 2. ClickUp: task de onboarding ───────────────────────
  results.push(await runStep("clickup_onboarding_task", async () => {
    const token = await getOrgToken(payload.orgId, "clickup");
    if (!token) return { skipped: "no clickup" };

    const teamsRes = await fetch("https://api.clickup.com/api/v2/team", {
      headers: { Authorization: token },
    });
    const teams = await teamsRes.json() as { teams: Array<{ id: string }> };
    const teamId = teams.teams?.[0]?.id;
    if (!teamId) return { skipped: "no team" };

    const res = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/task`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `🎓 Onboarding — ${payload.memberName}`,
        description: `Checklist de integração para ${payload.memberName} (${payload.rank}).\nCompleto em 14 dias após ingresso.`,
        status: "to do",
        priority: 2,
        tags: ["onboarding", payload.rank],
      }),
    });
    const task = await res.json() as { id: string; url: string };
    return { taskId: task.id, taskUrl: task.url };
  }));

  // ── 3. Notion: página de boas-vindas ─────────────────────
  results.push(await runStep("notion_welcome_page", async () => {
    const token = await getOrgToken(payload.orgId, "notion");
    if (!token) return { skipped: "no notion" };

    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ query: "Wiki", filter: { value: "page", property: "object" } }),
    });
    const search = await searchRes.json() as { results: Array<{ id: string }> };
    const wikiPageId = search.results?.[0]?.id;

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: wikiPageId
          ? { type: "page_id", page_id: wikiPageId }
          : { type: "workspace", workspace: true },
        properties: {
          title: { title: [{ text: { content: `👋 Boas-vindas — ${payload.memberName}` } }] },
        },
        children: [
          { object: "block", type: "callout", callout: {
            icon: { type: "emoji", emoji: "🎉" },
            rich_text: [{ text: { content: `Bem-vindo(a) à ${payload.orgName}, ${payload.memberName}!` } }],
          }},
          { object: "block", type: "heading_2", heading_2: {
            rich_text: [{ text: { content: "📋 Checklist dos Primeiros 30 Dias" } }],
          }},
          ...["Completar perfil no Hïve", "Conectar ferramentas", "Participar de 2 reuniões",
              "Concluir 3 tarefas no ClickUp", "Apresentar-se no Discord"].map(item => ({
            object: "block", type: "to_do",
            to_do: { rich_text: [{ text: { content: item } }], checked: false },
          })),
        ],
      }),
    });
    const page = await res.json() as { id: string; url: string };
    return { pageId: page.id, pageUrl: page.url };
  }));

  // ── 4. Gmail: boas-vindas personalizado ──────────────────
  results.push(await runStep("gmail_welcome_email", async () => {
    const token = await getOrgToken(payload.orgId, "google_workspace");
    if (!token) return { skipped: "no google_workspace" };

    const rankPT: Record<string, string> = {
      trainee: "Trainee", assessor: "Assessor",
      project_leader: "Líder de Projeto", dept_leader: "Líder de Diretoria",
      director: "Diretor", president: "Presidente",
    };

    const html = `<div style="font-family:Inter,sans-serif;max-width:580px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#09254D,#4E378C);padding:32px;border-radius:16px 16px 0 0">
        <h1 style="color:#fff;font-size:24px;margin:0">Hïve 🐝</h1>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0 0">${payload.orgName}</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px">
        <h2 style="color:#09254D">Bem-vindo(a), ${payload.memberName.split(" ")[0]}! 🎉</h2>
        <p style="color:#64748b;line-height:1.6">
          Você ingressou como <strong>${rankPT[payload.rank] ?? payload.rank}</strong>${payload.department ? ` na diretoria de <strong>${payload.department}</strong>` : ""}.
        </p>
        ${institutionalEmail !== payload.memberEmail ? `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#166534;font-size:14px">
            📧 <strong>Seu e-mail institucional:</strong> ${institutionalEmail}<br>
            <span style="font-size:12px">Você receberá instruções para definir sua senha.</span>
          </p>
        </div>` : ""}
        <div style="background:#f0f9ff;border-left:4px solid #41C5C6;padding:16px;margin:16px 0;border-radius:0 8px 8px 0">
          <p style="margin:0;color:#0369a1;font-size:14px">
            🎁 <strong>Bônus de ingresso:</strong> 50 pontos adicionados à sua conta!
          </p>
        </div>
        <h3 style="color:#09254D">Para começar:</h3>
        <ol style="color:#64748b;line-height:2">
          <li>Complete seu perfil no Hïve</li>
          <li>Confira as tarefas de onboarding no ClickUp</li>
          <li>Explore a Wiki no Notion</li>
          <li>Diga olá no Discord! 👋</li>
        </ol>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard"
           style="display:inline-block;background:linear-gradient(135deg,#09254D,#4E378C);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600">
          Acessar o Hïve →
        </a>
      </div>
    </div>`;

    const message = [
      `To: ${payload.memberEmail}`,
      `Subject: 👋 Bem-vindo(a) ao Hïve — ${payload.orgName}`,
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
    if (!res.ok) throw new Error(`Gmail send failed: ${res.status}`);
    return { sent: true };
  }));

  // ── 5. Pontos: bônus de ingresso ─────────────────────────
  results.push(await runStep("bonus_points", async () => {
    await admin.rpc("award_points", {
      p_member_id: payload.memberId,
      p_organization_id: payload.orgId,
      p_points: 50,
      p_reason: "Bônus de ingresso — bem-vindo(a) à EJ!",
      p_reference_type: "onboarding",
      p_reference_id: payload.memberId,
    });
    return { points: 50 };
  }));

  // ── 6. Audit log ─────────────────────────────────────────
  await admin.from("audit_logs").insert({
    organization_id: payload.orgId,
    user_id: payload.memberId,
    action: "MEMBER_ONBOARDED",
    entity_type: "member",
    entity_id: payload.memberId,
    metadata: {
      memberName: payload.memberName,
      rank: payload.rank,
      institutionalEmail,
      steps: results,
      success: results.filter(r => r.ok).length,
      total: results.length,
    },
  });

  console.log(`[Onboarding] ${payload.memberName} — ${results.filter(r => r.ok).length}/${results.length} etapas ✅`);
  return results;
}
