# AI Context - Hïve

## Objetivo do projeto

Hïve é uma plataforma SaaS de gestão para Empresas Juniores brasileiras. O objetivo é centralizar, em um único produto, rotinas que hoje costumam ficar espalhadas entre Google Sheets, Notion, WhatsApp, ClickUp, Drive, Discord e planilhas internas.

O sistema deve apoiar a operação diária de uma EJ com projetos, membros, financeiro, documentos, reuniões, pontos, competências, playbooks e integrações externas. O produto é específico para o ecossistema de Empresas Juniores no Brasil.

Nome comercial: Hïve.

Domínio planejado: `hive-ej.app`.

URL atual de deploy: `hitech-hub.vercel.app`.

## Tipo de projeto e modo de trabalho

Tipo de projeto: sistema complexo, com múltiplas integrações de APIs para Empresas Juniores.

Modo padrão: `hybrid`.

Comportamento padrão:

- Equilibrar execução e aprendizado.
- Identificar quais partes o usuário consegue implementar com guia.
- Implementar diretamente partes mais complexas quando isso destravar o progresso.
- Incluir o usuário no processo quando fizer sentido.
- Introduzir conceitos avançados gradualmente.
- Não depender do histórico de conversa para continuar o projeto.
- Ao final de cada etapa relevante, sugerir atualização destes arquivos: `docs/ai-context.md`, `docs/session-log.md`, `docs/next-step.md`.
- Quando o usuário disser que está iniciando uma nova sessão de programação, lembrar de informar a plataforma: `Mac` ou `PC`.
- Quando o usuário disser que a sessão acabou, atualizar os documentos operacionais, revisar o status do Git, commitar as mudanças e preparar o projeto para continuidade em outra máquina.

Ambiente por sessão:

- Se o usuário informar `Mac`, o GPT assume planejamento e implementação.
- Se o usuário informar `PC`, usar fluxo híbrido com GPT + modelo local, como Qwen.
- No PC, o GPT pode gerar prompts para o modelo local e dividir tarefas entre planejamento, execução e revisão.

Overrides:

- `modo didático`: priorizar ensino e explicação.
- `modo executor`: priorizar velocidade e solução completa.

Protocolo de início e fim de sessão:

- Início: confirmar se a sessão será em `Mac` ou `PC`.
- Durante a sessão: executar o trabalho conforme o modo ativo e manter contexto técnico nos arquivos quando houver decisão relevante.
- Fim: atualizar `docs/ai-context.md` se houver mudança estrutural, registrar resumo em `docs/session-log.md`, definir a próxima tarefa em `docs/next-step.md`, rodar verificações cabíveis, commitar e, quando solicitado ou apropriado, enviar ao GitHub.

## Stack técnica

Frontend:

- Next.js 14.1 com App Router.
- TypeScript.
- Tailwind CSS.
- React 18.
- Componentes com Radix UI, lucide-react, framer-motion e utilitários próprios.

Backend e dados:

- Supabase: PostgreSQL gerenciado, Auth e Storage.
- Autenticação via magic link e rotas OAuth planejadas/implementadas parcialmente.
- PostgreSQL com Row Level Security por organização.
- Vercel para hospedagem e deploy automático.

Integrações planejadas ou em progresso:

- Google Workspace: Calendar, Drive, Docs e login OAuth.
- Notion: páginas e documentação de projetos.
- ClickUp: listas, tarefas e status de projetos.
- Discord: notificações, canais por cargo, automações e sentiment analysis.
- Miro: quadros colaborativos.
- Figma e Canva: recursos planejados para materiais e assets.
- Stripe: cobrança de planos.
- OpenAI: sumarização, playbooks, sugestões e automações inteligentes.

## Arquitetura geral

O Hïve usa uma arquitetura SaaS multi-tenant. Cada Empresa Júnior é uma organização e os dados são isolados por `organization_id` ou `org_id`, dependendo da tabela.

Fluxo de alto nível:

1. Usuário acessa o frontend Next.js.
2. Login acontece via Supabase Auth, atualmente com magic link.
3. O App Router protege páginas de dashboard e carrega dados do usuário.
4. Server Components e Route Handlers consultam o Supabase.
5. Dados de negócio são filtrados por organização.
6. Integrações externas são ativadas por organização e registradas em tabelas como `org_integrations`.
7. Automações coordenam eventos internos com APIs externas.

Principais camadas:

- UI: páginas em `src/app`, components em `src/components`.
- Auth: Supabase Auth, callback de magic link e callbacks OAuth.
- Dados: Supabase PostgreSQL, migrations em `database/migrations`.
- Integrações: clientes e handlers em `src/lib/integrations` e `src/services`.
- Automação: event bus e handlers em `src/lib/automations`.
- Billing: Stripe em rotas de billing e webhooks.

## Modelo de dados principal

Tabelas centrais confirmadas no schema versionado:

- `organizations`: dados da EJ, plano, slug, integrações financeiras e Discord.
- `profiles`: usuário autenticado, organização, role, rank, departamento e metadados.
- `projects`: projetos da EJ, status, cliente, valor, líder, integrações habilitadas.
- `project_allocations`: alocação de membros em projetos.
- `skills` e `member_skills`: matriz de competências.
- `documents`: contratos, propostas e documentos gerados.
- `wiki_articles`: base de conhecimento e passagem de bastão.
- `kpi_records`: indicadores mensais.
- `org_integrations`: integrações OAuth por organização.
- `expenses`: reembolsos e despesas.
- `meeting_minutes`: atas e processamento de reuniões.
- `point_rules`, `point_transactions`, `member_badges`, `member_task_stats`: sistema de pontos e gamificação.
- `playbooks` e `atomic_initiation_log`: automações e guias de projeto.

Observação importante: existem tabelas legadas e novas com nomes parecidos, especialmente `integrations` e `org_integrations`. Antes de implementar uma integração, verificar qual tabela o serviço realmente consome.

## Fluxos principais

Autenticação:

- Usuário solicita magic link em `/login` ou `/register`.
- Callback `/api/auth/callback/magic` valida sessão e cria organização/profile quando necessário.
- O layout do dashboard valida usuário e carrega contexto de organização.

Cadastro:

- Usuário informa dados da EJ.
- Supabase envia magic link.
- No primeiro login, o sistema deve criar `organization` e `profile`.
- O primeiro usuário da organização deve ser owner/president.

Projetos:

- Projeto é criado no Hïve.
- Futuramente dispara automações em ClickUp, Notion, Discord, Google Calendar e Drive.
- Projeto ativo pode gerar kickoff, documentos, tarefas e playbooks.

Documentos:

- Documentos são ligados a projetos e organização.
- Conteúdo pode vir de templates e ser exportado ou vinculado ao Drive.
- Recursos premium devem respeitar `organizations.plan_tier`.

Reuniões:

- Atas podem ser armazenadas em `meeting_minutes`.
- Fluxo planejado: upload/transcrição, resumo por IA, decisões, próximos passos e envio para Docs/Discord.

Financeiro:

- Reembolsos ficam em `expenses`.
- Integração planejada com Google Sheets/Drive para comprovantes e controle financeiro.
- Stripe deve atualizar `organizations.plan_tier`.

## Decisões importantes

- Multi-tenancy será feito por organização, não por schema separado.
- Supabase é a fonte primária de dados, Auth e Storage.
- Next.js App Router é a base do frontend e backend HTTP.
- O sistema deve usar Server Components e Route Handlers para dados sensíveis.
- Chave anônima deve respeitar RLS; `SUPABASE_SERVICE_ROLE_KEY` só deve ser usada server-side.
- Magic link é o fluxo principal de autenticação neste momento.
- Google OAuth é desejado como alternativa futura.
- O primeiro usuário da organização deve receber permissões administrativas.
- Integrações devem ser ativadas por organização, não globalmente.
- Tokens de integrações devem ser tratados como segredo e nunca expostos ao client.
- O projeto deve manter documentação operacional dentro do repositório para permitir troca entre Mac, PC e outras IAs.

## Estado atual

Estado registrado em 2026-04-15.

O repositório contém:

- Aplicação Next.js em `src/`.
- Migrations SQL de `001` a `007` em `database/migrations`.
- Documentação existente em `docs/SYSTEM_DESIGN.md` e `docs/AUTOMATION_FLOWS.md`.
- Scripts npm principais: `dev`, `build`, `type-check`, `db:migrate`, `db:seed`.

Pontos técnicos conhecidos:

- A migration `007_fix_rls_recursion.sql` existe para corrigir recursão de RLS entre `profiles` e `organizations`.
- O uso de `SUPABASE_SERVICE_ROLE_KEY` deve ser restrito a código server-side.
- O schema tem histórico de divergência entre migrations, tipos TypeScript e serviços.
- Antes de avançar em integrações, validar se o serviço usa `integrations` ou `org_integrations`.
- `database.types.ts` deve ser regenerado a partir do Supabase real quando houver conexão direta com o projeto.

Variáveis de ambiente esperadas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Variáveis OAuth por provedor conforme integração.
- Variáveis Stripe quando billing for ativado.

## Como continuar em outra máquina

1. Fazer `git pull`.
2. Ler este arquivo.
3. Ler `docs/session-log.md`.
4. Ler `docs/next-step.md`.
5. Informar o ambiente ao iniciar a sessão: `Mac` ou `PC`.
6. Rodar `npm install` se necessário.
7. Rodar `npm run type-check` antes de editar áreas sensíveis.
8. Conferir variáveis locais em `.env.local`.
9. Ao finalizar uma etapa, atualizar a documentação.
