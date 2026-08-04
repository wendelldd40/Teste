/**
 * Repositorio de questoes.
 *
 * A coluna `alternativas.correta` NAO e legivel pelo cliente (migration
 * 0003). Nada aqui tenta ler o gabarito: quem corrige e o servidor, via
 * registrar_resposta. Por isso `AlternativaVisivel` nao tem o campo.
 */

import type {
  Alternativa,
  Assertiva,
  Dificuldade,
  Questao,
  StatusRevisao,
} from '@/types/database'
import { consulta, type ClienteSupabase, type Resultado } from './base'

/** Alternativa como o aluno pode ver: sem o gabarito. */
export type AlternativaVisivel = Omit<Alternativa, 'correta'>

/** Assertiva como o aluno pode ver: sem o julgamento. */
export type AssertivaVisivel = Omit<Assertiva, 'correta'>

export interface QuestaoCompleta extends Questao {
  alternativas: AlternativaVisivel[]
  assertivas: AssertivaVisivel[]
}

const CAMPOS_QUESTAO =
  'id, materia_id, tipo, dificuldade, enunciado, comentario, status, livro_id, capitulo_id, pagina, fonte_livre, origem_legado_id, criado_por, created_at, updated_at'

const CAMPOS_FILHOS =
  'alternativas(id, questao_id, letra, texto), assertivas(id, questao_id, ordem, numeral, texto)'

export interface FiltroQuestoes {
  materiaId?: string
  assuntoIds?: string[]
  dificuldade?: Dificuldade
  status?: StatusRevisao
  limite?: number
}

/** Ids de questoes publicadas que casam com o filtro. Barato: so o id. */
export async function idsPublicadas(
  filtro: FiltroQuestoes
): Promise<Resultado<string[]>> {
  const r = await consulta<Array<{ id: string }>>('questoes.idsPublicadas', (sb) => {
    let q = sb.from('questoes').select('id').eq('status', 'publicada')

    if (filtro.materiaId) q = q.eq('materia_id', filtro.materiaId)
    if (filtro.dificuldade) q = q.eq('dificuldade', filtro.dificuldade)
    if (filtro.limite) q = q.limit(filtro.limite)

    return q
  })

  if (!r.ok) return r
  if (!filtro.assuntoIds?.length) {
    return { ok: true, dados: r.dados.map((x) => x.id) }
  }

  // Filtro por assunto passa pela tabela de vinculo (N:N).
  const vinculos = await consulta<Array<{ questao_id: string }>>(
    'questoes.porAssunto',
    (sb) =>
      sb
        .from('questao_assuntos')
        .select('questao_id')
        .in('assunto_id', filtro.assuntoIds!)
  )
  if (!vinculos.ok) return vinculos

  const permitidas = new Set(vinculos.dados.map((v) => v.questao_id))
  return { ok: true, dados: r.dados.map((x) => x.id).filter((id) => permitidas.has(id)) }
}

/** Questoes completas por id, sem gabarito. Preserva a ordem pedida. */
export async function porIds(
  ids: readonly string[],
  cliente?: ClienteSupabase
): Promise<Resultado<QuestaoCompleta[]>> {
  if (ids.length === 0) return { ok: true, dados: [] }

  const r = await consulta<QuestaoCompleta[]>(
    'questoes.porIds',
    (sb) =>
      sb
        .from('questoes')
        .select(`${CAMPOS_QUESTAO}, ${CAMPOS_FILHOS}`)
        .in('id', ids as string[]),
    cliente
  )
  if (!r.ok) return r

  const posicao = new Map(ids.map((id, i) => [id, i]))
  const ordenadas = [...r.dados].sort(
    (a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0)
  )
  for (const q of ordenadas) {
    q.assertivas = [...(q.assertivas ?? [])].sort((a, b) => a.ordem - b.ordem)
  }
  return { ok: true, dados: ordenadas }
}

export async function porId(id: string): Promise<Resultado<QuestaoCompleta>> {
  const r = await porIds([id])
  if (!r.ok) return r
  const q = r.dados[0]
  if (!q) {
    return {
      ok: false,
      erro: new (await import('@/lib/errors')).AppError(
        'nao_encontrado',
        'Questao nao encontrada.'
      ),
    }
  }
  return { ok: true, dados: q }
}

/**
 * Fila de revisao do admin. O gabarito de cada questao vem depois, uma a
 * uma, pela RPC admin_questao_completa - nao ha leitura em massa de
 * gabarito nem para admin.
 */
export async function filaRevisao(limite = 50): Promise<Resultado<Questao[]>> {
  return consulta<Questao[]>('questoes.filaRevisao', (sb) =>
    sb
      .from('questoes')
      .select(CAMPOS_QUESTAO)
      .eq('status', 'precisa_revisao')
      .order('created_at')
      .limit(limite)
  )
}

export interface QuestaoAdmin {
  questao: Questao
  alternativas: Alternativa[]
  assertivas: Assertiva[]
}

/** So admin. A funcao valida o papel no servidor. */
export async function paraRevisao(questaoId: string): Promise<Resultado<QuestaoAdmin>> {
  return consulta<QuestaoAdmin>('questoes.paraRevisao', (sb) =>
    sb.rpc('admin_questao_completa', { p_questao: questaoId })
  )
}
