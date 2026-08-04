/**
 * Repositorio do admin.
 *
 * Mesmo contrato do resto: Resultado<T>, nenhuma excecao solta. A checagem de
 * papel acontece no servidor (guards + RLS + as proprias RPCs); nada aqui
 * confia em estado de interface.
 */

import type {
  Alternativa,
  Assertiva,
  Assunto,
  Dificuldade,
  Materia,
  Questao,
  StatusRevisao,
  TipoQuestao,
} from '@/types/database'
import { consulta, invalidar, chaves, type ClienteSupabase, type Resultado } from './base'

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

export interface ResumoAdmin {
  materias_ativas: number
  materias_total: number
  materias_sem_imagem: number
  questoes_publicadas: number
  questoes_revisao: number
  questoes_rascunho: number
  assuntos: number
  alunos: number
}

export async function resumo(cliente?: ClienteSupabase): Promise<Resultado<ResumoAdmin>> {
  return consulta<ResumoAdmin>('admin.resumo', (sb) => sb.rpc('admin_resumo'), cliente)
}

// ---------------------------------------------------------------------------
// Materias
// ---------------------------------------------------------------------------

/** Admin ve tudo, inclusive materia desligada. */
export async function listarMaterias(
  cliente?: ClienteSupabase
): Promise<Resultado<Materia[]>> {
  return consulta<Materia[]>(
    'admin.listarMaterias',
    (sb) => sb.from('materias').select('*').order('ordem'),
    cliente
  )
}

export type CamposMateria = Partial<
  Pick<
    Materia,
    | 'nome'
    | 'descricao'
    | 'imagem_url'
    | 'imagem_alt'
    | 'ativa'
    | 'ordem'
    | 'creditos'
    | 'ch_total'
  >
>

export async function salvarMateria(
  id: string,
  campos: CamposMateria
): Promise<Resultado<Materia>> {
  const r = await consulta<Materia>('admin.salvarMateria', (sb) =>
    sb.from('materias').update(campos).eq('id', id).select().single()
  )
  if (r.ok) {
    invalidar(chaves.materias())
    invalidar('materia:')
  }
  return r
}

// ---------------------------------------------------------------------------
// Assuntos
// ---------------------------------------------------------------------------

export async function salvarAssunto(
  dados: Pick<Assunto, 'materia_id' | 'nome' | 'slug'> &
    Partial<Pick<Assunto, 'id' | 'parent_id' | 'descricao' | 'ordem'>>
): Promise<Resultado<Assunto>> {
  // `id` nao vai no corpo do update: identifica a linha, nao e campo editavel.
  const { id, ...campos } = dados

  const r = await consulta<Assunto>('admin.salvarAssunto', (sb) =>
    id
      ? sb.from('assuntos').update(campos).eq('id', id).select().single()
      : sb.from('assuntos').insert(campos).select().single()
  )
  if (r.ok) invalidar(chaves.assuntos(dados.materia_id))
  return r
}

export async function removerAssunto(
  id: string,
  materiaId: string
): Promise<Resultado<null>> {
  const r = await consulta<null>('admin.removerAssunto', (sb) =>
    sb.from('assuntos').delete().eq('id', id)
  )
  if (r.ok) invalidar(chaves.assuntos(materiaId))
  return r
}

// ---------------------------------------------------------------------------
// Questoes
// ---------------------------------------------------------------------------

export interface ItemFilaRevisao extends Questao {
  materias: { nome: string; slug: string } | null
}

export async function filaRevisao(
  materiaId?: string,
  limite = 100,
  cliente?: ClienteSupabase
): Promise<Resultado<ItemFilaRevisao[]>> {
  return consulta<ItemFilaRevisao[]>(
    'admin.filaRevisao',
    (sb) => {
      let q = sb
        .from('questoes')
        .select('*, materias(nome, slug)')
        .eq('status', 'precisa_revisao')
        .order('created_at')
        .limit(limite)
      if (materiaId) q = q.eq('materia_id', materiaId)
      return q
    },
    cliente
  )
}

export interface QuestaoParaEdicao {
  questao: Questao
  alternativas: Alternativa[]
  assertivas: Assertiva[]
}

/** Unico caminho que expoe gabarito, e so para admin (validado no servidor). */
export async function carregarQuestao(
  id: string,
  cliente?: ClienteSupabase
): Promise<Resultado<QuestaoParaEdicao>> {
  return consulta<QuestaoParaEdicao>(
    'admin.carregarQuestao',
    (sb) => sb.rpc('admin_questao_completa', { p_questao: id }),
    cliente
  )
}

export interface QuestaoEditavel {
  id?: string
  materia_id: string
  tipo: TipoQuestao
  dificuldade: Dificuldade
  enunciado: string
  comentario: string | null
  status: StatusRevisao
  pagina?: string | null
  fonte_livre?: string | null
  alternativas: Array<{ letra: string; texto: string; correta: boolean }>
  assertivas: Array<{ ordem: number; numeral: string; texto: string; correta: boolean | null }>
  assunto_ids: string[]
}

/** Salva tudo numa transacao. Questao pela metade nao existe. */
export async function salvarQuestao(dados: QuestaoEditavel): Promise<Resultado<string>> {
  return consulta<string>('admin.salvarQuestao', (sb) =>
    sb.rpc('admin_salvar_questao', { p_dados: dados as never })
  )
}

/**
 * Publicar pode falhar: o trigger do banco recusa questao sem 5 alternativas
 * ou sem gabarito unico. O erro precisa chegar na tela, nao ser engolido.
 */
export async function publicarQuestao(
  id: string
): Promise<Resultado<{ id: string; status: StatusRevisao }>> {
  return consulta<{ id: string; status: StatusRevisao }>('admin.publicarQuestao', (sb) =>
    sb.rpc('admin_publicar_questao', { p_questao: id })
  )
}

// ---------------------------------------------------------------------------
// Acesso as materias (matricula manual enquanto nao ha pagamento automatico)
// ---------------------------------------------------------------------------

export async function liberarAcesso(
  usuarioId: string,
  materiaId: string,
  origem: 'compra' | 'cortesia' | 'bolsa' | 'turma' = 'cortesia'
): Promise<Resultado<null>> {
  const r = await consulta<null>('admin.liberarAcesso', (sb) =>
    sb
      .from('acessos_materia')
      .upsert(
        { usuario_id: usuarioId, materia_id: materiaId, origem, ativo: true },
        { onConflict: 'usuario_id,materia_id' }
      )
  )
  if (r.ok) invalidar(chaves.acessos())
  return r
}
