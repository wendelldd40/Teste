# FLUXO-QUESTOES

Padrao de producao de questoes do EstudeVet, atualizado para o schema da v11.

Substitui o fluxo da v10, que gerava `INSERT` direto com `opcao_a`...`opcao_e`.
Aquelas colunas nao existem mais.

---

## O ciclo

```
escrever lote (JSON)
      |
      v
npm run questoes:validar lote.json     <- nada toca o banco aqui
      |
      +-- erro?  corrige e repete
      |
      v
npm run questoes:importar lote.json    <- dry-run: mostra o que entraria
      |
      v
npm run questoes:importar lote.json -- --executar
      |
      v
fila de revisao no admin (o que entrou como precisa_revisao)
```

O validador roda **sem banco**. E de proposito: descobrir que 40 de 200
questoes estao quebradas depois de importar significa limpar o banco a mao.

---

## Formato do lote

Um arquivo JSON. Usa **slug**, nao uuid - quem escreve a questao nao tem como
saber o uuid de nada; o importador resolve.

```json
{
  "gerado_em": "2026-08-01",
  "questoes": [
    {
      "referencia": "AC-001",
      "materia_slug": "analises-clinicas-veterinarias",
      "assunto_slugs": ["hemograma"],
      "tipo": "assertivas",
      "dificuldade": "dificil",
      "enunciado": "Sobre os leucocitos granulocitos, analise as assertivas.",
      "assertivas": [
        { "numeral": "I", "texto": "..." },
        { "numeral": "II", "texto": "..." }
      ],
      "alternativas": [
        { "letra": "a", "texto": "Apenas IV esta incorreta", "correta": true },
        { "letra": "b", "texto": "..." },
        { "letra": "c", "texto": "..." },
        { "letra": "d", "texto": "..." },
        { "letra": "e", "texto": "..." }
      ],
      "comentario": "Por que a correta esta correta e o erro mais comum.",
      "fonte": "Thrall, Hematologia, 2a ed., cap. 6",
      "status": "publicada"
    }
  ]
}
```

### Campos

| Campo | Obrigatorio | Observacao |
|---|---|---|
| `referencia` | nao | so para voce achar a questao no relatorio |
| `materia_slug` | **sim** | tem que existir no banco (veja `seed.sql`) |
| `assunto_slugs` | nao, mas importa | sem ele a questao nao entra em simulado por assunto nem na Analise de Erros |
| `tipo` | nao | `multipla_escolha` (padrao), `assertivas`, `julgamento` |
| `dificuldade` | nao | `facil`, `medio` (padrao), `dificil` |
| `enunciado` | **sim** | minimo 15 caracteres |
| `assertivas` | so nos tipos com assertiva | minimo 2 |
| `alternativas` | **sim** | exatamente 5, letras `a` a `e` |
| `comentario` | **sim para publicar** | e o que o aluno le depois de responder |
| `fonte` | nao | deixou de ser obrigatoria na v11 |
| `status` | nao | `publicada` (padrao) ou `precisa_revisao` |

### Gabarito: duas formas, nunca as duas em conflito

```json
"alternativas": [{ "letra": "a", "texto": "...", "correta": true }]
```

ou

```json
"gabarito": "A"
```

Se voce usar as duas e elas discordarem, o validador **recusa**. Essa foi a
inconsistencia mais perigosa que apareceu nos testes: sem a checagem, a
questao importaria com o gabarito errado e ninguem perceberia ate um aluno
reclamar.

---

## Os tres tipos

**`multipla_escolha`** - enunciado e 5 alternativas. O caso comum.

**`assertivas`** - enunciado, assertivas numeradas (I, II, III) e 5
alternativas que falam sobre elas ("Apenas IV esta incorreta"). O campo
`correta` de cada assertiva e opcional aqui: serve de apoio ao comentario.

**`julgamento`** - cada assertiva e julgada certo/errado individualmente.
Aqui `correta` e **obrigatorio** em toda assertiva. O banco recusa publicar
sem isso.

---

## O que bloqueia (erro) e o que so avisa (alerta)

### Bloqueia a importacao

- menos ou mais de 5 alternativas, em questao publicada
- letra fora de `a`-`e`, ou letra repetida
- duas alternativas com o mesmo texto
- nenhum gabarito, ou mais de um
- conflito entre `correta: true` e `gabarito`
- questao publicada sem comentario
- tipo com assertivas e menos de 2 assertivas
- `julgamento` com assertiva sem gabarito
- enunciado repetido dentro do proprio lote

### So avisa

- questao sem `assunto_slugs`
- comentario com menos de 20 caracteres
- alternativa com "todas as anteriores" ou "nenhuma das anteriores"
- a alternativa correta bem mais longa que as outras

Os dois ultimos sao de qualidade, nao de schema. "Todas as anteriores"
costuma ser acerto de graca, e alternativa correta comprida entrega a
resposta para quem nao estudou - dois vicios classicos de questao gerada em
lote.

**Um erro em qualquer questao derruba o lote inteiro.** Metade de um lote
dentro do banco e pior que lote nenhum, porque voce perde a conta do que ja
entrou.

---

## Gerando em lote com modelo

Prompt base. Ajuste materia, assunto e quantidade:

```
Voce vai escrever questoes de multipla escolha para uma plataforma de estudos
de Medicina Veterinaria, nivel graduacao.

CONTEXTO
Materia: <nome da materia>
Assunto: <assunto especifico>
Quantidade: <n>
Dificuldade: <facil | medio | dificil>

REGRAS
- Exatamente 5 alternativas, letras a, b, c, d, e.
- Exatamente uma correta, marcada com "correta": true.
- Todas as alternativas plausiveis para quem estudou pouco. Distrator obvio
  nao mede nada.
- As 5 alternativas com comprimento parecido. Nao deixe a correta ser a mais
  longa.
- Nada de "todas as anteriores", "nenhuma das anteriores" ou "n.d.a".
- O comentario explica POR QUE a correta esta correta e qual o engano mais
  provavel. Duas a quatro frases.
- Nenhum emoji em lugar nenhum.
- Portugues do Brasil, registro tecnico mas legivel por aluno de graduacao.

FORMATO
Responda SO com JSON valido, sem cercas de markdown, neste formato:

{
  "questoes": [
    {
      "referencia": "<sigla>-001",
      "materia_slug": "<slug>",
      "assunto_slugs": ["<slug>"],
      "tipo": "multipla_escolha",
      "dificuldade": "<dificuldade>",
      "enunciado": "...",
      "alternativas": [
        {"letra": "a", "texto": "...", "correta": true},
        {"letra": "b", "texto": "..."},
        {"letra": "c", "texto": "..."},
        {"letra": "d", "texto": "..."},
        {"letra": "e", "texto": "..."}
      ],
      "comentario": "...",
      "fonte": "<livro, capitulo>"
    }
  ]
}
```

Para questoes de assertivas, troque o bloco de formato por `"tipo":
"assertivas"` e acrescente:

```
      "assertivas": [
        {"numeral": "I", "texto": "..."},
        {"numeral": "II", "texto": "..."}
      ],
```

Sempre passe o resultado pelo validador antes de importar. Modelo erra
gabarito com frequencia maior do que parece, e o erro e silencioso.

---

## Onde achar os slugs

```sql
-- materias
select slug, nome from public.materias where ativa order by nome;

-- assuntos de uma materia
select a.slug, a.nome
from public.assuntos a
join public.materias m on m.id = a.materia_id
where m.slug = 'analises-clinicas-veterinarias'
order by a.ordem;
```

Assunto que nao existe nao derruba a importacao: a questao entra sem vinculo
e o relatorio lista quais faltaram. Crie o assunto no admin e reimporte so
essas.

---

## Diferencas em relacao ao fluxo da v10

| v10 | v11 |
|---|---|
| `INSERT` direto com `opcao_a`...`opcao_e` | JSON validado, importado por RPC transacional |
| `tema` como texto livre | `assunto_slugs`, entidade de verdade |
| assertivas separadas por `\|` no mesmo campo | lista propria, uma linha por assertiva |
| `ativo` true/false | `status`: rascunho, precisa_revisao, publicada, arquivada |
| fonte obrigatoria | fonte opcional |
| erro descoberto no ar | erro descoberto antes de tocar o banco |
