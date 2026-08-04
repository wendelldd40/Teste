# Comece aqui

Tres passos. Uns 20 minutos ate ver o app rodando.

---

## 1. Banco (5 min)

1. Abra o SQL Editor do projeto no Supabase.
2. Abra `supabase/INSTALAR-TUDO.sql`, copie **o arquivo inteiro** e cole.
3. Rode.

Nao deve dar erro. Se der, **pare** e me mande a mensagem exata - nada foi
aplicado pela metade, cada bloco roda em transacao.

Confira, numa aba nova do SQL Editor:

```sql
select
  (select count(*) from public.materias)                   as materias,     -- 67
  (select count(*) from public.materias where ativa)       as ativas,       --  7
  (select count(*) from public.conquistas)                 as conquistas,   -- 12
  (select count(*) from pg_tables
     where schemaname = 'public' and not rowsecurity)      as sem_rls;      --  0
```

`sem_rls` tem que dar **zero**. Se der qualquer outra coisa, tem tabela aberta.

---

## 2. Aplicacao (10 min)

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Deve cair na tela de entrar.

Nao precisa configurar nada: a URL e a chave publica do Supabase estao
embutidas em `src/lib/supabase/config.ts`. Elas sao publicas por natureza -
vao para o navegador em qualquer app Next, e quem protege os dados e a RLS.

**Na Vercel tambem nao precisa cadastrar variavel nenhuma.** O deploy sobe
direto.

So ha uma chave secreta de verdade, a `service_role`, e ela e usada apenas
pelos scripts que rodam na sua maquina (migracao e importacao de questoes).
Quando for usar um deles:

- No Supabase: **Settings > API Keys > Legacy > service_role > Reveal**
- Crie um `.env.local` com `SUPABASE_SERVICE_ROLE_KEY=` e cole ali

Esse arquivo nao vai para o GitHub. Nunca cole essa chave em chat, issue ou
commit.

---

## 3. Primeira conta e primeiro acesso (5 min)

1. Crie sua conta pelo app e confirme o email.
2. Vire admin, no SQL Editor:

```sql
update public.usuarios set papel = 'admin' where email = 'SEU_EMAIL_AQUI';
```

3. Recarregue: "Admin" aparece no menu.
4. Libere uma materia para voce mesmo:

```sql
insert into public.acessos_materia (usuario_id, materia_id, origem)
select u.id, m.id, 'cortesia'
from public.usuarios u, public.materias m
where u.email = 'SEU_EMAIL_AQUI'
  and m.slug = 'analises-clinicas-veterinarias';
```

Agora a materia abre em Estudar. Ainda nao ha questoes - elas chegam pela
migracao (`scripts/migracao/`) ou por lote novo (`FLUXO-QUESTOES.md`).

---

## Subir para o GitHub

```bash
git init
git add .
git commit -m "EstudeVet v11: reconstrucao completa"
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/estudevet.git
git push -u origin main
```

Antes do push, confirme que a service_role nao esta indo junto:

```bash
git status --short | grep -c "\.env\.local" ; echo "^ tem que ser 0"
grep -r "service_role" --include="*.ts" --include="*.tsx" src/ | grep -v "SERVICE_ROLE_KEY"
```

O segundo comando nao deve imprimir nada.

---

## Depois

- **`ROTEIRO-DE-VIRADA.md`** - o teste completo antes de liberar para a turma.
  O passo 1.4 (gabarito nao vaza, resposta nao e falsificavel) e o unico que
  eu nao pularia.
- **`FLUXO-QUESTOES.md`** - como produzir questao nova.
- **`README.md`** - as quatro regras que sustentam o projeto.

---

## Se o build falhar na Vercel

**`Module not found: Can't resolve '@/...'`**
O `tsconfig.json` precisa de `"baseUrl": "."` junto com `paths`. Sem ele, o
webpack nao enxerga o alias. Ja esta corrigido nesta versao - se voltar a
acontecer, confira se o `tsconfig.json` foi para o repositorio.

**`npm ci` falha por falta de lockfile**
O `package-lock.json` tem que estar commitado. Ele nao esta no `.gitignore`.

**Erro de tipo em `.update()` ou `.insert()` do Supabase**
Confira a versao do `@supabase/ssr` no `package-lock.json`. Versoes 0.5.x
tipam o client de forma incompativel e o build quebra com "not assignable to
parameter of type 'never'". O minimo e `0.12.4`.

**`500: INTERNAL_SERVER_ERROR` com `MIDDLEWARE_INVOCATION_FAILED`**
Nao acontece mais: o middleware foi removido. Se voce ainda ve isso, o deploy
no ar e antigo - confira em Deployments > o do topo > Source qual commit esta
rodando.

**Erro de fonte do Google**
`next/font` busca as fontes na hora do build. Se a Vercel nao alcancar o
Google Fonts, o build falha - basta refazer o deploy.
