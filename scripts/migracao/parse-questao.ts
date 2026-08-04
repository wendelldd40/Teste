/**
 * EstudeVet v11 - Sprint 2 - Parser de questao legada.
 *
 * Toda a heuristica que a v10 rodava em tempo de execucao (normalizarQuestao)
 * acontece aqui, uma unica vez, e o resultado vai para o banco em colunas
 * proprias. Depois desta migracao nenhuma tela precisa entender formato antigo.
 */

import type { QuestaoLegado } from './legado.types'
import { normalizaDificuldade } from './legado.types'
import type {
  Dificuldade,
  LetraAlternativa,
  TipoQuestao,
} from '../../src/types/database'

export const LETRAS: LetraAlternativa[] = ['a', 'b', 'c', 'd', 'e']

export interface AlternativaParseada {
  letra: LetraAlternativa
  texto: string
  correta: boolean
}

export interface AssertivaParseada {
  ordem: number
  numeral: string
  texto: string
}

export type MotivoRejeicao =
  | 'gabarito_ausente'
  | 'gabarito_invalido'
  | 'gabarito_sem_alternativa'
  | 'enunciado_vazio'
  | 'materia_desconhecida'
  | 'alternativas_insuficientes'

export type MotivoRevisao =
  | 'sem_comentario'
  | 'menos_de_cinco_alternativas'
  | 'assertivas_nao_parseadas'
  | 'enunciado_curto'
  | 'tema_ausente'

export interface QuestaoParseada {
  origem_legado_id: string
  materia_slug: string
  tipo: TipoQuestao
  dificuldade: Dificuldade
  enunciado: string
  comentario: string | null
  alternativas: AlternativaParseada[]
  assertivas: AssertivaParseada[]
  tema_original: string | null
  motivos_revisao: MotivoRevisao[]
}

export interface QuestaoRejeitada {
  origem_legado_id: string
  materia_key: string | null
  motivo: MotivoRejeicao
  detalhe: string
}

export type ResultadoParse =
  | { ok: true; questao: QuestaoParseada }
  | { ok: false; rejeitada: QuestaoRejeitada }

// ---------------------------------------------------------------------------
// Assertivas
// ---------------------------------------------------------------------------

const NUMERAL = /^([IVXLC]+|\d+)[.)\-]\s*/i

function montaAssertivas(partes: string[]): AssertivaParseada[] {
  return partes
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => {
      const m = p.match(NUMERAL)
      const numeral = m ? m[1].toUpperCase() : romano(i + 1)
      const texto = m ? p.slice(m[0].length).trim() : p
      return { ordem: i + 1, numeral, texto }
    })
    .filter((a) => a.texto.length > 0)
}

function romano(n: number): string {
  const tabela: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let resto = n
  let saida = ''
  for (const [valor, simbolo] of tabela) {
    while (resto >= valor) {
      saida += simbolo
      resto -= valor
    }
  }
  return saida
}

/**
 * Extrai assertivas de duas origens, na ordem de confianca:
 *   1. campo `assertivas` separado por '|' (formato preferido da v10);
 *   2. assertivas embutidas no proprio texto ('I. ... II. ... - comando').
 *
 * Devolve tambem o enunciado ja limpo, sem as assertivas dentro.
 */
export function extraiAssertivas(q: QuestaoLegado): {
  assertivas: AssertivaParseada[]
  enunciado: string
  parseFalhou: boolean
} {
  const textoOriginal = (q.texto ?? '').trim()

  // 1. Campo dedicado.
  if (q.assertivas && q.assertivas.trim()) {
    const partes = q.assertivas.split('|')
    const assertivas = montaAssertivas(partes)
    if (assertivas.length >= 2) {
      return { assertivas, enunciado: textoOriginal, parseFalhou: false }
    }
    // Campo preenchido mas ilegivel: sinaliza para revisao manual.
    return { assertivas: [], enunciado: textoOriginal, parseFalhou: true }
  }

  // 2. Embutidas no texto, com comando depois de travessao.
  // O separador exige espaco dos dois lados e o grupo e guloso de proposito:
  // sem isso, 'meia-vida' dentro de uma assertiva seria lido como o travessao
  // e cortaria a assertiva no meio.
  const comComando = textoOriginal.match(
    /^([IVX]+[.)][\s\S]+)\s+[\u2014\u2013-]{1,2}\s+(.+)$/s
  )
  if (comComando) {
    const assertivas = montaAssertivas(quebraPorNumeral(comComando[1]))
    if (assertivas.length >= 2) {
      return {
        assertivas,
        enunciado: comComando[2].trim(),
        parseFalhou: false,
      }
    }
  }

  // 3. Embutidas no texto, sem comando explicito.
  if (/^[IVX]+[.)]\s/.test(textoOriginal)) {
    const assertivas = montaAssertivas(quebraPorNumeral(textoOriginal))
    if (assertivas.length >= 2) {
      return {
        assertivas,
        enunciado: 'Analise as assertivas e marque a alternativa correta.',
        parseFalhou: false,
      }
    }
  }

  return { assertivas: [], enunciado: textoOriginal, parseFalhou: false }
}

function quebraPorNumeral(bloco: string): string[] {
  return bloco.split(/\s+(?=[IVX]+[.)]\s)/)
}

// ---------------------------------------------------------------------------
// Parse completo
// ---------------------------------------------------------------------------

export function parseQuestao(
  q: QuestaoLegado,
  materiaSlug: string | null
): ResultadoParse {
  const rejeita = (motivo: MotivoRejeicao, detalhe: string): ResultadoParse => ({
    ok: false,
    rejeitada: {
      origem_legado_id: q.id,
      materia_key: q.materia,
      motivo,
      detalhe,
    },
  })

  if (!materiaSlug) {
    return rejeita(
      'materia_desconhecida',
      `materia='${q.materia ?? ''}' nome='${q.materia_nome ?? ''}' sem mapeamento`
    )
  }

  // Gabarito: sem gabarito valido a questao nao entra, em nenhuma hipotese.
  const bruto = (q.gabarito ?? '').trim()
  if (!bruto) return rejeita('gabarito_ausente', 'campo gabarito vazio')

  const letraGabarito = bruto[0]?.toLowerCase() as LetraAlternativa
  if (!LETRAS.includes(letraGabarito)) {
    return rejeita('gabarito_invalido', `gabarito='${bruto}' fora de A-E`)
  }

  // Alternativas: colunas fixas viram linhas.
  const colunas: Array<[LetraAlternativa, string | null]> = [
    ['a', q.opcao_a],
    ['b', q.opcao_b],
    ['c', q.opcao_c],
    ['d', q.opcao_d],
    ['e', q.opcao_e],
  ]

  const alternativas: AlternativaParseada[] = colunas
    .filter(([, texto]) => (texto ?? '').trim().length > 0)
    .map(([letra, texto]) => ({
      letra,
      texto: (texto ?? '').trim(),
      correta: letra === letraGabarito,
    }))

  if (alternativas.length < 2) {
    return rejeita(
      'alternativas_insuficientes',
      `${alternativas.length} alternativa(s) preenchida(s)`
    )
  }

  if (!alternativas.some((a) => a.correta)) {
    return rejeita(
      'gabarito_sem_alternativa',
      `gabarito='${bruto}' aponta para coluna vazia`
    )
  }

  const { assertivas, enunciado, parseFalhou } = extraiAssertivas(q)

  if (enunciado.trim().length === 0) {
    return rejeita('enunciado_vazio', 'texto vazio apos extrair assertivas')
  }

  // Status de revisao. Fonte NAO conta: deixou de ser obrigatoria.
  const motivos: MotivoRevisao[] = []
  const comentario = (q.comentario ?? '').trim() || null
  if (!comentario) motivos.push('sem_comentario')
  if (alternativas.length < 5) motivos.push('menos_de_cinco_alternativas')
  if (parseFalhou) motivos.push('assertivas_nao_parseadas')
  if (enunciado.length < 20) motivos.push('enunciado_curto')
  if (!(q.tema ?? '').trim()) motivos.push('tema_ausente')

  return {
    ok: true,
    questao: {
      origem_legado_id: q.id,
      materia_slug: materiaSlug,
      tipo: assertivas.length >= 2 ? 'assertivas' : 'multipla_escolha',
      dificuldade: normalizaDificuldade(q.dificuldade),
      enunciado,
      comentario,
      alternativas,
      assertivas,
      tema_original: (q.tema ?? '').trim() || null,
      motivos_revisao: motivos,
    },
  }
}
