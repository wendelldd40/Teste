# Camada de repositorios

Regra unica: **nenhum arquivo fora desta pasta importa o client do Supabase.**
Componente chama repositorio, repositorio chama banco. Sem excecao.

## Contrato

Toda funcao devolve `Resultado<T>` e nunca lanca:

```ts
const r = await materias.listarComAcesso()
if (!r.ok) return <Erro codigo={r.erro.codigo} />
// r.dados esta tipado aqui
```

`AppError.codigo` e estavel (`sem_acesso_materia`, `nao_encontrado`,
`sem_permissao`...), entao a tela decide o que fazer sem entender codigo do
Postgres.

## Cache

Explicito, por chave, com TTL. Quem escreve invalida:

```ts
await materias.atualizar(id, { ativa: true })  // ja invalida sozinho
progresso.invalidarProgresso()                 // depois de finalizar simulado
```

`invalidar('assuntos:')` derruba so o prefixo. O cache da v10 era um booleano
global: qualquer escrita obrigava a recarregar tudo.

## Gabarito

`alternativas.correta` **nao e legivel pelo cliente** (migration 0003). Por
isso `AlternativaVisivel` nao tem esse campo - o tipo impede o erro, nao so a
permissao.

O caminho da resposta e sempre:

```ts
const r = await simulados.responder(sessaoId, questaoId, alternativaId, segundos)
// r.dados.acertou e r.dados.alternativa_correta_id vem do servidor,
// depois de a resposta estar gravada
```

O cliente nunca decide se acertou. Se decidisse, bastaria um fetch para
inflar streak e conquistas.

## Montagem de simulado

`simulados.montar()` sorteia as questoes, embaralha as alternativas e **grava
a ordem** em `sessao_questoes.ordem_alternativas`. Retomar a sessao reproduz
a mesma tela. O gabarito e UUID, nunca indice: era o `correct: 0` da v10 que
quebrava ao reembaralhar.

## Agregacao no cliente

`desempenhoPorMateria` e `desempenhoPorAssunto` agregam em memoria. Sao as
respostas de UMA pessoa - volume pequeno. Se passar de alguns milhares de
respostas por aluno, isso vira view materializada no banco.
