// ─────────────────────────────────────────────────────────────
//  ClickUp API Client
//  Docs: https://clickup.com/api
// ─────────────────────────────────────────────────────────────

const BASE = "https://api.clickup.com/api/v2";

export class ClickUpClient {
  private headers: HeadersInit;

  constructor(private readonly token: string) {
    this.headers = {
      Authorization: token,
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
      throw new Error(`ClickUp ${method} ${path} → ${res.status}: ${err}`);
    }
    return res.json();
  }

  /** Retorna workspaces (teams) do usuário */
  async getTeams() {
    return this.req<{ teams: { id: string; name: string }[] }>("GET", "/team");
  }

  /** Retorna hierarchy: spaces → folders → lists */
  async getSpaces(teamId: string) {
    return this.req<{ spaces: unknown[] }>("GET", `/team/${teamId}/space?archived=false`);
  }

  /** Cria lista em um space */
  async createList(opts: { name: string; spaceId: string; description?: string }) {
    return this.req<{ id: string; name: string }>("POST", `/space/${opts.spaceId}/list`, {
      name: opts.name,
      content: opts.description ?? "",
    });
  }

  /** Atualiza status de uma lista */
  async updateListStatus(listId: string, status: string) {
    return this.req("PUT", `/list/${listId}`, { status });
  }

  /** Cria task em uma lista */
  async createTask(opts: {
    listId: string;
    name: string;
    status?: string;
    priority?: number;
    dueDate?: number;
    assignees?: number[];
    description?: string;
  }) {
    return this.req<{ id: string; url: string }>("POST", `/list/${opts.listId}/task`, {
      name: opts.name,
      status: opts.status ?? "to do",
      priority: opts.priority,
      due_date: opts.dueDate,
      assignees: opts.assignees ?? [],
      description: opts.description,
    });
  }

  /** Atualiza uma task */
  async updateTask(taskId: string, fields: Record<string, unknown>) {
    return this.req("PUT", `/task/${taskId}`, fields);
  }

  /** Lista tasks de uma lista */
  async getTasks(listId: string, params?: { status?: string; assignees?: string[] }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("statuses[]", params.status);
    return this.req<{ tasks: unknown[] }>("GET", `/list/${listId}/task?${qs}`);
  }

  /** Busca membro pelo e-mail */
  async findMemberByEmail(teamId: string, email: string) {
    const { members } = await this.req<{ members: { user: { id: number; email: string } }[] }>(
      "GET", `/team/${teamId}/member`
    );
    return members.find((m) => m.user.email === email)?.user ?? null;
  }
}
