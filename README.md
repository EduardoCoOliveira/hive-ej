# Hï Tech Hub

> Hub de Gestão Centralizado para Empresas Juniores — desenvolvido pela Hï Tech

## Visão Geral

O **Hï Tech Hub** é um Micro-SaaS que unifica o fluxo de trabalho das Empresas Juniores (EJs) brasileiras em uma única plataforma. O sistema integra as ferramentas já utilizadas pelas EJs (Google Workspace, ClickUp, Notion, Discord, Canva, Figma) e adiciona módulos nativos exclusivos: Matriz de Competências, Wiki de Passagem de Bastão, Indicadores Brasil Júnior e Automação de Documentos.

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui |
| Backend | Next.js Route Handlers + Server Actions |
| Banco de Dados | PostgreSQL via Supabase |
| Auth | Supabase Auth (OAuth2 + Magic Link) |
| Storage | Supabase Storage |
| Pagamentos | Stripe |
| PDF | jsPDF |
| IA | OpenAI API (GPT-4o) |
| State | Zustand + React Query |

---

## Módulos

### Integrações (Hub)
- **Google Workspace** — Docs (contratos), Sheets (financeiro), Drive, Calendar
- **ClickUp / Trello / Notion** — Sincronização de tasks e bases de conhecimento
- **Discord** — Notificações por webhook e gestão de cargos
- **Canva / Figma** — Embedding de projetos e identidades visuais

### Nativos
- **Matriz de Competências** — Algoritmo de alocação de consultores por habilidade e disponibilidade
- **KPIs Brasil Júnior** — Dashboard automático de faturamento, NPS e indicadores MEJ
- **Wiki de Bastão** — Documentação por cargo com histórico de tarefas e arquivos
- **Automação de Documentos** — Geração de PDFs (contratos/propostas) a partir de formulários

---

## Planos e Preços

| Plano | Preço | Acesso |
|-------|-------|--------|
| **Free** | Grátis | Funcionalidades básicas |
| **Premium** | R$ 50/mês por EJ | Todas as funcionalidades |
| **Internal** | Gratuito vitalício | Usuários `@hitech.org.br` |

> Regra de whitelist: qualquer usuário com e-mail `@hitech.org.br` recebe automaticamente o plano **Internal** (equivalente ao Premium, sem cobrança) no momento do cadastro.

---

## Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/hitech/hitech-hub.git
cd hitech-hub

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Preencha os valores em .env.local

# 4. Execute as migrations no Supabase
# Acesse o Supabase Dashboard > SQL Editor e execute:
# database/migrations/001_initial_schema.sql

# 5. Inicie o servidor de desenvolvimento
npm run dev
```

---

## Estrutura de Pastas

```
hitech-hub/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Grupo de rotas de autenticação
│   │   ├── (dashboard)/        # Grupo de rotas protegidas
│   │   └── api/                # Route Handlers
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitivos
│   │   ├── layout/             # Sidebar, Header, Nav
│   │   ├── dashboard/          # Widgets de dashboard
│   │   └── integracoes/        # Cards de integração
│   ├── lib/
│   │   ├── supabase/           # Clientes Supabase (browser/server)
│   │   ├── auth/               # Middleware e whitelist
│   │   ├── integrations/       # SDKs de integrações externas
│   │   ├── billing/            # Lógica Stripe
│   │   └── pdf/                # Geração de documentos PDF
│   ├── hooks/                  # React hooks customizados
│   ├── types/                  # Tipos TypeScript globais
│   └── utils/                  # Funções utilitárias
├── database/
│   ├── migrations/             # SQL migrations versionadas
│   └── seeds/                  # Dados iniciais de desenvolvimento
├── public/
│   ├── logos/                  # Logos Hï Tech (SVG)
│   └── patterns/               # Padrões decorativos (SVG)
└── docs/                       # Documentação técnica adicional
```

---

## Segurança

- Row Level Security (RLS) habilitado em todas as tabelas
- Tokens OAuth armazenados criptografados (`pgcrypto`)
- Headers de segurança configurados no `next.config.ts`
- Trilha de auditoria em `audit_logs`
- Separação de clientes Supabase (anon / service role)

---

## Comandos Úteis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run type-check   # Verificação de tipos TypeScript
npm run lint         # ESLint
```

---

## Licença

Propriedade da **Hï Tech Empresa Júnior**. Uso restrito.
