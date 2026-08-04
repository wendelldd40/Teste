# Sprint 2 - Migracao do banco legado

O banco antigo nunca e alterado. A origem e um arquivo JSON; o destino e o
Supabase novo. Nenhum script aqui faz insert, update ou delete no projeto v10.

## Ordem

1. Exportar o banco antigo (somente leitura):

       LEGADO_SUPABASE_URL=... LEGADO_SUPABASE_KEY=... \
         npx tsx scripts/migracao/exportar-legado.ts > legado.json

2. Conferir sem gravar nada:

       npx tsx scripts/migracao/migrar.ts --arquivo legado.json --dry-run

3. Abrir os quatro CSV em `scripts/migracao/relatorios/`:

   - `assuntos-propostos.csv` - o que vai virar assunto no banco
   - `temas-ambiguos.csv`     - pares que o script NAO juntou; decisao sua
   - `rejeitadas.csv`         - questoes que nao entram e por que
   - `precisa-revisao.csv`    - entram, mas com pendencia

4. Corrigir o que precisar (no `legado.json` ou no mapa de materias) e repetir
   o dry-run ate o relatorio ficar do jeito que voce quer.

5. Gravar:

       SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
         npx tsx scripts/migracao/migrar.ts --arquivo legado.json --executar

## Regras aplicadas

- Questao sem gabarito valido e REJEITADA e registrada. Nunca importada.
- Questao sem comentario, com menos de 5 alternativas, com assertiva
  ilegivel, com enunciado curto ou sem tema entra como `precisa_revisao`.
- Ausencia de fonte nao marca nada: fonte deixou de ser obrigatoria.
- Materia sem mapeamento explicito e rejeitada. Nada de casar por
  similaridade de nome: 'patologia' na v10 poderia cair em Patologia Geral
  ou Especial, e o erro passaria despercebido.
- Reexecutar nao duplica: a chave e `origem_legado_id`.

## O que nao migra

`flashcards`, `flashcard_progresso`, `questoes_concurso`, `editais` -
decisoes travadas do brief.

## Ainda em aberto

- `conteudo_estudo` e exportado mas nao importado: o conteudo sera refeito a
  partir de apostilas e mapas mentais. Se voce quiser aproveitar parte do
  texto antigo, isso vira um passo proprio.
- `usuarios` do legado (xp_total, streak, total_questoes) tambem nao entra:
  os usuarios da v11 nascem do Supabase Auth do projeto novo. Se for para
  preservar historico de XP, precisa decidir como casar as contas.
