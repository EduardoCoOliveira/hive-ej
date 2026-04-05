/**
 * Hïve — PROJECT_CREATED Handler
 *
 * A reação em cadeia completa quando um projeto nasce.
 * Cada serviço recebe o mesmo contexto rico e age de forma independente.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createProjectFolder, createScopeDocument } from "@/services/google/drive.service";
import { findBestMeetingSlots, scheduleProjectKickoff } from "@/services/google/calendar.service";
import { generateLeaderPlaybook } from "@/services/openai/playbook.service";
import type { ProjectCreatedPayload } from "@/lib/events/payloads";

interface StepResult {
  step: string;
  status: "success" | "failed" | "skipped";
  result?: Record<string, unknown>;
  durationMs?: number;
}

export async function onProjectCreated(payload: ProjectCreatedPayload): Promise<void> {
  const { projectId, orgId, project, team, enabledIntegrations, leaderId } = payload;
  const admin = createAdminClient();
  const results: StepResult[] = [];
  const externalIds: Record<string, string | null> = {};

  console.info(`[ProjectCreated] Starting atomic initiation for project "${project.name}" (${projectId})`);

  // ── Helper: run a step, measure time, log result ──────────────────────
  async function runStep<T>(
    stepName: string,
    enabled: boolean,
    fn: () => Promise<T | null>
  ): Promise<T | null> {
    if (!enabled) {
      results.push({ step: stepName, status: "skipped" });
      return null;
    }

    const t0 = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - t0;
      results.push({
        step: stepName,
        status: "success",
        result: result as Record<string, unknown> ?? undefined,
        durationMs,
      });
      return result;
    } catch (error) {
      const durationMs = Date.now() - t0;
      console.error(`[ProjectCreated][${stepName}] Failed:`, error);
      results.push({
        step: stepName,
        status: "failed",
        result: { error: String(error) },
        durationMs,
      });
      return null;
    }
  }

  // ── STEP 1: Google Drive — Criar estrutura de pastas ──────────────────
  const driveResult = await runStep("drive", enabledIntegrations.googleDrive, async () => {
    const folders = await createProjectFolder(orgId, project.name, project.slug);
    if (folders) {
      externalIds.driveFolderId = folders.rootFolderId;

      // Also create scope document if Google Docs is enabled
      if (enabledIntegrations.googleDocs && project.clientContext) {
        const docId = await createScopeDocument(
          orgId,
          folders.docsFolderId,
          project.name,
          project.clientName,
          project.clientContext
        );
        if (docId) externalIds.driveDocId = docId;
      }
    }
    return folders;
  });

  // ── STEP 2: Discord — Criar canal do projeto ──────────────────────────
  const discordResult = await runStep("discord", enabledIntegrations.discord, async () => {
    const { data: integration } = await admin
      .from("integrations")
      .select("config")
      .eq("org_id", orgId)
      .eq("provider", "discord")
      .eq("is_active", true)
      .single();

    if (!integration?.config?.guild_id || !process.env.DISCORD_BOT_TOKEN) return null;

    const guildId = integration.config.guild_id;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelName = `proj-${project.slug.slice(0, 80)}`;

    // Create channel
    const channelRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: channelName,
        type: 0, // Text channel
        topic: `Canal do projeto **${project.name}** — Cliente: ${project.clientName}`,
        parent_id: integration.config.projects_category_id ?? undefined,
      }),
    });

    if (!channelRes.ok) throw new Error(`Discord API: ${channelRes.status}`);
    const channel = await channelRes.json();
    externalIds.discordChannelId = channel.id;

    // Send kickoff message in channel
    await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [{
          title: `🚀 Projeto ${project.name} foi iniciado!`,
          description: `**Cliente:** ${project.clientName}\n**Valor:** R$ ${project.value.toLocaleString("pt-BR")}\n\nBem-vindos ao canal oficial do projeto. Vamos voar juntos! 🐝`,
          color: 0x41C5C6,
          timestamp: new Date().toISOString(),
          footer: { text: "Hïve — Automatizado" },
        }],
      }),
    });

    return { channelId: channel.id, channelName };
  });

  // ── STEP 3: ClickUp — Criar lista + tarefas iniciais ─────────────────
  const clickupResult = await runStep("clickup", enabledIntegrations.clickup, async () => {
    const { data: integration } = await admin
      .from("integrations")
      .select("config, encrypted_token")
      .eq("org_id", orgId)
      .eq("provider", "clickup")
      .eq("is_active", true)
      .single();

    if (!integration?.config?.space_id) return null;

    const { getDecryptedToken } = await import("@/lib/integrations/token-vault");
    const token = await getDecryptedToken(integration.encrypted_token);
    const spaceId = integration.config.space_id;

    // Create list for the project
    const listRes = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/list`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: project.name,
        content: `Projeto para ${project.clientName}. Valor: R$ ${project.value.toLocaleString("pt-BR")}`,
        due_date: project.endDate ? new Date(project.endDate).getTime() : undefined,
        start_date: project.startDate ? new Date(project.startDate).getTime() : undefined,
        status: "active",
      }),
    });

    if (!listRes.ok) throw new Error(`ClickUp API: ${listRes.status}`);
    const list = await listRes.json();
    externalIds.clickupListId = list.id;

    // Create initial tasks (Playbook de início)
    const initialTasks = [
      { name: "📋 Definir escopo detalhado", description: "Documento de escopo assinado pelo cliente" },
      { name: "👥 Montar e apresentar equipe ao cliente", description: "Reunião de kickoff realizada" },
      { name: "📅 Definir cronograma de reuniões semanais", description: "Calendário compartilhado configurado" },
      { name: "✍️ Assinar contrato de prestação de serviços", description: "Contrato revisado e assinado" },
    ];

    await Promise.all(initialTasks.map((task) =>
      fetch(`https://api.clickup.com/api/v2/list/${list.id}/task`, {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ name: task.name, description: task.description }),
      })
    ));

    return { listId: list.id, tasksCreated: initialTasks.length };
  });

  // ── STEP 4: Notion — Criar página do projeto ──────────────────────────
  const notionResult = await runStep("notion", enabledIntegrations.notion, async () => {
    const { data: integration } = await admin
      .from("integrations")
      .select("config, encrypted_token")
      .eq("org_id", orgId)
      .eq("provider", "notion")
      .eq("is_active", true)
      .single();

    if (!integration?.config?.projects_database_id) return null;

    const { getDecryptedToken } = await import("@/lib/integrations/token-vault");
    const token = await getDecryptedToken(integration.encrypted_token);

    const pageRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: integration.config.projects_database_id },
        icon: { emoji: "🚀" },
        properties: {
          Name: { title: [{ text: { content: project.name } }] },
          Cliente: { rich_text: [{ text: { content: project.clientName } }] },
          Status: { select: { name: "Em andamento" } },
          Valor: { number: project.value },
        },
        children: [
          {
            object: "block",
            type: "heading_2",
            heading_2: { rich_text: [{ text: { content: "🎯 Contexto do Projeto" } }] },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ text: { content: project.clientContext || "Contexto a ser preenchido." } }],
            },
          },
          {
            object: "block",
            type: "heading_2",
            heading_2: { rich_text: [{ text: { content: "📋 Atas de Reunião" } }] },
          },
          {
            object: "block",
            type: "divider",
            divider: {},
          },
        ],
      }),
    });

    if (!pageRes.ok) throw new Error(`Notion API: ${pageRes.status}`);
    const page = await pageRes.json();
    externalIds.notionPageId = page.id;
    return { pageId: page.id };
  });

  // ── STEP 5: Miro — Criar Project Canvas (Premium) ─────────────────────
  await runStep("miro", enabledIntegrations.miro && team.length > 0, async () => {
    const { data: integration } = await admin
      .from("integrations")
      .select("encrypted_token, config")
      .eq("org_id", orgId)
      .eq("provider", "miro")
      .eq("is_active", true)
      .single();

    if (!integration) return null;

    const { getDecryptedToken } = await import("@/lib/integrations/token-vault");
    const token = await getDecryptedToken(integration.encrypted_token);
    const teamId = integration.config?.team_id;

    const boardRes = await fetch("https://api.miro.com/v2/boards", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Project Canvas — ${project.name}`,
        description: `Board do projeto ${project.name} para ${project.clientName}. Gerenciado pelo Hïve.`,
        teamId,
        policy: { permissionsPolicy: { collaborationToolsStartAccess: "all_editors" } },
      }),
    });

    if (!boardRes.ok) throw new Error(`Miro API: ${boardRes.status}`);
    const board = await boardRes.json();
    externalIds.miroBoardId = board.id;
    return { boardId: board.id, boardLink: board.viewLink };
  });

  // ── STEP 6: Google Calendar — Agendar Kickoff ─────────────────────────
  if (enabledIntegrations.googleCalendar && payload.scheduleKickoff && team.length > 0) {
    await runStep("calendar", true, async () => {
      const slots = await findBestMeetingSlots(orgId, team, 60, 7);
      if (slots.length === 0) return null;

      const bestSlot = slots[0];
      const attendeeEmails = team.map((m) => m.email).filter(Boolean);

      const eventId = await scheduleProjectKickoff(
        orgId,
        bestSlot,
        project.name,
        projectId,
        attendeeEmails
      );

      if (eventId) externalIds.calendarEventId = eventId;
      return { eventId, slot: bestSlot };
    });
  }

  // ── STEP 7: GPT-4o — Gerar Playbook do Líder ─────────────────────────
  await runStep("playbook", true, async () => {
    const leaderProfile = team.find((m) => m.id === leaderId);
    if (!leaderProfile) return null;

    const guide = await generateLeaderPlaybook(
      {
        projectName: project.name,
        clientName: project.clientName,
        clientContext: project.clientContext,
        value: project.value,
        startDate: project.startDate,
        endDate: project.endDate,
        teamSize: team.length,
        teamSkills: project.requiredSkills,
        leaderName: leaderProfile.fullName,
        completedProjects: leaderProfile.completedProjects,
      },
      "pre_kickoff"
    );

    if (guide) {
      await admin.from("playbooks").insert({
        org_id: orgId,
        project_id: projectId,
        step: "pre_kickoff",
        title: guide.title,
        content: guide,
      });
    }

    return guide ? { step: "pre_kickoff", title: guide.title } : null;
  });

  // ── STEP 8: Persist all external IDs back to the project ─────────────
  const filteredIds = Object.fromEntries(
    Object.entries(externalIds).filter(([, v]) => v !== null)
  );

  if (Object.keys(filteredIds).length > 0) {
    await admin
      .from("projects")
      .update({ external_ids: filteredIds })
      .eq("id", projectId);
  }

  // ── STEP 9: Persist initiation log ───────────────────────────────────
  await admin.from("atomic_initiation_log").insert(
    results.map((r) => ({
      org_id: orgId,
      project_id: projectId,
      step: r.step,
      status: r.status,
      result: r.result,
      duration_ms: r.durationMs,
    }))
  ).catch(() => {});

  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.info(
    `[ProjectCreated] Atomic initiation complete for "${project.name}": ${succeeded} succeeded, ${failed} failed, ${results.length - succeeded - failed} skipped`
  );
}
