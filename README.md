# Hïve

Plataforma SaaS para ajudar Empresas Juniores brasileiras a centralizar a rotina de gestão em um só lugar: projetos, membros, financeiro, documentos, reuniões, pontos, competências, playbooks e integrações.

O Hïve nasceu para reduzir a dependência de planilhas soltas, Notion, WhatsApp e arquivos espalhados. A proposta é ser um painel único para a EJ acompanhar operação, liderança e histórico institucional sem perder contexto a cada troca de gestão.

## Status do projeto

Este projeto ainda está em desenvolvimento. A base de autenticação, dashboard, navegação principal e primeiras páginas já existem, mas alguns módulos ainda estão em fase de protótipo ou implementação gradual.

O deploy atual roda na Vercel:

```txt
https://hitech-hub.vercel.app
```

## Como o projeto foi desenvolvido

Este projeto foi desenvolvido por Eduardo Cordeiro de Oliveira com apoio do Codex como parceiro de programação.

Na prática, eu uso o auxílio do Codex para acelerar a escrita e revisão de código em HTML, CSS, JavaScript/TypeScript e SQL. O Codex também ajuda na parte mais pesada e puxada do desenvolvimento, como estruturar fluxos de autenticação, revisar segurança, corrigir integração com Supabase, lidar com RLS, organizar migrations e investigar erros de deploy que seriam difíceis de resolver apenas com a minha experiência atual.

A ideia não é esconder o uso de IA, mas documentar o processo com transparência: o produto, as decisões e a direção do projeto são meus; a IA entra como apoio técnico para transformar as ideias em código funcional e aprender durante o caminho.

## Stack

| Área | Tecnologia |
| --- | --- |
| Frontend | Next.js 14, App Router, React, TypeScript |
| Estilos | Tailwind CSS |
| Backend | Route Handlers do Next.js |
| Banco de dados | Supabase PostgreSQL |
| Autenticação | Supabase Auth com magic link |
| Hospedagem | Vercel |
| Integrações planejadas | Google Workspace, Discord, Slack, Stripe, OpenAI |

## Funcionalidades

- Cadastro de EJ com magic link.
- Criação automática de organização e perfil no primeiro login.
- Dashboard protegido por autenticação.
- Sidebar com rotas principais da plataforma.
- Páginas iniciais para financeiro, wiki de bastão e documentos.
- Estrutura de planos `free`, `premium` e `internal`.
- Migrations do Supabase versionadas.
- Políticas de RLS corrigidas com helpers `SECURITY DEFINER`.
- Tipos do Supabase gerados a partir do banco real.

## Estrutura

```txt
hitech-hub/
├── database/
│   └── migrations/              # migrations SQL versionadas
├── docs/                        # documentação técnica e notas de arquitetura
├── public/                      # assets públicos
├── src/
│   ├── app/
│   │   ├── (auth)/              # login e cadastro
│   │   ├── (dashboard)/         # rotas protegidas da plataforma
│   │   └── api/                 # route handlers
│   ├── components/              # componentes de layout, dashboard e UI
│   ├── lib/                     # clientes, integrações e utilitários
│   ├── services/                # serviços de domínio e integrações
│   └── types/                   # tipos compartilhados
└── supabase/
    └── migrations/              # migrations usadas pela Supabase CLI
```

## Configuração local

Clone o projeto:

```bash
git clone https://github.com/EduardoCoOliveira/hive-ej.git
cd hive-ej
```

Instale as dependências:

```bash
npm install
```

Crie um arquivo `.env.local` com as variáveis necessárias:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Rode o projeto:

```bash
npm run dev
```

Abra:

```txt
http://localhost:3000
```

## Scripts úteis

```bash
npm run dev
npm run build
npm run type-check
npm run lint
```

## Observações técnicas

- A autenticação usa magic link pelo Supabase.
- O cliente normal do Supabase é usado para sessão e leitura protegida por RLS.
- O `SUPABASE_SERVICE_ROLE_KEY` deve ser usado apenas em rotas server-side que realmente precisam de privilégio elevado.
- As políticas de RLS foram ajustadas para evitar recursão entre `profiles` e `organizations`.
- Algumas integrações ainda são planejadas e podem aparecer como estrutura inicial no código.

## Roadmap

- Finalizar módulos reais de documentos e wiki.
- Integrar Google OAuth.
- Conectar Google Calendar e Google Drive.
- Implementar Stripe para planos pagos.
- Melhorar permissões administrativas por cargo.
- Adicionar testes e checks de CI.

## Licença

Projeto privado/educacional em desenvolvimento. Todos os direitos reservados ao autor.
