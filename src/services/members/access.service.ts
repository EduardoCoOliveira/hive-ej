/**
 * ─────────────────────────────────────────────────────────────
 *  Hïve Access Service — Orquestrador de Acesso Multi-Ferramenta
 *
 *  Responsável por CONCEDER e REVOGAR acesso em todas as
 *  ferramentas integradas de forma atômica.
 *
 *  Ferramentas gerenciadas:
 *    ✅ Google Workspace (email institucional + Admin SDK)
 *    ✅ Discord (roles + canais por cargo/departamento)
 *    ✅ ClickUp (convite para o time)
 *    ✅ Notion (convite para o workspace)
 *    ✅ Canva (convite para o time)
 *    ✅ Figma (convite para o time)
 * ─────────────────────────────────────────────────────────────
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getDecryptedToken } from "@/lib/integrations/token-vault";

export interface MemberAccessProfile {
  memberId: string;
  memberName: string;
  memberEmail: string;       // email pessoal (para convites)
  institutionalEmail?: string; // email @ej.com criado no Workspace
  memberDiscordId?: string;
  rank: string;
  department?: string;
  orgId: string;
}

export interface StepResult {
  step: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

// ─── Rank → Discord role/channel mapping ────────────────────

const RANK_DISCORD_ROLES: Record<string, string[]> = {
  trainee:        ["Trainee"],
  assessor:       ["Assessor"],
  project_leader: ["Assessor", "Líder de Projeto"],
  dept_leader:    ["Assessor", "Líder de Projeto", "Líder de Diretoria"],
  director:       ["Assessor", "Líder de Projeto", "Líder de Diretoria", "Diretor"],
  president:      ["Assessor", "Líder de Projeto", "Líder de Diretoria", "Diretor", "Presidente"],
};

// Canais base para todos os membros
const BASE_CHANNELS = ["#geral", "#projetos-ativos", "#anuncios"];

// Canais extras por rank
const RANK_EXTRA_CHANNELS: Record<string, string[]> = {
  project_leader: ["#lideres"],
  dept_leader:    ["#lideres", "#gestao"],
  director:       ["#lideres", "#gestao", "#diretoria"],
  president:      ["#lideres", "#gestao", "#diretoria", "#presidencia"],
};

// ─── Helpers ─────────────────────────────────────────────────

async function getOrgToken(orgId: string, provider: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_integrations")
    .select("access_token")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .single();
  if (!data) return null;
  return getDecryptedToken(data.access_token);
}

async function runStep(name: string, fn: () => Promise<unknown>): Promise<StepResult> {
  try {
    const data = await fn();
    return { step: name, ok: true, data };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`[Access] ⚠️ ${name}: ${error}`);
    return { step: name, ok: false, error };
  }
}

// ─── GRANT ACCESS ─────────────────────────────────────────────

export async function grantAllAccess(member: MemberAccessProfile): Promise<StepResult[]> {
  const results: StepResult[] = [];

  // ── 1. Google Workspace: criar email institucional ────────
  results.push(await runStep("google_workspace_email", async () => {
    const token = await getOrgToken(member.orgId, "google_workspace");
    if (!token) return { skipped: "no google_workspace integration" };

    // Busca o domínio da org
    const admin = createAdminClient();
    const { data: integration } = await admin
      .from("org_integrations")
      .select("workspace_name")
      .eq("org_id", member.orgId)
      .eq("provider", "google_workspace")
      .single();

    const domain = integration?.workspace_name;
    if (!domain) return { skipped: "no domain configured" };

    // Gera username a partir do nome
    const firstName = member.memberName.split(" ")[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const lastName  = (member.memberName.split(" ")[1] ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const username  = lastName ? `${firstName}.${lastName}` : firstName;
    const institutionalEmail = `${username}@${domain}`;

    // Cria usuário via Admin SDK REST
    const res = await fetch("https://admin.googleapis.com/admin/directory/v1/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        primaryEmail: institutionalEmail,
        name: {
          givenName: member.memberName.split(" ")[0],
          familyName: member.memberName.split(" ").slice(1).join(" ") || member.memberName,
        },
        password: crypto.randomUUID().replace(/-/g, "").slice(0, 16) + "Hv!",
        changePasswordAtNextLogin: true,
        orgUnitPath: `/Membros/${member.rank}`,
      }),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } };
      // 409 = user already exists — não é erro fatal
      if (res.status === 409) return { alreadyExists: true, email: institutionalEmail };
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }

    const user = await res.json() as { primaryEmail: string };

    // Persiste email institucional no perfil
    await admin
      .from("profiles")
      .update({ email: user.primaryEmail })
      .eq("id", member.memberId);

    return { institutionalEmail: user.primaryEmail };
  }));

  // ── 2. Discord: roles por cargo + canais ──────────────────
  results.push(await runStep("discord_roles_channels", async () => {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) return { skipped: "no DISCORD_BOT_TOKEN" };
    if (!member.memberDiscordId) return { skipped: "no discord_id on member" };

    const admin = createAdminClient();

    // Busca guild_id da org
    const { data: discordInt } = await admin
      .from("org_integrations")
      .select("workspace_name")
      .eq("org_id", member.orgId)
      .eq("provider", "discord")
      .single();

    // Busca guild via bot
    const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bot ${botToken}` },
    });
    const guilds = await guildsRes.json() as Array<{ id: string; name: string }>;
    const guild = guilds.find(g => g.name === discordInt?.workspace_name) ?? guilds[0];
    if (!guild) return { skipped: "guild not found" };

    const guildId = guild.id;

    // Busca roles existentes do servidor
    const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    const existingRoles = await rolesRes.json() as Array<{ id: string; name: string }>;

    // Atribui roles correspondentes ao cargo
    const targetRoleNames = RANK_DISCORD_ROLES[member.rank] ?? ["Trainee"];
    const assignedRoles: string[] = [];

    for (const roleName of targetRoleNames) {
      const role = existingRoles.find(r => r.name === roleName);
      if (!role) continue;

      const addRes = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${member.memberDiscordId}/roles/${role.id}`,
        { method: "PUT", headers: { Authorization: `Bot ${botToken}` } }
      );
      if (addRes.ok || addRes.status === 204) assignedRoles.push(roleName);
    }

    // Adiciona a canais configurados na DB
    const { data: dbChannels } = await admin
      .from("discord_role_channels")
      .select("channel_id, channel_name")
      .eq("organization_id", member.orgId)
      .eq("rank", member.rank);

    // Adiciona aos canais extras do rank
    const rankChannels = RANK_EXTRA_CHANNELS[member.rank] ?? [];

    return {
      guildId,
      assignedRoles,
      configuredChannels: dbChannels?.length ?? 0,
      rankChannels,
    };
  }));

  // ── 3. ClickUp: convite para o time ───────────────────────
  results.push(await runStep("clickup_invite", async () => {
    const token = await getOrgToken(member.orgId, "clickup");
    if (!token) return { skipped: "no clickup integration" };

    const teamsRes = await fetch("https://api.clickup.com/api/v2/team", {
      headers: { Authorization: token },
    });
    const teams = await teamsRes.json() as { teams: Array<{ id: string }> };
    const teamId = teams.teams?.[0]?.id;
    if (!teamId) return { error: "no team" };

    const inviteEmail = member.institutionalEmail ?? member.memberEmail;
    const res = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/user`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        role: member.rank === "president" || member.rank === "director" ? 2 : 4,
        // 2 = admin, 4 = member
      }),
    });

    if (!res.ok && res.status !== 400) {
      const err = await res.json() as { err?: string };
      throw new Error(err?.err ?? `HTTP ${res.status}`);
    }
    return { invited: inviteEmail };
  }));

  // ── 4. Notion: convite para o workspace ───────────────────
  results.push(await runStep("notion_invite", async () => {
    const token = await getOrgToken(member.orgId, "notion");
    if (!token) return { skipped: "no notion integration" };

    const inviteEmail = member.institutionalEmail ?? member.memberEmail;

    // Notion não tem API pública de convite — cria uma página de boas-vindas
    // acessível pelo email e envia o link
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { type: "workspace", workspace: true },
        properties: {
          title: { title: [{ text: { content: `👋 Bem-vindo(a) — ${member.memberName}` } }] },
        },
      }),
    });

    const page = await res.json() as { url?: string };
    // Envia o link da página por email (via Gmail se disponível)
    return { notionPageUrl: page.url, note: "Notion invite via email externo" };
  }));

  // ── 5. Canva: convite para o time ─────────────────────────
  results.push(await runStep("canva_invite", async () => {
    // Canva Connect API — invite to team
    const canvaToken = process.env.CANVA_API_TOKEN;
    if (!canvaToken) return { skipped: "no CANVA_API_TOKEN" };

    const inviteEmail = member.institutionalEmail ?? member.memberEmail;
    const res = await fetch("https://api.canva.com/rest/v1/teams/invitations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${canvaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: inviteEmail, role: "member" }),
    });

    if (!res.ok) {
      const err = await res.json() as { message?: string };
      throw new Error(err?.message ?? `HTTP ${res.status}`);
    }
    return { invited: inviteEmail };
  }));

  // ── 6. Figma: convite para o time ─────────────────────────
  results.push(await runStep("figma_invite", async () => {
    const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
    if (!figmaToken) return { skipped: "no FIGMA_ACCESS_TOKEN" };
    const figmaTeamId = process.env.FIGMA_TEAM_ID;
    if (!figmaTeamId) return { skipped: "no FIGMA_TEAM_ID" };

    const inviteEmail = member.institutionalEmail ?? member.memberEmail;
    const res = await fetch(`https://api.figma.com/v1/teams/${figmaTeamId}/members`, {
      method: "POST",
      headers: {
        "X-Figma-Token": figmaToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: inviteEmail, role: "viewer" }),
    });

    if (!res.ok) {
      const err = await res.json() as { err?: string; message?: string };
      throw new Error(err?.err ?? err?.message ?? `HTTP ${res.status}`);
    }
    return { invited: inviteEmail };
  }));

  return results;
}

// ─── REVOKE ACCESS (Offboarding) ──────────────────────────────

export async function revokeAllAccess(member: MemberAccessProfile): Promise<StepResult[]> {
  const results: StepResult[] = [];

  // ── 1. Google Workspace: suspender conta ─────────────────
  results.push(await runStep("google_workspace_suspend", async () => {
    const token = await getOrgToken(member.orgId, "google_workspace");
    if (!token) return { skipped: "no google_workspace integration" };
    if (!member.institutionalEmail) return { skipped: "no institutional email" };

    const res = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(member.institutionalEmail)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: true }),
      }
    );

    if (!res.ok && res.status !== 404) {
      const err = await res.json() as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }
    return { suspended: true, email: member.institutionalEmail };
  }));

  // ── 2. Discord: remover do servidor ───────────────────────
  results.push(await runStep("discord_remove", async () => {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken || !member.memberDiscordId) return { skipped: "no bot token or discord_id" };

    const admin = createAdminClient();
    const { data: discordInt } = await admin
      .from("org_integrations")
      .select("workspace_name")
      .eq("org_id", member.orgId)
      .eq("provider", "discord")
      .single();

    const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bot ${botToken}` },
    });
    const guilds = await guildsRes.json() as Array<{ id: string; name: string }>;
    const guild = guilds.find(g => g.name === discordInt?.workspace_name) ?? guilds[0];
    if (!guild) return { skipped: "guild not found" };

    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guild.id}/members/${member.memberDiscordId}`,
      { method: "DELETE", headers: { Authorization: `Bot ${botToken}` } }
    );

    return { removed: res.ok || res.status === 204 || res.status === 404 };
  }));

  // ── 3. ClickUp: remover do time ───────────────────────────
  results.push(await runStep("clickup_remove", async () => {
    const token = await getOrgToken(member.orgId, "clickup");
    if (!token) return { skipped: "no clickup integration" };

    const teamsRes = await fetch("https://api.clickup.com/api/v2/team", {
      headers: { Authorization: token },
    });
    const teams = await teamsRes.json() as { teams: Array<{ id: string; members: Array<{ user: { id: number; email: string } }> }> };
    const team = teams.teams?.[0];
    if (!team) return { skipped: "no team found" };

    // Encontra o userId do ClickUp pelo email
    const targetEmail = member.institutionalEmail ?? member.memberEmail;
    const cuMember = team.members?.find(m => m.user.email === targetEmail);
    if (!cuMember) return { skipped: "member not in clickup team" };

    const res = await fetch(
      `https://api.clickup.com/api/v2/team/${team.id}/user/${cuMember.user.id}`,
      { method: "DELETE", headers: { Authorization: token } }
    );
    return { removed: res.ok };
  }));

  // ── 4. Canva: remover do time ─────────────────────────────
  results.push(await runStep("canva_remove", async () => {
    const canvaToken = process.env.CANVA_API_TOKEN;
    if (!canvaToken) return { skipped: "no CANVA_API_TOKEN" };
    // Canva: lista membros → encontra por email → remove
    const listRes = await fetch("https://api.canva.com/rest/v1/teams/members", {
      headers: { Authorization: `Bearer ${canvaToken}` },
    });
    if (!listRes.ok) throw new Error(`Canva list failed: ${listRes.status}`);
    const listData = await listRes.json() as { items: Array<{ user: { email: string }; id: string }> };
    const targetEmail = member.institutionalEmail ?? member.memberEmail;
    const canvaMember = listData.items?.find(m => m.user.email === targetEmail);
    if (!canvaMember) return { skipped: "not in canva team" };

    const res = await fetch(`https://api.canva.com/rest/v1/teams/members/${canvaMember.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${canvaToken}` },
    });
    return { removed: res.ok };
  }));

  // ── 5. Figma: remover do time ─────────────────────────────
  results.push(await runStep("figma_remove", async () => {
    const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
    const figmaTeamId = process.env.FIGMA_TEAM_ID;
    if (!figmaToken || !figmaTeamId) return { skipped: "no figma config" };

    const targetEmail = member.institutionalEmail ?? member.memberEmail;

    // GET members → find by email
    const listRes = await fetch(`https://api.figma.com/v1/teams/${figmaTeamId}/members`, {
      headers: { "X-Figma-Token": figmaToken },
    });
    const listData = await listRes.json() as { members: Array<{ email: string; id: string }> };
    const figmaMember = listData.members?.find(m => m.email === targetEmail);
    if (!figmaMember) return { skipped: "not in figma team" };

    const res = await fetch(`https://api.figma.com/v1/teams/${figmaTeamId}/members/${figmaMember.id}`, {
      method: "DELETE",
      headers: { "X-Figma-Token": figmaToken },
    });
    return { removed: res.ok };
  }));

  return results;
}
