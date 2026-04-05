// ─────────────────────────────────────────────────────────────
//  Discord Bot Client
//  Usa Discord REST API para webhooks + gestão de cargos
// ─────────────────────────────────────────────────────────────

const BASE = "https://discord.com/api/v10";

type ProjectEvent = "created" | "activated" | "completed" | "cancelled";

interface ProjectNotificationOpts {
  guildId: string;
  event: ProjectEvent;
  project: { name: string; client_name: string; value: number; status: string };
  actor: string;
  extraIds?: Record<string, unknown>;
}

const eventConfig: Record<ProjectEvent, { color: number; emoji: string; title: string }> = {
  created:   { color: 0x4EBBC0, emoji: "📁", title: "Novo projeto criado" },
  activated: { color: 0x41C5C6, emoji: "🚀", title: "Projeto ativado!" },
  completed: { color: 0x22c55e, emoji: "🎉", title: "Projeto concluído!" },
  cancelled: { color: 0xef4444, emoji: "❌", title: "Projeto cancelado" },
};

export class DiscordClient {
  private headers: HeadersInit;

  constructor(private readonly botToken: string) {
    this.headers = {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    };
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Discord ${method} ${path} → ${res.status}: ${err}`);
    }
    if (res.status === 204) return null as T;
    return res.json();
  }

  /** Busca o canal "projetos" ou "geral" automaticamente */
  private async findProjectChannel(guildId: string): Promise<string | null> {
    const channels = await this.req<{ id: string; name: string; type: number }[]>(
      "GET", `/guilds/${guildId}/channels`
    );
    // Prioridade: canal chamado "projetos" → "geral" → "general" → primeiro canal de texto
    const candidates = ["projetos", "projects", "geral", "general"];
    for (const name of candidates) {
      const found = channels.find((c) => c.name === name && c.type === 0);
      if (found) return found.id;
    }
    const firstText = channels.find((c) => c.type === 0);
    return firstText?.id ?? null;
  }

  /** Envia notificação de evento de projeto como embed */
  async sendProjectNotification(opts: ProjectNotificationOpts) {
    const channelId = await this.findProjectChannel(opts.guildId);
    if (!channelId) throw new Error("Nenhum canal de texto encontrado");

    const cfg = eventConfig[opts.event];
    const links: string[] = [];
    if (opts.extraIds?.clickup_list_id) {
      links.push(`[🟣 Abrir no ClickUp](https://app.clickup.com/t/${opts.extraIds.clickup_list_id})`);
    }
    if (opts.extraIds?.notion_page_id) {
      links.push(`[⬛ Abrir no Notion](https://notion.so/${String(opts.extraIds.notion_page_id).replace(/-/g, "")})`);
    }

    return this.req("POST", `/channels/${channelId}/messages`, {
      embeds: [
        {
          color: cfg.color,
          author: { name: `${cfg.emoji} ${cfg.title}` },
          title: opts.project.name,
          description: [
            `**Cliente:** ${opts.project.client_name}`,
            `**Valor:** R$ ${opts.project.value.toLocaleString("pt-BR")}`,
            links.length > 0 ? `\n${links.join(" · ")}` : "",
          ].filter(Boolean).join("\n"),
          footer: { text: `Por ${opts.actor} • Hï Tech Hub` },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  /** Envia mensagem direta a um membro */
  async sendDM(userId: string, content: string) {
    const dm = await this.req<{ id: string }>("POST", "/users/@me/channels", {
      recipient_id: userId,
    });
    return this.req("POST", `/channels/${dm.id}/messages`, { content });
  }

  /** Atribui cargo a um membro */
  async assignRole(guildId: string, userId: string, roleId: string) {
    return this.req("PUT", `/guilds/${guildId}/members/${userId}/roles/${roleId}`, {});
  }

  /** Remove cargo de um membro */
  async removeRole(guildId: string, userId: string, roleId: string) {
    return this.req("DELETE", `/guilds/${guildId}/members/${userId}/roles/${roleId}`, {});
  }

  /** Lista membros do servidor */
  async getMembers(guildId: string) {
    return this.req<{ user: { id: string; username: string; email?: string } }[]>(
      "GET", `/guilds/${guildId}/members?limit=100`
    );
  }
}
