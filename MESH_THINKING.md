# Hïve — Mesh Thinking: O Guia do Sócio-Arquiteto

> "Um projeto criado no Hïve não é apenas um registro no banco de dados.
>  É um sinal que ecoa por toda a rede."

---

## O que é Mesh Thinking?

**Mesh Thinking (Pensamento em Malha)** é a filosofia central do Hïve.
Nenhum dado existe em isolamento. Cada evento é um nó que activa outros nós.

### Princípios

**1. Eventos, não ações**
Nunca pense "o usuário clicou em salvar". Pense "o evento `PROJECT_CREATED` foi emitido".
A distinção importa porque um evento pode ter múltiplos consumidores desacoplados.

**2. Reações em cadeia, não integrações pontuais**
Não conectamos Hïve → ClickUp. Conectamos o evento `PROJECT_CREATED` a um handler que,
entre outras coisas, usa o ClickUp. A ordem é: evento → orquestrador → serviços.

**3. Contexto rico, não dados simples**
Antes de chamar qualquer API, construímos o `ProjectContextJSON` completo.
Assim, qualquer serviço (GPT-4o, Miro, Discord) recebe contexto suficiente
para agir de forma inteligente.

**4. Falhas silenciosas na periferia, jamais no centro**
A criação do projeto no banco de dados NUNCA pode falhar por causa do Discord estar fora.
Automações periféricas rodam em background com `catch` + log de auditoria.

**5. Webhooks > Polling**
O Hïve não pergunta "já terminou?". O Hïve espera ser avisado.
Webhooks economizam CPU, latência e dinheiro de servidor.

---

## O Event Bus

```typescript
// src/lib/events/event-bus.ts

type EventHandler<T> = (payload: T) => Promise<void>;

class HiveEventBus {
  private handlers = new Map<string, EventHandler<unknown>[]>();

  on<T>(event: string, handler: EventHandler<T>) {
    const existing = this.handlers.get(event) ?? [];
    this.handlers.set(event, [...existing, handler as EventHandler<unknown>]);
  }

  async emit<T>(event: string, payload: T) {
    const handlers = this.handlers.get(event) ?? [];
    // Fire all handlers in parallel, log failures individually
    await Promise.allSettled(
      handlers.map((h) =>
        h(payload).catch((err) => {
          console.error(`[HiveEventBus] Handler failed for "${event}":`, err);
          // TODO: salvar em audit_logs
        })
      )
    );
  }
}

export const eventBus = new HiveEventBus();
```

---

## Registro de Handlers

```typescript
// src/lib/events/register-handlers.ts
// Este arquivo é importado UMA vez no startup da aplicação

import { eventBus } from "./event-bus";
import { onProjectCreated } from "../automations/handlers/project-created";
import { onProjectCompleted } from "../automations/handlers/project-completed";
import { onProjectPaused } from "../automations/handlers/project-paused";
import { onTaskCompleted } from "../automations/handlers/task-completed";
import { onSentimentAlert } from "../automations/handlers/sentiment-alert";

eventBus.on("PROJECT_CREATED",       onProjectCreated);
eventBus.on("PROJECT_COMPLETED",     onProjectCompleted);
eventBus.on("PROJECT_PAUSED",        onProjectPaused);
eventBus.on("TASK_COMPLETED",        onTaskCompleted);
eventBus.on("DISCORD_SENTIMENT_ALERT", onSentimentAlert);
```

---

## Exemplo Completo: PROJECT_CREATED

```typescript
// src/lib/automations/handlers/project-created.ts

export async function onProjectCreated(payload: ProjectCreatedPayload) {
  const { project, org, team, enabledIntegrations } = payload;

  // 1. Construir contexto rico
  const context = await buildProjectContext(project, org, team);

  // 2. Serviços em paralelo (quando possível)
  const [driveResult, discordResult, clickupResult, notionResult] = await Promise.allSettled([
    enabledIntegrations.googleDrive  ? googleDriveService.createProjectFolder(context) : null,
    enabledIntegrations.discord      ? discordBotService.createProjectChannel(context)  : null,
    enabledIntegrations.clickup      ? clickupTasksService.createProjectList(context)   : null,
    enabledIntegrations.notion       ? notionPagesService.createProjectPage(context)    : null,
  ]);

  // 3. Salvar IDs externos gerados
  await saveExternalIds(project.id, {
    driveFolderId: driveResult.status === "fulfilled" ? driveResult.value?.folderId : null,
    discordChannelId: discordResult.status === "fulfilled" ? discordResult.value?.channelId : null,
    clickupListId: clickupResult.status === "fulfilled" ? clickupResult.value?.listId : null,
    notionPageId: notionResult.status === "fulfilled" ? notionResult.value?.pageId : null,
  });

  // 4. Miro (depende do team estar formado)
  if (enabledIntegrations.miro && team.length > 0) {
    await miroBoardService.createProjectCanvas(context).catch(console.error);
  }

  // 5. Smart Match + Calendar (se habilitado)
  if (payload.autoAllocate) {
    const suggestions = await smartMatch(project, org);
    if (suggestions.length > 0 && payload.scheduleKickoff) {
      await calendarService.scheduleKickoff(suggestions[0].members, project);
    }
  }

  // 6. GPT-4o Playbook (último, precisa do contexto completo)
  const updatedContext = await buildProjectContext(project, org, team); // com IDs externos
  await playbookService.generateLeaderGuide(updatedContext).catch(console.error);
}
```

---

## Anatomia do ProjectContextJSON

```typescript
interface ProjectContextJSON {
  // Identidade
  id: string;
  name: string;
  slug: string;                // "consultoria-estrategica-acme"

  // Cliente
  client: {
    name: string;
    email?: string;
    context: string;           // Texto livre sobre o cliente
    industry?: string;         // Inferido pelo GPT-4o
    size?: "startup" | "pme" | "enterprise";
  };

  // Organização
  org: {
    id: string;
    name: string;
    plan: "free" | "premium" | "internal";
    enabledIntegrations: Record<string, boolean>;
  };

  // Financeiro
  financials: {
    value: number;
    currency: "BRL";
    startDate: string;
    endDate: string;
    estimatedHours: number;
    hourlyRate: number;        // Calculado: value / estimatedHours
  };

  // Equipe
  team: {
    leader?: MemberProfile;
    members: MemberProfile[];
    skillMatrix: Record<string, number>; // skillName → nível médio do time
    availability: AvailabilitySlot[];    // Próximas 2 semanas
  };

  // IDs externos (preenchidos após automações)
  externalIds: {
    driveFolderId?: string;
    driveDocId?: string;
    discordChannelId?: string;
    clickupListId?: string;
    notionPageId?: string;
    miroBoardId?: string;
    calendarEventId?: string;
  };

  // Estado do Playbook
  playbook: {
    currentStep: number;       // 0-5
    stepLabel: string;
    completedSteps: number[];
    nextActions: string[];
    leaderGuide?: string;      // GPT-4o generated
  };

  // Histórico (para backups e análises)
  history: {
    tasks: ClickUpTask[];
    meetings: MeetingSummary[];
    decisions: Decision[];
    milestonesReached: string[];
  };
}
```

---

## Regras de Ouro para Novos Módulos

1. **Sempre pergunte: quais eventos este módulo deve ouvir?**
2. **Sempre pergunte: quais eventos este módulo deve emitir?**
3. **Nunca acesse uma integração diretamente de um componente React.**
   Sempre passe por `/api/*` → `services/*`.
4. **Falhas em serviços externos não devem travar o fluxo principal.**
   Use `Promise.allSettled` e registre falhas em `audit_logs`.
5. **Cada serviço tem seu próprio arquivo em `src/services/`.**
   Um serviço por integração. Sem misturar lógica de Google com Discord.
6. **O `ProjectContextJSON` é sagrado.**
   Qualquer módulo que precisar de informações do projeto usa esse objeto.
   Nunca busque dados de uma integração quando pode usar o contexto já carregado.

---

## Checklist para toda nova funcionalidade

```
[ ] Qual evento dispara essa funcionalidade?
[ ] Quais serviços externos são afetados?
[ ] O que acontece se um serviço externo falhar?
[ ] Essa ação deve gerar um log de auditoria?
[ ] O usuário precisa de uma permissão específica (hierarquia)?
[ ] Isso deve ganhar/perder pontos para alguém?
[ ] Existe um Playbook passo-a-passo para o líder aqui?
[ ] Isso pode ser processado em background (sem bloquear o usuário)?
```

---

_"A colmeia funciona porque cada abelha faz sua parte.
 O Hïve funciona porque cada evento dispara sua reação."_
