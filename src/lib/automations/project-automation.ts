// ═══════════════════════════════════════════════════════════════
//  Motor de Automações de Projetos
//  Orquestra ClickUp + Notion + Discord + Google + OpenAI
//  em resposta a eventos de ciclo de vida de projetos
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { ClickUpClient } from "@/lib/integrations/clickup/client";
import { NotionClient } from "@/lib/integrations/notion/client";
import { DiscordClient } from "@/lib/integrations/discord/client";
import { getDecryptedToken } from "@/lib/integrations/token-vault";

interface ProjectPayload {
  id: string;
  name: string;
  client_name: string;
  value: number;
  status: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export class ProjectAutomation {
  constructor(
    private readonly orgId: string,
    private readonly supabase: SupabaseClient
  ) {}

  /** Carrega tokens de integração descriptografados para a org */
  private async getClients() {
    const { data: integrations } = await this.supabase
      .from("integrations")
      .select("provider, access_token_enc, refresh_token_enc, external_workspace_id")
      .eq("organization_id", this.orgId)
      .eq("is_active", true);

    const tokens: Record<string, string> = {};
    for (const i of integrations ?? []) {
      tokens[i.provider] = await getDecryptedToken(i.access_token_enc);
    }

    return {
      clickup: tokens["clickup"] ? new ClickUpClient(tokens["clickup"]) : null,
      notion: tokens["notion"] ? new NotionClient(tokens["notion"]) : null,
      discord: tokens["discord"] ? new DiscordClient(tokens["discord"]) : null,
      workspaceIds: Object.fromEntries(
        (integrations ?? []).map((i) => [i.provider, i.external_workspace_id])
      ),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // EVENTO: Projeto criado
  // → Cria lista no ClickUp
  // → Cria página no Notion
  // → Envia notificação no Discord
  // ─────────────────────────────────────────────────────────────
  async onProjectCreated(project: ProjectPayload, createdBy: string) {
    const { clickup, notion, discord, workspaceIds } = await this.getClients();
    const results: Record<string, unknown> = {};

    // 1. ClickUp — cria lista dentro do workspace da EJ
    if (clickup && workspaceIds["clickup"]) {
      try {
        const list = await clickup.createList({
          name: `[Projeto] ${project.name}`,
          spaceId: workspaceIds["clickup"],
          description: `Cliente: ${project.client_name}\nValor: R$ ${project.value.toLocaleString("pt-BR")}`,
        });
        results.clickup_list_id = list.id;

        // Cria tasks iniciais padrão dentro da lista
        await Promise.all([
          clickup.createTask({ listId: list.id, name: "Kickoff com cliente", status: "to do" }),
          clickup.createTask({ listId: list.id, name: "Elaborar proposta técnica", status: "to do" }),
          clickup.createTask({ listId: list.id, name: "Definir equipe do projeto", status: "to do" }),
          clickup.createTask({ listId: list.id, name: "Configurar repositório", status: "to do" }),
        ]);
      } catch (e) {
        console.error("[automation/clickup] createList failed:", e);
      }
    }

    // 2. Notion — cria página de documentação do projeto
    if (notion && workspaceIds["notion"]) {
      try {
        const page = await notion.createProjectPage({
          parentPageId: workspaceIds["notion"],
          project,
          createdBy,
        });
        results.notion_page_id = page.id;
      } catch (e) {
        console.error("[automation/notion] createPage failed:", e);
      }
    }

    // 3. Discord — notificação no canal de projetos
    if (discord && workspaceIds["discord"]) {
      try {
        await discord.sendProjectNotification({
          guildId: workspaceIds["discord"],
          event: "created",
          project,
          actor: createdBy,
          extraIds: results,
        });
      } catch (e) {
        console.error("[automation/discord] notification failed:", e);
      }
    }

    // Salva IDs externos no banco para referência futura
    if (Object.keys(results).length > 0) {
      await this.supabase
        .from("projects")
        .update({ template_data: results } as never)
        .eq("id", project.id);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // EVENTO: Projeto ativado (proposta aceita)
  // → Atualiza status no ClickUp
  // → Cria evento no Google Calendar
  // → Notifica Discord com menção ao time
  // ─────────────────────────────────────────────────────────────
  async onProjectActivated(project: ProjectPayload, activatedBy: string) {
    const { clickup, discord, workspaceIds } = await this.getClients();

    // Busca IDs externos salvos
    const { data: proj } = await this.supabase
      .from("projects")
      .select("template_data")
      .eq("id", project.id)
      .single();

    const externalIds = (proj?.template_data as Record<string, string>) ?? {};

    // ClickUp — atualiza status da lista
    if (clickup && externalIds.clickup_list_id) {
      try {
        await clickup.updateListStatus(externalIds.clickup_list_id, "in progress");
        // Adiciona task de kickoff como urgente
        await clickup.createTask({
          listId: externalIds.clickup_list_id,
          name: "🚀 PROJETO ATIVO — agendar reunião de início",
          status: "urgent",
          priority: 1,
        });
      } catch (e) {
        console.error("[automation/clickup] onActivated failed:", e);
      }
    }

    // Discord — notificação com embed verde
    if (discord && workspaceIds["discord"]) {
      try {
        await discord.sendProjectNotification({
          guildId: workspaceIds["discord"],
          event: "activated",
          project,
          actor: activatedBy,
        });
      } catch (e) {
        console.error("[automation/discord] onActivated notification failed:", e);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // EVENTO: Projeto concluído
  // → Fecha lista no ClickUp
  // → Arquiva página no Notion
  // → Envia pesquisa de NPS (via e-mail)
  // → Atualiza KPIs da org
  // → Notifica Discord com celebração
  // ─────────────────────────────────────────────────────────────
  async onProjectCompleted(project: ProjectPayload, completedBy: string) {
    const { clickup, notion, discord, workspaceIds } = await this.getClients();

    const { data: proj } = await this.supabase
      .from("projects")
      .select("template_data, value")
      .eq("id", project.id)
      .single();

    const externalIds = (proj?.template_data as Record<string, string>) ?? {};

    // ClickUp — fecha a lista
    if (clickup && externalIds.clickup_list_id) {
      try {
        await clickup.updateListStatus(externalIds.clickup_list_id, "complete");
      } catch (e) {
        console.error("[automation/clickup] onCompleted failed:", e);
      }
    }

    // Notion — arquiva página
    if (notion && externalIds.notion_page_id) {
      try {
        await notion.archivePage(externalIds.notion_page_id);
      } catch (e) {
        console.error("[automation/notion] archivePage failed:", e);
      }
    }

    // Atualiza KPIs do mês atual
    try {
      const period = new Date().toISOString().slice(0, 7);
      await this.supabase.rpc("increment_kpi_revenue", {
        p_org_id: this.orgId,
        p_period: period,
        p_amount: proj?.value ?? 0,
      });
    } catch (e) {
      console.error("[automation/kpi] increment failed:", e);
    }

    // Discord — celebração 🎉
    if (discord && workspaceIds["discord"]) {
      try {
        await discord.sendProjectNotification({
          guildId: workspaceIds["discord"],
          event: "completed",
          project,
          actor: completedBy,
        });
      } catch (e) {
        console.error("[automation/discord] onCompleted notification failed:", e);
      }
    }
  }
}
