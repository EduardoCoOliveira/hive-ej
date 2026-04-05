# Configuração do Supabase para Login

Este guia mostra **exatamente** o que configurar no Supabase Dashboard para o login com Google e Magic Link funcionarem.

---

## 1. Criar o Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e clique em **New Project**
2. Escolha nome, senha do banco e região (South America - São Paulo se disponível)
3. Aguarde o projeto inicializar (~2 minutos)

---

## 2. Pegar as Chaves do Projeto

No Supabase Dashboard: **Settings → API**

Copie e cole no arquivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://XXXXXXXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...  (anon public)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...       (service_role - NUNCA expor no cliente)
```

---

## 3. Configurar URLs de Redirecionamento ⚠️ OBRIGATÓRIO

Sem isso, nenhum login funciona.

No Supabase Dashboard: **Authentication → URL Configuration**

### Site URL
```
http://localhost:3000
```
> Em produção, mude para `https://seudominio.com`

### Redirect URLs (adicione TODAS)
```
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/callback/magic
http://localhost:3000/**
```
> Em produção, adicione também:
> ```
> https://seudominio.com/api/auth/callback/google
> https://seudominio.com/api/auth/callback/magic
> ```

---

## 4. Ativar Login com Google ⚠️ OBRIGATÓRIO para o botão Google

### Passo A — Criar credenciais no Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto novo (ou use um existente)
3. Vá em **APIs & Services → Credentials**
4. Clique em **+ Create Credentials → OAuth 2.0 Client IDs**
5. Escolha **Web application**
6. Em **Authorized redirect URIs**, adicione:
   ```
   https://XXXXXXXXXX.supabase.co/auth/v1/callback
   ```
   > Substitua `XXXXXXXXXX` pelo ID do seu projeto Supabase (mesmo que está na URL do dashboard)
7. Clique em **Create** e copie o **Client ID** e **Client Secret**

### Passo B — Habilitar no Supabase

No Supabase Dashboard: **Authentication → Providers → Google**

1. Toggle **Enable Google Provider** → ON
2. Cole o **Client ID** e **Client Secret** do Google Cloud
3. Clique em **Save**

---

## 5. Configurar SMTP para Magic Link (opcional mas recomendado)

Por padrão, o Supabase envia e-mails pelo próprio servidor com limite de **3 e-mails/hora** em projetos gratuitos. Para desenvolvimento isso é suficiente.

Para produção, configure um SMTP próprio em:
**Authentication → SMTP Settings**

Opções gratuitas: [Resend](https://resend.com), [SendGrid](https://sendgrid.com), [Brevo](https://brevo.com)

---

## 6. Verificar o `.env.local`

O arquivo `.env.local` na raiz do projeto deve ter pelo menos:

```env
# Supabase (obrigatório)
NEXT_PUBLIC_SUPABASE_URL=https://XXXXXXXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Chave de criptografia (32 bytes em hex — gere com: openssl rand -hex 32)
ENCRYPTION_KEY=a1b2c3d4e5f6...

# OpenAI (para Atas e Reembolsos com IA)
OPENAI_API_KEY=sk-...
```

---

## 7. Rodar as Migrations do Banco

Após configurar o projeto, rode as migrations para criar as tabelas:

```bash
# Instale o CLI do Supabase (se não tiver)
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref XXXXXXXXXX

# Rode as migrations
supabase db push
```

**Ou** cole os arquivos `database/migrations/*.sql` direto no **SQL Editor** do Supabase Dashboard, em ordem (001, 002, 003...).

---

## 8. Testar

1. Reinicie o servidor: `npm run dev`
2. Acesse `http://localhost:3000/login`
3. Teste o Magic Link: insira seu e-mail e verifique a caixa de entrada
4. Teste o Google: clique no botão "Entrar com Google"

### Diagnóstico de erros comuns

| Erro na tela | Causa | Solução |
|---|---|---|
| `"Erro ao conectar com o Google"` | Provider não habilitado no Supabase | Passo 4B acima |
| `"Link inválido"` | URL não está na whitelist | Passo 3 acima |
| `"Muitas tentativas"` | Rate limit do Supabase free tier | Aguarde 1h ou configure SMTP próprio |
| Tela branca / sem erro | `NEXT_PUBLIC_SUPABASE_URL` ou `ANON_KEY` errados | Verifique `.env.local` e reinicie o servidor |
| `"invalid claim: missing sub claim"` | Sessão expirada | Faça login novamente |

---

## Checklist rápido

- [ ] `.env.local` criado com URL e chaves do Supabase
- [ ] Site URL configurado no Supabase Dashboard
- [ ] Redirect URLs adicionadas (Google callback + Magic callback)
- [ ] Google OAuth habilitado com Client ID e Secret
- [ ] Migrations rodadas no banco
- [ ] Servidor reiniciado após mudar o `.env.local`
