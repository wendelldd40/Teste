# Roteiro de virada - EstudeVet v11

Siga na ordem. Cada passo tem um **resultado esperado** verificavel - se o que
voce ve for diferente, pare e anote antes de seguir.

Reserve umas duas horas. A parte 1 e a mais chata e a que mais evita dor.

---

## Parte 0 - Antes de tocar em qualquer coisa

- [ ] O banco ANTIGO continua no ar e servindo a v10 normalmente.
- [ ] Voce criou um projeto Supabase **novo**, vazio.
- [ ] Nada neste roteiro escreve no banco antigo. Se algum passo pedir isso,
      esta errado - pare.

---

## Parte 1 - Banco

### 1.1 Migrations

Rode na ordem, uma por vez, conferindo o resultado de cada:

```
supabase/migrations/0001_schema_inicial.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_gabarito_e_respostas.sql
supabase/migrations/0004_admin_e_storage.sql
supabase/migrations/0005_progresso_e_conquistas.sql
supabase/seed.sql
```

**Esperado:** nenhum erro. Se a 0003 reclamar de `revoke`, ou a 0004 de
`storage.objects`, pare e me avise - sao os dois pontos mais provaveis de
atrito com a configuracao do projeto.

- [ ] As seis rodaram sem erro.

### 1.2 Conferir o catalogo

No SQL editor:

```sql
select p.numero, count(*) as materias, count(*) filter (where m.ativa) as ativas
from public.materias m join public.periodos p on p.id = m.periodo_id
group by p.numero order by p.numero;
```

**Esperado:** 10 linhas, 67 materias no total, 7 ativas (todas no 4o, 5o e 8o
periodo).

- [ ] Bateu.

### 1.3 Conferir que RLS esta ligada em tudo

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and not rowsecurity;
```

**Esperado:** zero linhas. Qualquer tabela que aparecer aqui esta aberta.

- [ ] Zero linhas.

### 1.4 O teste de seguranca mais importante

Este e o passo que nao da para pular. Crie **dois** usuarios pelo app
(parte 3) e volte aqui.

Com o usuario A logado, no SQL editor autenticado como ele (ou pelo app via
console do navegador):

```sql
-- Deve devolver ERRO de permissao, nao dados:
select correta from public.alternativas limit 1;

-- Deve devolver ERRO, nao inserir:
insert into public.respostas (sessao_id, usuario_id, questao_id, correta)
values (gen_random_uuid(), auth.uid(), gen_random_uuid(), true);

-- Deve devolver zero linhas (atividade do usuario B):
select * from public.atividade_diaria where usuario_id <> auth.uid();
```

**Esperado:** os dois primeiros dao erro de permissao; o terceiro volta vazio.
Se algum devolver dado, **nao libere para a turma** - o gabarito ou o
progresso alheio estao expostos.

- [ ] `alternativas.correta` recusou.
- [ ] `insert` em respostas recusou.
- [ ] Atividade de outro usuario veio vazia.

---

## Parte 2 - Migracao das questoes

### 2.1 Exportar (somente leitura no banco antigo)

```bash
LEGADO_SUPABASE_URL=... LEGADO_SUPABASE_KEY=... \
  npx tsx scripts/migracao/exportar-legado.ts > legado.json
```

- [ ] O arquivo foi gerado e o numero de questoes bate com o que voce espera.

### 2.2 Conferir sem gravar

```bash
npm run migrar:conferir
```

Abra os quatro CSV em `scripts/migracao/relatorios/`:

- [ ] `rejeitadas.csv` - toda linha aqui e questao que **nao entra**. Leia
      todas. Se alguma foi rejeitada por engano, corrija no `legado.json`.
- [ ] `temas-ambiguos.csv` - decida cada par: sao o mesmo assunto ou nao?
- [ ] `assuntos-propostos.csv` - os nomes fazem sentido para o aluno ver?
- [ ] `precisa-revisao.csv` - o tamanho desta lista e quanto trabalho voce
      tera na fila de revisao. Se for grande demais, vale ajustar antes.

Repita o dry-run ate o relatorio ficar do jeito que voce quer.

### 2.3 Gravar

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrar:executar
```

- [ ] O relatorio final bate com o do dry-run.
- [ ] O banco antigo continua intacto (confira o total de questoes nele).

---

## Parte 3 - Aplicacao

### 3.1 Ambiente e build

- [ ] `.env.local` preenchido a partir do `.env.example`.
- [ ] `npm run verificar` passa (tipos, testes e auditoria).
- [ ] `npm run build` termina sem erro.
- [ ] Na Vercel, as quatro variaveis do projeto novo estao cadastradas.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` **nao** tem prefixo `NEXT_PUBLIC_`.

### 3.2 Entrar

- [ ] Criar conta com email e senha funciona.
- [ ] O email de confirmacao chega.
- [ ] Depois de confirmar, o login leva ao Dashboard.
- [ ] Abrir `/simulados` deslogado redireciona para `/entrar` **e volta para
      `/simulados`** depois de entrar.

### 3.3 Tornar-se admin

Sua conta nasce como aluno. No SQL editor:

```sql
update public.usuarios set papel = 'admin' where email = 'SEU_EMAIL';
```

- [ ] O item "Admin" aparece no menu depois de recarregar.
- [ ] Com uma conta de aluno, `/admin` redireciona para o Dashboard.

### 3.4 Admin

- [ ] O Resumo mostra os numeros da migracao.
- [ ] Em Materias, ligar e desligar uma materia funciona.
- [ ] Subir uma capa: escolha uma foto **vertical de celular**. O card deve
      mostrar ela cortada em 16:9, sem distorcer.
- [ ] Materia sem capa mostra a arte com as iniciais, nao um espaco vazio.
- [ ] Em Assuntos, criar um assunto filho de outro indenta corretamente.
- [ ] Na Fila de revisao, uma questao incompleta lista o que falta e o botao
      Publicar fica desabilitado.
- [ ] Completar a questao habilita o botao, e publicar funciona.

### 3.5 Liberar acesso a uma materia

```sql
insert into public.acessos_materia (usuario_id, materia_id, origem)
select u.id, m.id, 'cortesia'
from public.usuarios u, public.materias m
where u.email = 'SEU_EMAIL' and m.slug = 'analises-clinicas-veterinarias';
```

- [ ] Em Estudar, a materia liberada abre; as outras mostram "Nao liberada".
- [ ] Clicar numa materia nao liberada nao leva a lugar nenhum (nao e link).
- [ ] Abrir `/estudar/farmacologia-veterinaria-e-toxicologia` pelo endereco
      direto, sem acesso, mostra a explicacao - nao a materia.

### 3.6 Simulado - o teste mais importante da parte 3

- [ ] Montar um simulado de 10 questoes da materia liberada.
- [ ] Responder a questao 1. O comentario aparece **depois** de responder.
- [ ] **Antes de responder a questao 2**, abra o console do navegador e
      confirme que a resposta certa nao esta no HTML nem na resposta da API.
- [ ] Responder mais 2 ou 3 questoes.
- [ ] **Fechar a aba no meio.** Voltar ao Dashboard: deve oferecer continuar,
      na questao certa.
- [ ] Ao continuar, **a ordem das alternativas e a mesma de antes**.
- [ ] Terminar o simulado. O resultado mostra acertos, erros e comentarios.
- [ ] Abrir `/simulados/ID/resultado` de uma sessao **em andamento** nao
      mostra gabarito.

### 3.7 Progresso

- [ ] Responder 5 questoes num dia faz o dia contar para a sequencia.
- [ ] O anel do Dashboard cresce conforme as questoes da semana.
- [ ] Analise de Erros aponta um assunto mais fraco (ou explica que ainda nao
      ha dados suficientes).
- [ ] Evolucao mostra a curva com ao menos um ponto.
- [ ] Conquistas: a primeira medalha aparece depois do primeiro simulado.
- [ ] O bloco "mais constantes" comeca **vazio**.
- [ ] Ligar "aparecer nesta lista" faz voce aparecer; desligar tira.
- [ ] Com dois usuarios, quem **nao** ligou nao aparece para o outro.

### 3.8 Acessibilidade e telas

- [ ] Navegar o simulado inteiro **so pelo teclado** (Tab e Enter) funciona,
      e o foco e sempre visivel.
- [ ] No celular, o menu e as telas nao quebram.
- [ ] Ativar "reduzir movimento" no sistema para as animacoes.
- [ ] `/ranking` pelo endereco direto explica por que esta desligado.

---

## Parte 4 - Antes de mandar o link para a turma

- [ ] Nenhum emoji em lugar nenhum da interface.
- [ ] Voce fez pelo menos um simulado inteiro do comeco ao fim, como aluno.
- [ ] O `legado.json` **nao** foi commitado (esta no `.gitignore`).
- [ ] A service role key nao esta em nenhum arquivo versionado.
- [ ] Voce sabe como liberar acesso de uma materia para um aluno novo.

---

## O que fazer se algo falhar

**Migration recusada:** anote a mensagem exata. Nada foi aplicado pela
metade - migration roda em transacao.

**Questao sem gabarito no simulado:** ela nao deveria estar publicada. Volte
a fila de revisao. O trigger deveria ter impedido - se nao impediu, me avise,
porque e falha de regra e nao de conteudo.

**Aluno vendo materia que nao pagou:** pare tudo e refaca o teste 1.4. E o
unico problema desta lista que justifica tirar o app do ar.

**Streak nao conta:** confira `metas_usuario.minimo_diario_questoes` (padrao
5) e o fuso do trigger em `0001` (`America/Bahia`). Se sua turma toda estiver
em Sergipe, esta certo.
