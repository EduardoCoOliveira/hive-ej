// ─────────────────────────────────────────────────────────────
//  Notion API Client
//  Docs: https://developers.notion.com
// ─────────────────────────────────────────────────────────────

const BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

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

export class NotionClient {
  private headers: HeadersInit;

  constructor(token: string) {
    this.headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
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
      throw new Error(`Notion ${method} ${path} → ${res.status}: ${err}`);
    }
    return res.json();
  }

  /** Cria página de documentação de projeto */
  async createProjectPage(opts: {
    parentPageId: string;
    project: ProjectPayload;
    createdBy: string;
  }) {
    const { parentPageId, project, createdBy } = opts;
    return this.req<{ id: string; url: string }>("POST", "/pages", {
      parent: { page_id: parentPageId },
      icon: { emoji: "📁" },
      properties: {
        title: {
          title: [{ text: { content: `[Projeto] ${project.name}` } }],
        },
      },
      children: [
        // Seção: Informações gerais
        {
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: [{ text: { content: "📋 Informações Gerais" } }] },
        },
        {
          object: "block",
          type: "table",
          table: {
            table_width: 2,
            has_column_header: false,
            has_row_header: true,
            children: [
              { type: "table_row", table_row: { cells: [[{ text: { content: "Cliente" } }], [{ text: { content: project.client_name } }]] } },
              { type: "table_row", table_row: { cells: [[{ text: { content: "Valor" } }], [{ text: { content: `R$ ${project.value.toLocaleString("pt-BR")}` } }]] } },
              { type: "table_row", table_row: { cells: [[{ text: { content: "Responsável" } }], [{ text: { content: createdBy } }]] } },
              { type: "table_row", table_row: { cells: [[{ text: { content: "Status" } }], [{ text: { content: project.status } }]] } },
            ],
          },
        },
        // Seção: Escopo
        {
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: [{ text: { content: "🎯 Escopo do Projeto" } }] },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ text: { content: project.description ?? "Descreva o escopo do projeto aqui..." } }],
          },
        },
        // Seção: Reuniões
        {
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: [{ text: { content: "📅 Reuniões & Atas" } }] },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ text: { content: "Adicione atas de reuniões aqui." } }] },
        },
        // Seção: Entregas
        {
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: [{ text: { content: "✅ Entregas" } }] },
        },
        {
          object: "block",
          type: "to_do",
          to_do: { rich_text: [{ text: { content: "Kickoff realizado" } }], checked: false },
        },
        {
          object: "block",
          type: "to_do",
          to_do: { rich_text: [{ text: { content: "Entrega parcial aprovada" } }], checked: false },
        },
        {
          object: "block",
          type: "to_do",
          to_do: { rich_text: [{ text: { content: "Entrega final aprovada" } }], checked: false },
        },
      ],
    });
  }

  /** Arquiva uma página (projeto concluído) */
  async archivePage(pageId: string) {
    return this.req("PATCH", `/pages/${pageId}`, { archived: true });
  }

  /** Busca páginas por query */
  async search(query: string) {
    return this.req<{ results: unknown[] }>("POST", "/search", {
      query,
      filter: { value: "page", property: "object" },
    });
  }

  /** Adiciona bloco de texto a uma página (ex: ata de reunião sumarizada) */
  async appendMeetingSummary(pageId: string, summary: string, meetingTitle: string) {
    return this.req("PATCH", `/blocks/${pageId}/children`, {
      children: [
        {
          object: "block",
          type: "heading_3",
          heading_3: { rich_text: [{ text: { content: `📝 ${meetingTitle}` } }] },
        },
        {
          object: "block",
          type: "callout",
          callout: {
            icon: { emoji: "🤖" },
            rich_text: [{ text: { content: summary } }],
            color: "blue_background",
          },
        },
      ],
    });
  }
}
