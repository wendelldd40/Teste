/**
 * EstudeVet v11 - Validacao de lote de questoes.
 *
 *   npx tsx scripts/questoes/validar-lote.ts lote.json
 *
 * Por que existe: voce produz questao em lote. Descobrir que 40 de 200 estao
 * quebradas DEPOIS de importar significa limpar o banco a mao. Este script
 * roda antes, sem tocar em nada, e diz exatamente o que consertar.
 *
 * As regras aqui sao as MESMAS do banco (trigger da 0001 e validacao da
 * 0004). Se divergirem, o banco vence - e o certo e corrigir este arquivo.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DIFICULDADES,
  LETRAS_ALTERNATIVA,
  STATUS_REVISAO,
  TIPOS_QUESTAO,
} from '../../src/types/database'
import type { Dificuldade, StatusRevisao, TipoQuestao } from '../../src/types/database'

// ---------------------------------------------------------------------------
// Formato de autoria
//
// Usa SLUG, nao uuid: quem escreve a questao (voce, ou um modelo gerando em
// lote) nao tem como saber o uuid de nada. O importador resolve.
// ---------------------------------------------------------------------------

export interface QuestaoDeLote {
  materia_slug: string
  assunto_slugs?: string[]
  tipo?: TipoQuestao
  dificuldade?: Dificuldade
  enunciado: string
  assertivas?: Array<{ numeral?: string; texto: string; correta?: boolean | null }>
  alternativas: Array<{ letra: string; texto: string; correta?: boolean }>
  gabarito?: string
  comentario?: string | null
  fonte?: string | null
  status?: StatusRevisao
  referencia?: string
}

export interface Lote {
  gerado_em?: string
  questoes: QuestaoDeLote[]
}

export type Gravidade = 'erro' | 'alerta'

export interface Achado {
  indice: number
  referencia: string
  gravidade: Gravidade
  regra: string
  mensagem: string
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

const MIN_ENUNCIADO = 15
const MIN_ALTERNATIVA = 1
const MIN_COMENTARIO = 20

export function validaQuestao(q: QuestaoDeLote, indice: number): Achado[] {
  const achados: Achado[] = []
  const ref = q.referencia ?? `#${indice + 1}`

  const erro = (regra: string, mensagem: string) =>
    achados.push({ indice, referencia: ref, gravidade: 'erro', regra, mensagem })
  const alerta = (regra: string, mensagem: string) =>
    achados.push({ indice, referencia: ref, gravidade: 'alerta', regra, mensagem })

  // --- Materia --------------------------------------------------------------
  if (!q.materia_slug?.trim()) {
    erro('materia', 'sem materia_slug')
  }

  // --- Enunciado ------------------------------------------------------------
  const enunciado = (q.enunciado ?? '').trim()
  if (!enunciado) {
    erro('enunciado', 'enunciado vazio')
  } else if (enunciado.length < MIN_ENUNCIADO) {
    erro('enunciado', `enunciado com ${enunciado.length} caracteres, minimo ${MIN_ENUNCIADO}`)
  }

  // --- Tipo e dificuldade ---------------------------------------------------
  const tipo = q.tipo ?? 'multipla_escolha'
  if (!TIPOS_QUESTAO.includes(tipo)) {
    erro('tipo', `tipo '${tipo}' invalido (use ${TIPOS_QUESTAO.join(', ')})`)
  }
  const dificuldade = q.dificuldade ?? 'medio'
  if (!DIFICULDADES.includes(dificuldade)) {
    erro('dificuldade', `dificuldade '${dificuldade}' invalida`)
  }
  const status = q.status ?? 'publicada'
  if (!STATUS_REVISAO.includes(status)) {
    erro('status', `status '${status}' invalido`)
  }

  // --- Alternativas ---------------------------------------------------------
  const alternativas = q.alternativas ?? []

  if (alternativas.length !== 5) {
    const grave = status === 'publicada'
    const msg = `${alternativas.length} alternativas, o schema exige 5`
    if (grave) erro('alternativas', msg)
    else alerta('alternativas', `${msg} (nao bloqueia rascunho)`)
  }

  const letras = alternativas.map((a) => (a.letra ?? '').trim().toLowerCase())

  for (const [i, letra] of letras.entries()) {
    if (!LETRAS_ALTERNATIVA.includes(letra as (typeof LETRAS_ALTERNATIVA)[number])) {
      erro('alternativas', `alternativa ${i + 1}: letra '${letra}' fora de a-e`)
    }
  }
  if (new Set(letras).size !== letras.length) {
    erro('alternativas', 'letras repetidas entre as alternativas')
  }

  for (const [i, a] of alternativas.entries()) {
    const texto = (a.texto ?? '').trim()
    if (texto.length < MIN_ALTERNATIVA) {
      erro('alternativas', `alternativa ${letras[i] ?? i + 1}: texto vazio`)
    }
  }

  const textos = alternativas.map((a) => (a.texto ?? '').trim().toLowerCase())
  const repetidos = textos.filter((t, i) => t && textos.indexOf(t) !== i)
  if (repetidos.length > 0) {
    erro('alternativas', 'duas alternativas com o mesmo texto')
  }

  // --- Gabarito -------------------------------------------------------------
  // Aceita duas formas: `correta: true` na alternativa, ou `gabarito: "A"`.
  const marcadas = alternativas.filter((a) => a.correta === true)
  const gabaritoSolto = (q.gabarito ?? '').trim().toLowerCase()

  if (marcadas.length === 0 && !gabaritoSolto) {
    erro('gabarito', 'sem gabarito: marque correta: true ou informe gabarito')
  } else if (marcadas.length > 1) {
    erro('gabarito', `${marcadas.length} alternativas marcadas como corretas, exige 1`)
  } else if (marcadas.length === 0 && gabaritoSolto) {
    if (!letras.includes(gabaritoSolto)) {
      erro('gabarito', `gabarito '${q.gabarito}' nao corresponde a nenhuma alternativa`)
    }
  } else if (marcadas.length === 1 && gabaritoSolto) {
    const letraMarcada = (marcadas[0].letra ?? '').trim().toLowerCase()
    if (letraMarcada !== gabaritoSolto) {
      erro(
        'gabarito',
        `conflito: alternativa '${letraMarcada}' marcada, mas gabarito diz '${gabaritoSolto}'`
      )
    }
  }

  // --- Assertivas -----------------------------------------------------------
  const assertivas = q.assertivas ?? []

  if (tipo === 'multipla_escolha' && assertivas.length > 0) {
    alerta('assertivas', 'tipo multipla_escolha com assertivas: deveria ser tipo assertivas')
  }

  if (tipo !== 'multipla_escolha') {
    if (assertivas.length < 2) {
      erro('assertivas', `tipo ${tipo} exige ao menos 2 assertivas, recebidas ${assertivas.length}`)
    }
    for (const [i, a] of assertivas.entries()) {
      if (!(a.texto ?? '').trim()) {
        erro('assertivas', `assertiva ${i + 1}: texto vazio`)
      }
    }
    if (tipo === 'julgamento') {
      const semGabarito = assertivas.filter(
        (a) => a.correta === null || a.correta === undefined
      ).length
      if (semGabarito > 0) {
        erro(
          'assertivas',
          `tipo julgamento exige gabarito em toda assertiva; ${semGabarito} sem`
        )
      }
    }
  }

  // --- Comentario -----------------------------------------------------------
  const comentario = (q.comentario ?? '').trim()
  if (!comentario) {
    if (status === 'publicada') {
      erro('comentario', 'questao publicada sem comentario: o aluno nao entende o erro')
    } else {
      alerta('comentario', 'sem comentario')
    }
  } else if (comentario.length < MIN_COMENTARIO) {
    alerta('comentario', `comentario com ${comentario.length} caracteres, muito curto`)
  }

  // --- Assuntos -------------------------------------------------------------
  if (!q.assunto_slugs || q.assunto_slugs.length === 0) {
    alerta('assunto', 'sem assunto: nao aparece em simulado por assunto nem na analise de erros')
  }

  // --- Sinais de questao mal escrita ---------------------------------------
  if (/\b(todas as (alternativas|anteriores)|nenhuma das (alternativas|anteriores)|n\.d\.a)\b/i.test(
    textos.join(' ')
  )) {
    alerta('qualidade', 'usa "todas as anteriores" ou similar: costuma ser entregavel de graca')
  }

  const maisLonga = Math.max(...textos.map((t) => t.length), 0)
  const media = textos.reduce((s, t) => s + t.length, 0) / Math.max(textos.length, 1)
  const correta = marcadas[0] ?? alternativas.find((a) => (a.letra ?? '').toLowerCase() === gabaritoSolto)
  if (correta && (correta.texto ?? '').trim().length === maisLonga && maisLonga > media * 1.8) {
    alerta('qualidade', 'a alternativa correta e bem mais longa que as outras: entrega a resposta')
  }

  return achados
}

export function validaLote(lote: Lote): Achado[] {
  const achados = (lote.questoes ?? []).flatMap((q, i) => validaQuestao(q, i))

  // Enunciado duplicado dentro do proprio lote.
  const vistos = new Map<string, number>()
  ;(lote.questoes ?? []).forEach((q, i) => {
    const chave = (q.enunciado ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
    if (!chave) return
    const antes = vistos.get(chave)
    if (antes !== undefined) {
      achados.push({
        indice: i,
        referencia: q.referencia ?? `#${i + 1}`,
        gravidade: 'erro',
        regra: 'duplicada',
        mensagem: `enunciado identico ao da questao #${antes + 1}`,
      })
    } else {
      vistos.set(chave, i)
    }
  })

  return achados.sort((a, b) => a.indice - b.indice)
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function principal() {
  const caminho = process.argv[2]
  if (!caminho) {
    console.error('Uso: npx tsx scripts/questoes/validar-lote.ts lote.json')
    process.exit(2)
  }

  const lote = JSON.parse(readFileSync(resolve(process.cwd(), caminho), 'utf8')) as Lote
  const achados = validaLote(lote)
  const total = lote.questoes?.length ?? 0

  const erros = achados.filter((a) => a.gravidade === 'erro')
  const alertas = achados.filter((a) => a.gravidade === 'alerta')
  const indicesComErro = new Set(erros.map((e) => e.indice))

  console.log('='.repeat(70))
  console.log(`Validacao de lote - ${total} questoes`)
  console.log('='.repeat(70))

  const porQuestao = new Map<number, Achado[]>()
  for (const a of achados) {
    if (!porQuestao.has(a.indice)) porQuestao.set(a.indice, [])
    porQuestao.get(a.indice)!.push(a)
  }

  for (const [indice, lista] of [...porQuestao.entries()].sort((a, b) => a[0] - b[0])) {
    const q = lote.questoes[indice]
    const marca = lista.some((l) => l.gravidade === 'erro') ? 'ERRO ' : 'ALERTA'
    console.log(`\n${marca} ${q.referencia ?? `#${indice + 1}`}  ${(q.enunciado ?? '').slice(0, 52)}...`)
    for (const a of lista) {
      console.log(`   ${a.gravidade === 'erro' ? 'x' : '!'} [${a.regra}] ${a.mensagem}`)
    }
  }

  console.log('\n' + '-'.repeat(70))
  console.log(`  prontas para importar: ${total - indicesComErro.size}`)
  console.log(`  com erro (bloqueadas): ${indicesComErro.size}`)
  console.log(`  alertas (nao bloqueiam): ${alertas.length}`)

  if (erros.length > 0) {
    console.log('\nCorrija os erros e rode de novo. Nada foi importado.')
    process.exit(1)
  }

  console.log('\nLote valido. Pode importar.')
}

if (process.argv[1]?.includes('validar-lote')) principal()
