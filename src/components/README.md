# Telas

## Regra que a S5 restaurou

Nenhum componente chama o Supabase direto. Server Component pega o client de
servidor e **injeta** no repositorio:

```tsx
const sb = await getServerClient()
const materias = await listarComAcesso(sb)
```

Sem o client, o repositorio usa o do browser. Com ele, usa o injetado - e
IGNORA O CACHE.

Isso nao e detalhe: o cache de `base.ts` e um Map no modulo. No navegador,
isso e por aba. No servidor Node, o modulo e compartilhado entre requisicoes
de pessoas diferentes - cachear ali vazaria o progresso de um aluno para
outro. Por isso client injetado nunca le nem grava cache.

## Anel de progresso

O streak duplo do brief virou um anel de dois arcos: meta semanal por fora
(teal), dias da semana por dentro (dourado). A matematica (`tracoDoArco`)
fica fora do JSX porque e onde erro aparece - arco passando de uma volta,
divisao por zero, NaN quebrando o SVG. NaN vira anel vazio; Infinity vira
volta cheia.

## Execucao do simulado

- o gabarito NAO existe no cliente antes de responder. Chega no retorno de
  `responder()`, ja gravado;
- a ordem das alternativas vem da sessao, nao e sorteada na tela. Sair e
  voltar mostra a mesma ordem;
- sair no meio nao perde nada: a sessao fica aberta e o dashboard oferece
  continuar de onde parou.

## Ranking

A rota `/ranking` existe. O menu nao a lista, de proposito (decisao do
brief). No lugar dela, o bloco "mais constantes da semana" entra em Evolucao,
na S6.
