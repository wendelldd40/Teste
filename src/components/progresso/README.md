# Progresso

## Por que "mais constantes da semana" exige opt-in

O bloco substitui o ranking, mas continua mostrando OUTRAS pessoas. A RLS da
S1 so deixa cada aluno ler a propria `atividade_diaria` - e isso esta certo.

Em vez de afrouxar a politica, a migration 0005 criou:
- `usuarios.mostrar_em_destaques`, **padrao false**;
- `mais_constantes_semana()`, que so enxerga quem ligou.

Quem nao optou nao aparece nem como linha anonima. A lista nasce vazia, e o
estado vazio explica isso em vez de parecer erro. O controle fica ao lado da
lista, nao escondido nas configuracoes: quem ve a lista e quem decide se quer
estar nela.

## Conquistas

`avaliar_conquistas()` calcula e concede no servidor. Insert direto em
`usuario_conquistas` pelo cliente permitiria colecionar medalha sem estudar -
o mesmo raciocinio que tirou o insert direto de `respostas` na S3.

Medalhas sao SVG na paleta da marca, com forma diferente por familia de
criterio: chama para constancia, pilha para volume, alvo para pontaria, seta
de volta para erro revertido. Sem emoji, sem icone de biblioteca.

Criterio sem contador simples (acerto por materia, erros revertidos) nao
mostra barra de progresso. Barra chutada e pior que nenhuma barra.

## Graficos

Sem biblioteca: uma linha com pontos nao justifica a dependencia. A conversao
serie -> coordenadas e funcao pura porque e onde erro aparece - serie de um
ponto so (desenha no centro, nao colado no eixo), taxa fora de 0..1, NaN
gerando `d="M NaN NaN"` e sumindo com o grafico inteiro.
