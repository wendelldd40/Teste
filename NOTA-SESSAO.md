# Por que nao ha middleware

A v11 tinha um `src/middleware.ts` que renovava o token de sessao a cada
navegacao. Ele foi **removido**.

## Motivo

Middleware roda em TODA rota. Qualquer erro dentro dele derruba o site
inteiro com `MIDDLEWARE_INVOCATION_FAILED` - nao uma pagina, todas. Foi
exatamente o que aconteceu no primeiro deploy: uma variavel de ambiente
ausente virou 500 em cada endereco do app, inclusive na tela de login que
explicaria o problema.

O custo de mante-lo nao compensa o que ele entrega.

## O que muda sem ele

**Nada de seguranca.** Quem barra acesso continua sendo:

1. o layout da area logada, que checa a sessao no servidor e manda para
   `/entrar` quem nao tem;
2. a RLS no banco, que recusa a consulta mesmo se a camada 1 falhar.

O middleware nunca foi camada de seguranca - era conveniencia.

**A unica perda:** o token deixa de ser renovado no servidor a cada
navegacao. O `supabase-js` continua renovando pelo navegador enquanto a aba
esta aberta, entao o efeito pratico e quase nulo. Em sessoes muito longas com
a aba parada, pode acontecer de pedir login de novo.

## Se um dia quiser de volta

Vale a pena quando houver muito acesso e a renovacao pelo navegador comecar a
incomodar. Se voltar, tres regras:

- tudo dentro de `try/catch`, sem excecao;
- nunca lancar - no pior caso, deixar a requisicao passar;
- ler variavel de ambiente com valor padrao, nunca com `!`.
