# Next Step - Hïve

## Próxima etapa objetiva

Validar e estabilizar a base Supabase antes de avançar em novas funcionalidades.

## Tarefa imediata

1. Rodar `npm run type-check`.
2. Corrigir erros diretamente ligados a schema Supabase, tipos ou imports quebrados.
3. Confirmar se `database/migrations/007_fix_rls_recursion.sql` já foi aplicada no Supabase remoto.
4. Se ainda não foi aplicada, aplicar a migration com Supabase CLI ou SQL editor.
5. Regenerar `src/lib/supabase/database.types.ts` a partir do banco real.
6. Rodar novamente `npm run type-check`.

## Critério de conclusão

- `npm run type-check` passa ou restam apenas erros documentados e não relacionados ao Supabase.
- RLS não causa mais recursão entre `profiles` e `organizations`.
- `database.types.ts` reflete o schema real do Supabase.
- `docs/session-log.md` registra o que foi feito.
- `docs/next-step.md` aponta a próxima tarefa depois da estabilização.

## Observações para Mac e PC

Se a sessão começar com `Mac`:

- GPT pode executar planejamento, edição e validação diretamente.

Se a sessão começar com `PC`:

- GPT deve dividir o trabalho com o modelo local quando fizer sentido.
- GPT pode gerar prompts para Qwen executar tarefas mecânicas, como localizar erros repetitivos ou comparar tipos.
- GPT deve revisar o resultado antes de considerar a etapa concluída.

## Protocolo obrigatório de sessão

- Se o usuário disser que está iniciando uma nova sessão de programação, perguntar/lembrar que ele deve informar a plataforma: `Mac` ou `PC`.
- Se o usuário disser que a sessão acabou, atualizar `docs/ai-context.md`, `docs/session-log.md` e `docs/next-step.md`, revisar `git status`, commitar as mudanças e preparar envio ao GitHub.
