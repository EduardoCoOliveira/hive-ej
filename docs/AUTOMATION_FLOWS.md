# Fluxos de Automação — Hï Tech Hub

> Mapa completo das automações cruzadas entre APIs.
> Cada evento dispara ações coordenadas entre múltiplas ferramentas.

---

## Visão Geral

```
                    ┌─────────────────────┐
                    │   Hï Tech Hub       │
                    │  (Next.js Server)   │
                    └──────────┬──────────┘
                               │ ProjectAutomation
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         ┌────────┐      ┌─────────┐      ┌─────────┐
         │ClickUp │      │ Notion  │      │ Discord │
         └────────┘      └─────────┘      └─────────┘
              │                │
         ┌────▼────┐      ┌────▼────┐
         │  Tasks  │      │  Pages  │
         └─────────┘      └─────────┘
                    ┌──────────────────────┐
                    │  OpenAI GPT-4o       │
                    │  (sumário + proposta)│
                    └──────────────────────┘
                    ┌──────────────────────┐
                    │  Google Calendar     │
                    │  (disponibilidade)   │
                    └──────────────────────┘
```

---

## Fluxo 1 — Criação de Projeto

**Gatilho:** `POST /api/projetos`

```
Hub recebe dados do projeto
    │
    ├─→ [Supabase] INSERT em projects
    │
    ├─→ [ClickUp] Cria lista no Space da EJ
    │       └─→ Cria 4 tasks iniciais automáticas:
    │           • Kickoff com cliente
    │           • Elaborar proposta técnica
    │           • Definir equipe do projeto
    │           • Configurar repositório
    │
    ├─→ [Notion] Cria página de documentação com:
    │       ├── Tabela: cliente, valor, responsável, status
    │       ├── Seção de escopo (editável)
    │       ├── Seção de atas de reuniões
    │       └── Checklist de entregas
    │
    └─→ [Discord] Envia embed no canal #projetos:
            • Título, cliente, valor
            • Links para ClickUp e Notion
```

---

## Fluxo 2 — Projeto Ativado (proposta aceita)

**Gatilho:** `PATCH /api/projetos/:id` com `status: "active"`

```
Status muda: prospecting/proposal → active
    │
    ├─→ [ClickUp] Atualiza status da lista → "in progress"
    │       └─→ Cria task urgente: "🚀 PROJETO ATIVO — agendar reunião de início"
    │
    ├─→ [Google Calendar] Cria evento de kickoff
    │       └─→ Convida todos os consultores alocados
    │
    └─→ [Discord] Embed verde "Projeto Ativado!" com @menção ao time
```

---

## Fluxo 3 — Projeto Concluído

**Gatilho:** `PATCH /api/projetos/:id` com `status: "completed"`

```
Status muda: active → completed
    │
    ├─→ [ClickUp] Fecha lista → "complete"
    │
    ├─→ [Notion] Arquiva página do projeto
    │
    ├─→ [Supabase] RPC increment_kpi_revenue()
    │       └─→ Atualiza faturamento e projetos_count do mês
    │
    └─→ [Discord] Embed verde com 🎉 celebração
```

---

## Fluxo 4 — Sumarização de Reunião (IA)

**Gatilho:** `POST /api/integracoes/openai/summarize`

```
Usuário cola texto da ata
    │
    ├─→ [OpenAI GPT-4o] Estrutura em:
    │       • Participantes
    │       • Principais decisões
    │       • Próximos passos
    │       • Responsáveis e prazos
    │
    └─→ [Notion] (se saveToNotion=true)
            └─→ Appenda bloco callout na página do projeto
```

---

## Fluxo 5 — Sugestão de Alocação

**Gatilho:** `POST /api/competencias/sugestoes`

```
Gerente informa skills necessárias + horas/semana
    │
    ├─→ [Supabase] Busca todos os membros com skills e histórico
    │
    ├─→ [Google Calendar] Verifica conflitos de agenda por membro
    │
    ├─→ Algoritmo calcula score:
    │       skill_match (60%) + disponibilidade (25%) + experiência (15%)
    │
    └─→ [OpenAI GPT-4o] Gera justificativa em texto para o top 1
```

---

## Fluxo 6 — Pagamento e Planos (Stripe)

**Gatilho:** Webhooks do Stripe em `/api/webhooks/stripe`

```
checkout.session.completed
    └─→ org.plan_tier = "premium"

customer.subscription.deleted
    └─→ org.plan_tier = "free"
        └─→ [Discord] (futuro) Notifica owner sobre cancelamento

invoice.payment_failed
    └─→ audit_log registrado
        └─→ (futuro) [WhatsApp] Alerta urgente para owner
```

---

## Integrações Planejadas (Roadmap)

| Integração        | Automação principal                                         | ETA      |
|-------------------|-------------------------------------------------------------|----------|
| **WhatsApp**      | NPS por WhatsApp pós-projeto + alertas de pagamento        | Q3 2025  |
| **GitHub**        | Cria repositório ao ativar projeto; sincroniza issues      | Q3 2025  |
| **Miro**          | Embed de quadro colaborativo na página do projeto          | Q4 2025  |
| **Portal BJ**     | Import automático de KPIs MEJ via API do Portal            | Q4 2025  |
| **Trello**        | Alternativa ao ClickUp para EJs que já usam Trello         | Q1 2026  |
| **Slack**         | Alternativa ao Discord para notificações                   | Q1 2026  |
| **Zapier**        | Webhooks customizáveis para qualquer ferramenta            | Q2 2026  |

---

## Diagrama de Fluxo Completo

```
  EVENTO          →  HUB (Next.js)   →  INTEGRAÇÕES ATIVAS
  ─────────────      ──────────────     ────────────────────
  criar projeto   →  ProjectAutomation  →  ClickUp (lista+tasks)
                                       →  Notion (página doc)
                                       →  Discord (notificação)

  ativar projeto  →  ProjectAutomation  →  ClickUp (status + task urgente)
                                       →  Google Calendar (kickoff)
                                       →  Discord (embed verde)

  concluir proj.  →  ProjectAutomation  →  ClickUp (fechar lista)
                                       →  Notion (arquivar página)
                                       →  Supabase KPI (incrementar)
                                       →  Discord (celebração)

  sumarizar ata   →  OpenAI GPT-4o    →  Notion (bloco callout)

  alocar consultor→  Algorithm Score   →  Google Calendar (disponib.)
                  →  OpenAI GPT-4o    →  (justificativa texto)

  pagar premium   →  Stripe Webhook   →  Supabase (plan_tier = premium)
  cancelar plan.  →  Stripe Webhook   →  Supabase (plan_tier = free)
```
