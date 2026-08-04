# Antes de cada commit

```bash
npm run verificar
```

Roda tipos, testes e auditoria. O mesmo comando roda no CI a cada push, entao
se passar aqui, passa la.

## O que a auditoria reprova

- tabela sem RLS, ou com RLS e nenhuma politica
- escrita direta em `respostas`, `atividade_diaria` ou `usuario_conquistas`
- rota referenciada que nao existe
- tela que busca dados e nao trata erro
- emoji em qualquer arquivo
- variavel de ambiente usada e nao documentada no `.env.example`
- segredo com prefixo `NEXT_PUBLIC_`

## Convencoes

- Portugues nos nomes de dominio (`materias`, `assuntos`, `questoes`),
  ingles nos tecnicos (`createClient`, `getSession`). Nunca misture dentro
  do mesmo nome.
- Nenhum componente importa o client do Supabase. Server Component injeta:
  `listarComAcesso(sb)`.
- Alteracao de banco e migration nova em `supabase/migrations/`, numerada.
  Nunca edite uma migration ja aplicada, e nunca mexa pelo painel.
- Toda tabela nova nasce com RLS habilitada e politica declarada no mesmo
  arquivo.
