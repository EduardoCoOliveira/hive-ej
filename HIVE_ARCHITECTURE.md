# Hïve — Arquitetura do Sistema
> Sócio-Arquiteto: Claude | Lead Developer: Claude + Eduardo Oliveira
> Filosofia: **Mesh Thinking** — nenhum dado é isolado. Todo evento ecoa pela rede.

---

## 1. Visão Geral

Hïve é uma plataforma de gestão inteligente para Empresas Juniores (EJs) brasileiras.
Não é um CRUD. É um **sistema de eventos distribuídos** onde cada ação dispara uma
reação em cadeia em todas as ferramentas conectadas.

```
USUÁRIO → HÏVE → [Google Drive + Docs] → [Discord] → [ClickUp] → [Notion] → [Miro] → [Figma] → [GPT-4o]
```

**Princípio central:** O Hïve é o hub nervoso. Cada integração é um neurônio.
Quando um neurônio dispara, os outros respondem.

---

## 2. Stack Técnica

| Camada | Tecnologia | Papel |
|--------|-----------|-------|
| Frontend | Next.js 14 App Router + TypeScript | Hub nervoso central |
| Banco de dados | Supabase (PostgreSQL + RLS) | Fonte da verdade |
| Auth | Supabase Auth (Google OAuth + Magic Link) | Autenticação + SSO |
| Storage | Supabase Storage | Arquivos, PDFs, uploads |
| Realtime | Supabase Realtime | Live updates sem polling |
| Estilo | Tailwind CSS + CSS Variables | IDV Hïve |
| Pagamentos | Stripe | Planos Free / Premium / Internal |
| IA | OpenAI GPT-4o | Playbooks, Smart Match, análises |

### Integrações Ativas
- Google Drive + Docs + Calendar (OAuth2)
- Discord (Bot API + Webhooks)
- ClickUp (REST API + Webhooks)
- Notion (API v2)
- Miro (REST API)
- Canva (API)
- Figma (API)
- Stripe (Webhooks)

### Integrações Roadmap
- WhatsApp Business API (Q3 2026)
- GitHub (Q3 2026)
- Portal Brasil Júnior (Q4 2026)
- Trello (Q4 2026)

---

## 3. Arquitetura de Pastas

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login, Registro, Callback
│   ├── (dashboard)/            # Dashboard principal (autenticado)
│   │   ├── dashboard/          # Visão geral + KPIs
│   │   ├── projetos/           # Gestão de projetos (Kanban + List)
│   │   │   ├── novo/           # Formulário de Iniciação Atômica
│   │   │   └── [id]/           # Project Hub individual
│   │   ├── project-hub/        # Visão agregada de TODOS os projetos
│   │   ├── competencias/       # Skill Matrix + Smart Match
│   │   ├── playbooks/          # Playbooks de Liderança (GPT-4o)
│   │   ├── pontos/             # Sistema de Pontos & Ranking
│   │   ├── financeiro/         # KPIs Brasil Júnior
│   │   ├── wiki/               # Wiki de Bastão
│   │   ├── documentos/         # PDF Automation
│   │   ├── integracoes/        # Connect/Disconnect de ferramentas
│   │   └── configuracoes/      # Org settings + hierarquia
│   └── api/                    # API Routes (server-side)
│       ├── atomic/             # Iniciação Atômica (orquestrador principal)
│       ├── smart-match/        # Algoritmo de alocação
│       ├── playbooks/          # Geração de playbooks via GPT-4o
│       ├── webhooks/           # Receptores de webhooks externos
│       │   ├── stripe/
│       │   ├── clickup/
│       │   ├── discord/
│       │   └── notion/
│       └── integracoes/        # Endpoints de conexão OAuth
│
├── services/                   # Lógica isolada por integração (NOVA CAMADA)
│   ├── google/
│   │   ├── drive.service.ts    # Criar pastas, templates, compartilhar
│   │   ├── docs.service.ts     # Criar documentos, inserir conteúdo
│   │   └── calendar.service.ts # FreeBusy, criar eventos, Smart Match
│   ├── discord/
│   │   ├── bot.service.ts      # Canais, roles, mensagens
│   │   └── sentiment.service.ts # Análise de sentimento (GPT-4o)
│   ├── clickup/
│   │   ├── tasks.service.ts    # CRUD de tarefas, listas
│   │   └── ranking.service.ts  # Expert Ranking por conclusão de tarefas
│   ├── notion/
│   │   └── pages.service.ts    # Criar/atualizar páginas e databases
│   ├── miro/
│   │   └── board.service.ts    # Criar boards, Project Canvas
│   ├── openai/
│   │   ├── playbook.service.ts # Guias de liderança personalizados
│   │   ├── summary.service.ts  # Sumarização de reuniões / backups
│   │   └── context.service.ts  # JSON context → prompts automáticos
│   └── stripe/
│       └── billing.service.ts  # Checkout, planos, webhooks
│
├── lib/                        # Utilitários e clientes base
│   ├── supabase/               # Client (browser) + Server + Admin
│   ├── auth/                   # Domain check, plan tier
│   ├── integrations/           # Clientes base (legado, migrar p/ services/)
│   ├── automations/            # Orquestrador de automações (Mesh Engine)
│   └── events/                 # Event Bus interno (publish/subscribe)
│
├── components/
│   ├── layout/                 # Sidebar, Header
│   ├── ui/                     # Botões, Inputs, Modals
│   ├── projects/               # KanbanCard, ProjectHub, etc
│   ├── competencias/           # SkillMatrix, AllocationSuggester
│   ├── playbooks/              # PlaybookCard, StepGuide
│   └── pontos/                 # RankingTable, PointsBadge
│
└── types/                      # TypeScript types globais
```

---

## 4. Sistema de Hierarquia da EJ

### Cargos e Permissões

| Cargo | Código | Permissões |
|-------|--------|-----------|
| Trainee | `trainee` | Visualizar projetos, atualizar tarefas próprias |
| Assessor | `assessor` | Trainee + criar tarefas, registrar horas |
| Líder de Projeto | `project_leader` | Assessor + alocar membros, avançar status, gerar docs |
| Líder de Departamento | `dept_leader` | Project Leader + criar projetos, configurar playbooks |
| Diretor | `director` | Dept Leader + acessar financeiro, ver ranking completo |
| Presidente | `president` | Acesso total, configurar org, integrações |

### Permissões por Módulo

```typescript
type Permission =
  | "projects.create"       // Criar projetos
  | "projects.allocate"     // Alocar membros
  | "projects.advance"      // Mudar status
  | "competencias.edit"     // Editar skills
  | "financeiro.view"       // Ver dados financeiros
  | "pontos.manage"         // Gerenciar sistema de pontos
  | "integrations.connect"  // Conectar/desconectar APIs
  | "org.settings"          // Configurar organização
  | "playbooks.customize"   // Personalizar playbooks
  | "api.choose"            // Escolher quais APIs usar por projeto
```

---

## 5. Sistema de Eventos (Mesh Engine)

Hïve opera como um barramento de eventos. Cada ação gera um evento tipado.

### Eventos Principais

```typescript
type HiveEvent =
  // Projetos
  | { type: "PROJECT_CREATED"; payload: ProjectCreatedPayload }
  | { type: "PROJECT_ACTIVATED"; payload: ProjectActivatedPayload }
  | { type: "PROJECT_COMPLETED"; payload: ProjectCompletedPayload }
  | { type: "PROJECT_PAUSED"; payload: ProjectPausedPayload }

  // Membros
  | { type: "MEMBER_JOINED"; payload: MemberJoinedPayload }
  | { type: "TASK_COMPLETED"; payload: TaskCompletedPayload }
  | { type: "SKILL_UPDATED"; payload: SkillUpdatedPayload }

  // Pontos
  | { type: "POINTS_AWARDED"; payload: PointsPayload }
  | { type: "POINTS_DEDUCTED"; payload: PointsPayload }

  // Sentimento
  | { type: "DISCORD_SENTIMENT_ALERT"; payload: SentimentPayload }

  // Inteligência
  | { type: "BACKUP_REQUESTED"; payload: BackupPayload }
  | { type: "EXPERT_IDENTIFIED"; payload: ExpertPayload }
```

### Reações em Cadeia

#### `PROJECT_CREATED` → dispara:
1. **Google Drive**: Criar pasta `/Projetos/{Nome}` com subpastas Docs, Entregáveis, Contratos
2. **Google Docs**: Criar documento de Escopo a partir de template IDV
3. **Discord**: Criar canal `#proj-{slug}` no servidor, atribuir roles ao time
4. **ClickUp**: Criar List com 4 tarefas iniciais + Playbook de início de projeto
5. **Notion**: Criar página de projeto com database de tarefas e meeting notes
6. **Miro**: Criar board "Project Canvas" com template EJ (escopo, time, cronograma, expectativas)
7. **Calendar**: Agendar kickoff no melhor horário disponível para todos os membros
8. **GPT-4o**: Gerar Playbook do Líder com guia para primeira reunião personalizado ao cliente

#### `PROJECT_COMPLETED` → dispara:
1. **ClickUp**: Fechar lista, mover tarefas ao histórico
2. **Notion**: Arquivar página, registrar lições aprendidas
3. **Supabase**: Incrementar KPI de faturamento, atualizar NPS
4. **Discord**: Mensagem de celebração no canal do projeto
5. **Miro**: Adicionar seção "Como foi" ao Project Canvas
6. **GPT-4o**: Gerar resumo do projeto para portfólio
7. **Pontos**: Distribuir pontos de recompensa para o time

#### `PROJECT_PAUSED` → dispara:
1. **GPT-4o**: Criar "Arquivo de Retomada" consolidando tudo do Notion + Miro + Figma
2. **Notion**: Salvar arquivo de retomada em página dedicada
3. **Discord**: Notificar equipe com link para o arquivo
4. **ClickUp**: Pausar time tracking, colocar tasks em hold

#### `TASK_COMPLETED` (via ClickUp webhook) → dispara:
1. **Ranking**: Atualizar score do membro por categoria de tarefa
2. **Pontos**: Verificar regras e distribuir pontos
3. **GPT-4o**: Se 10+ tasks da mesma categoria → gerar badge de especialista
4. **Supabase**: Atualizar `member_skills` com experiência acumulada

#### `DISCORD_SENTIMENT_ALERT` → dispara:
1. **GPT-4o**: Análise do sentimento das últimas mensagens
2. **Calendar**: Sugerir reunião de alinhamento no próximo horário disponível
3. **Discord**: DM ao líder com sugestão e link de agendamento

---

## 6. Iniciação Atômica

O formulário mais importante do sistema. Um único submit inicia tudo.

### Payload do Formulário
```typescript
interface AtomicInitPayload {
  // Dados básicos
  name: string;
  clientName: string;
  clientEmail?: string;
  clientContext: string;      // Descrição rica do cliente para o GPT
  value: number;
  startDate: string;
  endDate: string;

  // Configuração do projeto
  status: ProjectStatus;
  requiredSkills: string[];
  estimatedHours: number;

  // Configuração das APIs (escolha do líder)
  enabledIntegrations: {
    googleDrive: boolean;
    googleDocs: boolean;
    googleCalendar: boolean;
    discord: boolean;
    clickup: boolean;
    notion: boolean;
    miro: boolean;
  };

  // Smart Match
  autoAllocate: boolean;      // Rodar Smart Match automaticamente
  scheduleKickoff: boolean;   // Agendar kickoff via Calendar
}
```

### JSON Context Object (→ GPT-4o)
```typescript
interface ProjectContextJSON {
  project: { id, name, client, value, dates, status };
  client: { name, email, context, industry };
  team: { members: MemberProfile[]; skills: SkillMatrix };
  integrations: { clickupListId, notionPageId, discordChannelId, miroBoardId };
  playbook: { currentStep, nextActions, leaderGuide };
  history: { tasks, meetings, decisions };
}
```

---

## 7. Smart Match — Algoritmo de Alocação

### Fórmula de Score
```
Score = (skillMatch × 0.60) + (availability × 0.25) + (experience × 0.15)
```

### Como funciona
1. Busca membros com as skills requeridas (ponderando nível 1-5)
2. Consulta Google Calendar FreeBusy API para disponibilidade real
3. Cruza histórico de tarefas no ClickUp por categoria
4. Rankeia top 5 candidatos
5. Gera justificativa GPT-4o para o #1

### Melhor Horário para Reuniões
- Consulta FreeBusy de TODOS os membros alocados
- Encontra janela comum nos próximos 5 dias úteis
- Propõe top 3 horários com % de disponibilidade do time
- Opção de criação automática do evento no Google Calendar

---

## 8. Playbooks de Liderança

GPT-4o personaliza guias para cada etapa do projeto com base no JSON context.

### Etapas cobertas
1. **Pré-kickoff**: O que preparar, como pesquisar o cliente, o que levar
2. **Primeira reunião**: Script de apresentação, como apresentar a EJ, perguntas-chave
3. **Apresentação de escopo**: Como estruturar, o que incluir/excluir, como precificar
4. **Reuniões semanais**: Template de pauta, como motivar o time, como reportar ao cliente
5. **Entrega final**: Checklist de qualidade, como apresentar, como coletar NPS
6. **Pós-projeto**: Como solicitar feedback, template de depoimento, follow-up

### Personalização por cliente
O GPT recebe o `ProjectContextJSON` completo e gera guias específicos:
- Tom de comunicação ajustado ao perfil do cliente
- Perguntas customizadas ao setor/porte da empresa
- Sugestões de próximos projetos baseadas no histórico

---

## 9. Sistema de Pontos & Ranking

### Fontes de Pontos
| Evento | Pontos | Fonte |
|--------|--------|-------|
| Tarefa concluída no prazo (ClickUp) | +10 | Webhook ClickUp |
| Tarefa concluída com antecedência | +15 | Webhook ClickUp |
| Tarefa atrasada | -5 | Webhook ClickUp |
| Presença em reunião | +5 | Google Calendar |
| Falta sem justificativa | -10 | Manual / Calendar |
| NPS de projeto ≥ 9 | +25 | Manual |
| Badge de especialista conquistado | +30 | Automático |
| Artigo no Wiki publicado | +20 | Supabase |

### Ranking
- Ranking global da EJ (todos os membros)
- Ranking por departamento
- Ranking por categoria de skill
- Histórico de evolução ao longo do semestre

---

## 10. Análise de Sentimento Discord

- A cada hora, o sistema analisa os últimos 100 mensagens dos canais de projeto
- GPT-4o classifica o sentimento: `positive | neutral | concerned | negative`
- Se `concerned` por 2h seguidas ou `negative` por 30min → dispara alerta
- Líder recebe DM com: análise, contexto, sugestão de ação, link para agendar reunião

---

## 11. Expert Ranking & Badge System

- ClickUp Webhook monitora conclusão de tarefas por categoria (Design, Dev, Gestão, etc.)
- Ao atingir 10 tarefas concluídas em uma categoria → badge automático
- Badge aparece no perfil do membro e no ranking
- Hïve sugere automaticamente esse membro nos próximos projetos da categoria
- GPT-4o gera mensagem de reconhecimento personalizada no Discord

---

## 12. Project Hub — Visão Unificada

Cada projeto tem um hub que agrega status de TODAS as ferramentas em tempo real:

| Widget | Fonte | Atualização |
|--------|-------|-------------|
| Tarefas abertas/concluídas | ClickUp Webhook | Tempo real |
| Sentimento da equipe | Discord (análise horária) | 1h |
| Documentos atualizados | Google Drive | 15min |
| Atividade no Notion | Notion API | 15min |
| Board do Miro | Miro API | Sob demanda |
| Próximas reuniões | Google Calendar | Tempo real |
| Playbook atual | Supabase | Tempo real |

---

## 13. Arquivo de Retomada (Intelligence Backup)

Quando um projeto é pausado, o GPT-4o cria automaticamente:

```markdown
# Arquivo de Retomada — {Nome do Projeto}
Gerado em: {data}

## Contexto do Cliente
{resumo do cliente e suas necessidades}

## O que foi feito
{resumo de tarefas concluídas do ClickUp}

## Decisões tomadas
{extraído das atas no Notion}

## Estado atual dos entregáveis
{links do Drive, Figma, Miro com descrição do estado}

## Próximos passos planejados
{o que estava planejado fazer quando pausou}

## Para retomar, comece por:
1. {ação específica baseada no contexto}
2. {segunda ação}
3. {terceira ação}

## Pessoas-chave para contato
{cliente + membros alocados + stakeholders}
```

---

## 14. Configurações de Integração por Projeto

O líder de projeto pode escolher quais APIs ativar em cada projeto:
- Isso respeita os recursos disponíveis da EJ
- EJs no plano Free têm acesso limitado (só ClickUp + Notion)
- EJs no plano Premium têm acesso total
- A escolha fica salva no `projects.enabled_integrations` (JSONB)

---

## 15. Webhooks (Não polling!)

Preferência por webhooks sobre polling sempre que possível:

| Serviço | Evento | Endpoint Hïve |
|---------|--------|--------------|
| ClickUp | Tarefa concluída | `POST /api/webhooks/clickup` |
| ClickUp | Status atualizado | `POST /api/webhooks/clickup` |
| Stripe | Pagamento realizado | `POST /api/webhooks/stripe` |
| Discord | Mensagem enviada | `POST /api/webhooks/discord` |
| Notion | Página atualizada | `POST /api/webhooks/notion` |

---

---

## 16. Plano de Implementação — Interconexões Futuras

### 16.1 Relatório Semanal Automático
**Trigger:** Cron todo domingo às 20h (Supabase Edge Function ou scheduled task)
**Fluxo:**
1. Agrega dados da semana: tarefas ClickUp concluídas, NPS parcial, sentimento Discord
2. GPT-4o gera resumo executivo em português
3. Envia via Gmail para o líder de cada projeto ativo
4. Envia via WhatsApp Business (quando disponível) para o cliente

**Conexões:** ClickUp → GPT-4o → Gmail → (futuro) WhatsApp
**Tabela:** `weekly_reports` (org_id, project_id, week_start, content, sent_at)

---

### 16.2 Hïve Score — Saúde do Projeto em Tempo Real
**Descrição:** Índice 0-100 que aparece no Project Hub como termômetro de saúde.

**Fórmula:**
```
HïveScore = (tarefasNoPrazo × 0.35) + (sentimentoDiscord × 0.25) + (cadenciaReunioes × 0.20) + (atualizacaoDocumentos × 0.20)
```

**Fontes de dados:**
- `tarefasNoPrazo`: % de tasks concluídas no prazo (ClickUp webhook)
- `sentimentoDiscord`: score de sentimento normalizado 0-1 (discord_sentiment_log)
- `cadenciaReunioes`: % de reuniões semanais realizadas (Google Calendar)
- `atualizacaoDocumentos`: tempo desde última edição no Drive/Notion

**Atualização:** Tempo real via Supabase Realtime (recalcula a cada evento relevante)
**Tabela:** `project_health_scores` (project_id, score, breakdown_json, calculated_at)
**UI:** Termômetro colorido no Project Hub (🔴 0-40, 🟡 40-70, 🟢 70-100)

---

### 16.3 Onboarding Automatizado de Novo Membro
**Trigger:** `MEMBER_JOINED` event (inserção na tabela `profiles`)

**Fluxo em cadeia:**
1. **ClickUp:** Cria usuário convidado e atribui ao espaço da EJ
2. **Discord:** Atribui role correspondente ao cargo (trainee/assessor/etc.)
3. **Gmail:** Envia email de boas-vindas personalizado por GPT-4o com:
   - Nome do membro, cargo, departamento
   - Links para os recursos principais (Drive, Notion wiki, ClickUp)
   - Guia de primeiros passos gerado pelo GPT
4. **Playbook:** Gera automaticamente "Playbook de Integração" para o líder responsável
   com roteiro de acolhimento, o que explicar na primeira semana, metas de 30 dias
5. **Pontos:** Atribui 0 pontos iniciais, registra data de entrada para cálculo de evolução

**Conexões:** Supabase trigger → [ClickUp + Discord + Gmail + GPT-4o Playbook]
**Tabela:** Reutiliza `playbooks` com `step = 'member_onboarding'`

---

_Documento gerado pelo Sócio-Arquiteto Hïve. Atualizar conforme o sistema evolui._

---

## 17. Backlog de Ideias Futuras (Prioridade Alta)

### 17.1 Cron Automatizado para Weekly Report
**Descrição:** Disparar o relatório semanal automaticamente toda segunda-feira às 8h.
**Implementação sugerida:** Vercel Cron Jobs (`vercel.json` com schedule `0 8 * * 1`) chamando `POST /api/reports/weekly` com um `CRON_SECRET` header.
**Alternativa:** Supabase Edge Function com pg_cron schedulado.
**Status:** PENDENTE — aguardando decisão de deploy (Vercel vs. self-hosted).

---

### 17.2 Widget de Hïve Score no Project Hub
**Descrição:** Barra animada com breakdown visual dos 5 componentes do score (taskCompletion, timeline, sentiment, engagement, deliveryRisk).
**Comportamento:** Atualiza em tempo real via Supabase Realtime subscription em `projects.hive_score`.
**UI:** Barra segmentada colorida + tooltip com insights individuais por componente.
**Status:** PENDENTE — implementar após estabilizar score.service.ts.

---

### 17.3 Onboarding Progress Tracker
**Descrição:** Página `/membros/[id]/onboarding` com checklist visual e % de conclusão em tempo real.
**Dados:** Lê `audit_logs` filtrado por `action = MEMBER_ONBOARDED` + `member_task_stats` para progresso.
**Features:** Barra de progresso, items clicáveis, re-trigger de etapas individuais.
**Status:** PENDENTE — depende do enhanced onboarding estar completo.

---

_Backlog atualizado em: ${new Date().toLocaleDateString('pt-BR')}_
