# SYSTEM_DESIGN.md — Hï Tech Hub

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                    │
│         Next.js App Router · React · Tailwind           │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│              NEXT.JS SERVER (Vercel Edge)                │
│    Route Handlers · Server Actions · Middleware         │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Auth Layer │  │   API Routes │  │  Server Actions│  │
│  │  (Supabase) │  │  /api/*      │  │  (forms/docs) │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└───────┬────────────────┬───────────────────┬────────────┘
        │                │                   │
┌───────▼──────┐ ┌───────▼──────┐ ┌─────────▼──────────┐
│   Supabase   │ │    Stripe    │ │  Integrações OAuth  │
│  PostgreSQL  │ │  Pagamentos  │ │  Google · ClickUp   │
│  Auth        │ │              │ │  Notion · Discord   │
│  Storage     │ │              │ │  OpenAI             │
└──────────────┘ └──────────────┘ └────────────────────┘
```

---

## Multi-Tenancy

O sistema utiliza **Row Level Security (RLS)** do PostgreSQL para isolamento de dados por tenant (organização). Não há schemas separados — todas as tabelas compartilham o mesmo schema `public`, com `organization_id` como chave de isolamento.

```
auth.users (Supabase Auth)
    └── profiles.id = auth.uid()
            └── profiles.organization_id → organizations.id
                    └── RLS: auth.organization_id() filtra todo acesso
```

---

## Fluxo de Autenticação

### Login com Google (OAuth2)

```
1. Usuário clica em "Entrar com Google"
2. GET /api/auth/google → redireciona para Google OAuth
3. Google redireciona → GET /api/auth/callback/google?code=...
4. Supabase troca code por access_token + refresh_token
5. Trigger handle_new_user() no PostgreSQL:
   ├── Extrai domínio do e-mail
   ├── Se @hitech.org.br → plan_tier = 'internal'
   ├── Caso contrário → plan_tier = 'free'
   ├── Cria organização padrão
   └── Cria profile como 'owner'
6. Sessão estabelecida → redireciona para /dashboard
```

### Verificação de Plano em Route Handlers

```typescript
// Exemplo de guard em route handler protegido
const supabase = createServerSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();

const { data: profile } = await supabase
  .from('profiles')
  .select('*, organization:organizations(plan_tier)')
  .eq('id', user.id)
  .single();

assertPremiumAccess(profile.organization.plan_tier);
```

---

## Rotas de API

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/auth/google` | Inicia OAuth Google |
| GET | `/api/auth/callback/google` | Callback OAuth Google |
| GET | `/api/auth/callback/clickup` | Callback OAuth ClickUp |
| GET | `/api/auth/callback/notion` | Callback OAuth Notion |
| POST | `/api/auth/logout` | Encerra sessão |

### Projetos & Alocação
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/projetos` | Lista projetos da org |
| POST | `/api/projetos` | Cria projeto |
| GET | `/api/projetos/:id` | Detalhe do projeto |
| PATCH | `/api/projetos/:id` | Atualiza projeto |
| POST | `/api/projetos/:id/alocacao` | Aloca consultor |
| GET | `/api/competencias/sugestoes` | Sugestões de alocação por IA |

### Documentos
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/documentos` | Cria documento a partir de formulário |
| GET | `/api/documentos/:id/pdf` | Download do PDF gerado |
| PATCH | `/api/documentos/:id/status` | Atualiza status (draft→sent→signed) |

### Integrações
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/integracoes/google/calendar` | Eventos do Calendar |
| GET | `/api/integracoes/clickup/tasks` | Tasks do ClickUp |
| POST | `/api/integracoes/discord/notify` | Envia notificação Discord |
| POST | `/api/integracoes/openai/summarize` | Sumariza reunião via GPT |

### Billing (Stripe)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/billing/checkout` | Cria sessão de checkout Stripe |
| POST | `/api/billing/portal` | Portal de gerenciamento do cliente |
| POST | `/api/webhooks/stripe` | Eventos Stripe (webhook) |

---

## Algoritmo de Alocação de Consultores

O módulo de Matriz de Competências usa um sistema de scoring para sugerir consultores:

```
Score(usuário, projeto) =
  Σ (skill_match × level_weight)    // 60%
  + availability_score               // 25%
  + experience_score                 // 15%

onde:
  skill_match     = skills do usuário ∩ skills requeridas
  availability    = horas livres via Google Calendar API
  experience      = nº de projetos similares concluídos
```

---

## Segurança

| Camada | Medida |
|--------|--------|
| Banco | RLS em todas as tabelas |
| Banco | Tokens OAuth criptografados (pgcrypto AES-256) |
| API | Validação de session em todo route handler |
| API | Rate limiting via Vercel Edge |
| HTTP | Headers CSP, X-Frame-Options, HSTS |
| Logs | Trilha de auditoria em `audit_logs` |
| Whitelist | Domínio @hitech.org.br validado no trigger SQL |

---

## Modelo de Dados — Relacionamentos

```
organizations (1) ──< profiles (N)
organizations (1) ──< projects (N)
organizations (1) ──< wiki_articles (N)
organizations (1) ──< documents (N)
organizations (1) ──< integrations (N)
organizations (1) ──< kpi_records (N)

profiles (N) >──< skills via member_skills
profiles (N) >──< projects via project_allocations

projects (1) ──< project_allocations (N)
projects (1) ──< documents (N)
```

---

## Bibliotecas de Integração

| Integração | Biblioteca/SDK |
|-----------|---------------|
| Google Workspace | `googleapis` (npm) |
| ClickUp | REST API própria + `fetch` nativo |
| Notion | `@notionhq/client` |
| Discord | Webhooks REST + `discord.js` (bot) |
| OpenAI | `openai` SDK oficial |
| Stripe | `stripe` SDK oficial |
| Canva | Canva Apps SDK (embed) |
| Figma | Figma REST API |

---

## Histórico de Commits (git log)

```
feat: initialize next.js project with app router and typescript
feat: setup tailwind with hitech brand tokens and dark mode
feat: add supabase client utilities for browser and server
feat: implement domain whitelist logic for hitech.org.br users
feat: design postgresql schema with multi-tenancy and rls
feat: add auth middleware with session refresh and route guards
feat: create global types for organizations projects and integrations
fix: correct rls helper functions for auth.organization_id
docs: add readme and system design documentation
chore: configure security headers in next.config
chore: add environment variables template
```
