# EstudeVet v11 — Estrutura de pastas

Regra que governa tudo: **nenhum componente conhece o Supabase**. O caminho é sempre
`tela -> repositorio -> client -> banco`. Quebrar isso uma vez e a v11 vira a v10.

```
estudevet/
├── supabase/
│   ├── migrations/              Migrations versionadas. Nunca alterar nada pelo painel.
│   │   ├── 0001_schema_inicial.sql   Enums, tabelas, indices, constraints, triggers.
│   │   └── 0002_rls.sql              Politicas de RLS, uma secao por tabela.
│   └── seed.sql                 Matriz curricular completa + conquistas base.
│
├── src/
│   ├── app/                     App Router. Cada rota e so composicao de componentes.
│   │   ├── (auth)/              Login e cadastro. Layout sem shell.
│   │   ├── (app)/               Area logada. Layout com sidebar + topbar.
│   │   │   ├── dashboard/
│   │   │   ├── estudar/         Lista de materias e trilhas.
│   │   │   │   └── [materia]/   Assuntos e materiais da materia.
│   │   │   ├── simulados/       Selecao, execucao e resultado.
│   │   │   │   └── [sessao]/    Execucao retomavel de uma sessao.
│   │   │   ├── analise-erros/
│   │   │   ├── evolucao/
│   │   │   ├── conquistas/
│   │   │   ├── perfil/
│   │   │   ├── ranking/         EXISTE mas fora do menu. Nao linkar.
│   │   │   └── admin/           Guardada no server, nao so na interface.
│   │   ├── layout.tsx
│   │   └── globals.css          Import do Tailwind + fontes.
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        Client de browser. Usado SO por repositorios.
│   │   │   ├── server.ts        Client de server component / route handler.
│   │   │   └── admin.ts         Client com service role. Nunca importado no cliente.
│   │   ├── auth/
│   │   │   ├── session.ts       getSession, getUsuarioAtual.
│   │   │   └── guards.ts        requireAdmin, requireAcessoMateria.
│   │   ├── errors.ts            AppError e normalizacao de erro do Postgres.
│   │   └── format.ts            Datas, porcentagem, tempo. Sem regra de negocio.
│   │
│   ├── repositories/            UNICA camada que fala com o banco.
│   │   ├── base.ts              Wrapper de erro, cache em memoria, invalidacao.
│   │   ├── materias.repo.ts
│   │   ├── assuntos.repo.ts
│   │   ├── questoes.repo.ts
│   │   ├── simulados.repo.ts    Inclui montagem e embaralhamento persistido.
│   │   ├── progresso.repo.ts    Respostas, atividade diaria, streak, metas.
│   │   ├── conquistas.repo.ts
│   │   └── acessos.repo.ts      Quem pode entrar em qual materia.
│   │
│   ├── types/
│   │   ├── database.ts          Tipos derivados do schema. Fonte unica de verdade.
│   │   └── dominio.ts           Tipos de view (QuestaoCompleta, ResumoMateria...).
│   │
│   ├── components/
│   │   ├── shell/               Sidebar, topbar, navegacao.
│   │   ├── ui/                  Design system proprio: Botao, Cartao, Selo, Anel...
│   │   ├── materias/            CartaoMateria (imagem 16:9), TrilhaGrupo.
│   │   ├── simulado/            Enunciado, ListaAssertivas, Alternativa, Cronometro.
│   │   └── progresso/           AnelProgresso, GraficoAcerto, Medalha.
│   │
│   └── hooks/                   Hooks de UI. Chamam repositorios, nunca o Supabase.
│
├── public/
│   └── marca/                   Logo e favicon. Imagens de materia vao no Storage.
├── tailwind.config.ts           Tokens da marca no theme. Nada de cor solta no JSX.
└── .env.local.example
```

## Por que assim

- **`repositories/` separado de `app/`**: a S2 (migracao) e a S4 (admin) escrevem nas mesmas
  tabelas que as telas leem. Com repositorio no meio, a regra vive num lugar so.
- **`types/database.ts` gerado a partir do schema**: se a coluna sumir, o build quebra antes
  do commit. Era o buraco da v10.
- **`ranking/` existe mas nao e linkada**: decisao travada do brief. A rota fica de pe para
  quando houver modelo de turma, sem virar codigo morto escondido.
- **`lib/supabase/admin.ts` isolado**: service role nunca pode vazar para bundle de cliente.
