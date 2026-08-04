/**
 * Repositorio de simulados.
 *
 * Ponto central: o embaralhamento das alternativas e GRAVADO em
 * sessao_questoes.ordem_alternativas. Isso resolve duas coisas de uma vez:
 *   - retomar a sessao mostra exatamente a mesma ordem de antes;
 *   - o gabarito nunca depende de posicao. Ele e o UUID da alternativa
 *     correta, guardado no servidor. Na v10 o gabarito era indice
 *     (`correct: 0`) e embaralhar trocava a resposta certa de lugar.
 */

import type {
  EscopoSimulado,
  Dificuldade,
  SessaoSimulado,
} from '@/types/database'
import { AppError } from '@/lib/errors'
import {
  amostrar,
  consulta,
  embaralhar,
  type ClienteSupabase,
  type Resultado,
} from './base'
import { idsPublicadas, porIds, type QuestaoCompleta } from './questoes.repo'

export interface OpcoesSimulado {
  escopo: EscopoSimulado
  materiaId?: string
  /** Ja deve vir com os descendentes, via assuntos.idsComDescendentes. */
  assuntoIds?: string[]
  quantidade: number
  dificuldade?: Dificuldade
}

export interface QuestaoNaSessao {
  ordem: number
  questao: QuestaoCompleta
  /** Ordem embaralhada e persistida das alternativas. */
  alternativasOrdenadas: QuestaoCompleta['alternativas']
  /** Resposta ja dada, quando a sessao foi retomada. */
  respondida: { alternativa_id: string | null } | null
}

export interface SessaoCarregada {
  sessao: SessaoSimulado
  questoes: QuestaoNaSessao[]
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

export async function montar(
  usuarioId: string,
  opcoes: OpcoesSimulado
): Promise<Resultado<SessaoCarregada>> {
  if (opcoes.quantidade < 1) {
    return { ok: false, erro: new AppError('dado_invalido', 'Escolha ao menos uma questao.') }
  }
  if (opcoes.escopo === 'materia' && !opcoes.materiaId) {
    return { ok: false, erro: new AppError('dado_invalido', 'Selecione a materia.') }
  }
  if (opcoes.escopo === 'assunto' && !opcoes.assuntoIds?.length) {
    return { ok: false, erro: new AppError('dado_invalido', 'Selecione o assunto.') }
  }

  // 1. Universo de questoes. A RLS ja exclui materia sem acesso.
  const ids = await idsPublicadas({
    materiaId: opcoes.materiaId,
    assuntoIds: opcoes.assuntoIds,
    dificuldade: opcoes.dificuldade,
  })
  if (!ids.ok) return ids

  if (ids.dados.length === 0) {
    return {
      ok: false,
      erro: new AppError(
        'nao_encontrado',
        'Nao ha questoes disponiveis para essa selecao.'
      ),
    }
  }

  const sorteadas = amostrar(ids.dados, opcoes.quantidade)

  // 2. Sessao.
  const sessao = await consulta<SessaoSimulado>('simulados.criarSessao', (sb) =>
    sb
      .from('sessoes_simulado')
      .insert({
        usuario_id: usuarioId,
        escopo: opcoes.escopo,
        materia_id: opcoes.materiaId ?? null,
        assunto_id: opcoes.assuntoIds?.[0] ?? null,
        total_questoes: sorteadas.length,
      })
      .select()
      .single()
  )
  if (!sessao.ok) return sessao

  // 3. Questoes e embaralhamento persistido.
  const questoes = await porIds(sorteadas)
  if (!questoes.ok) return questoes

  const linhas = questoes.dados.map((q, i) => ({
    sessao_id: sessao.dados.id,
    questao_id: q.id,
    ordem: i + 1,
    ordem_alternativas: embaralhar(q.alternativas.map((a) => a.id)),
  }))

  const gravou = await consulta<null>('simulados.gravarQuestoes', (sb) =>
    sb.from('sessao_questoes').insert(linhas)
  )
  if (!gravou.ok) return gravou

  return {
    ok: true,
    dados: {
      sessao: sessao.dados,
      questoes: questoes.dados.map((q, i) => ({
        ordem: i + 1,
        questao: q,
        alternativasOrdenadas: aplicarOrdem(q, linhas[i].ordem_alternativas),
        respondida: null,
      })),
    },
  }
}

/** Reordena as alternativas conforme a ordem gravada. Ids desconhecidos caem fora. */
function aplicarOrdem(
  questao: QuestaoCompleta,
  ordem: readonly string[]
): QuestaoCompleta['alternativas'] {
  const porId = new Map(questao.alternativas.map((a) => [a.id, a]))
  const ordenadas = ordem.map((id) => porId.get(id)).filter((a) => a !== undefined)
  // Alternativa criada depois da sessao entra no fim, em vez de sumir.
  const usadas = new Set(ordem)
  const extras = questao.alternativas.filter((a) => !usadas.has(a.id))
  return [...ordenadas, ...extras]
}

// ---------------------------------------------------------------------------
// Retomada
// ---------------------------------------------------------------------------

/** Sessao aberta do usuario, se houver. Alimenta o "continuar de onde parou". */
export async function sessaoAberta(
  cliente?: ClienteSupabase
): Promise<Resultado<SessaoSimulado | null>> {
  const r = await consulta<SessaoSimulado[]>(
    'simulados.sessaoAberta',
    (sb) =>
      sb
        .from('sessoes_simulado')
        .select('*')
        .eq('status', 'em_andamento')
        .order('iniciada_em', { ascending: false })
        .limit(1),
    cliente
  )
  return r.ok ? { ok: true, dados: r.dados[0] ?? null } : r
}

export async function carregar(
  sessaoId: string,
  cliente?: ClienteSupabase
): Promise<Resultado<SessaoCarregada>> {
  const sessao = await consulta<SessaoSimulado>(
    'simulados.carregarSessao',
    (sb) => sb.from('sessoes_simulado').select('*').eq('id', sessaoId).single(),
    cliente
  )
  if (!sessao.ok) return sessao

  const itens = await consulta<
    Array<{ questao_id: string; ordem: number; ordem_alternativas: string[] }>
  >(
    'simulados.carregarItens',
    (sb) =>
      sb
        .from('sessao_questoes')
        .select('questao_id, ordem, ordem_alternativas')
        .eq('sessao_id', sessaoId)
        .order('ordem'),
    cliente
  )
  if (!itens.ok) return itens

  const questoes = await porIds(
    itens.dados.map((i) => i.questao_id),
    cliente
  )
  if (!questoes.ok) return questoes

  const respostas = await consulta<Array<{ questao_id: string; alternativa_id: string | null }>>(
    'simulados.respostasDaSessao',
    (sb) =>
      sb
        .from('respostas')
        .select('questao_id, alternativa_id')
        .eq('sessao_id', sessaoId),
    cliente
  )
  if (!respostas.ok) return respostas

  const porQuestao = new Map(questoes.dados.map((q) => [q.id, q]))
  const respondidaPor = new Map(respostas.dados.map((r) => [r.questao_id, r]))

  const montadas: QuestaoNaSessao[] = itens.dados.flatMap((item) => {
    const q = porQuestao.get(item.questao_id)
    if (!q) return []
    return [
      {
        ordem: item.ordem,
        questao: q,
        alternativasOrdenadas: aplicarOrdem(q, item.ordem_alternativas),
        respondida: respondidaPor.get(item.questao_id) ?? null,
      },
    ]
  })

  return { ok: true, dados: { sessao: sessao.dados, questoes: montadas } }
}

// ---------------------------------------------------------------------------
// Resposta e encerramento
// ---------------------------------------------------------------------------

export interface RetornoResposta {
  acertou: boolean
  alternativa_correta_id: string
  comentario: string | null
  ja_respondida: boolean
}

/**
 * Envia a resposta. A correcao acontece no servidor: o gabarito so vem no
 * retorno, depois de gravado. Reenviar a mesma questao nao conta de novo.
 */
export async function responder(
  sessaoId: string,
  questaoId: string,
  alternativaId: string | null,
  tempoSegundos = 0
): Promise<Resultado<RetornoResposta>> {
  return consulta<RetornoResposta>('simulados.responder', (sb) =>
    sb.rpc('registrar_resposta', {
      p_sessao: sessaoId,
      p_questao: questaoId,
      p_alternativa: alternativaId,
      p_tempo_segundos: tempoSegundos,
    })
  )
}

/** Ponteiro de navegacao. Placar nao passa por aqui: o servidor cuida dele. */
export async function marcarPosicao(
  sessaoId: string,
  indice: number
): Promise<Resultado<null>> {
  return consulta<null>('simulados.marcarPosicao', (sb) =>
    sb
      .from('sessoes_simulado')
      .update({ indice_atual: indice, atualizada_em: new Date().toISOString() })
      .eq('id', sessaoId)
  )
}

export interface Placar {
  total: number
  respondidas: number
  acertos: number
}

export async function finalizar(sessaoId: string): Promise<Resultado<Placar>> {
  return consulta<Placar>('simulados.finalizar', (sb) =>
    sb.rpc('finalizar_sessao', { p_sessao: sessaoId })
  )
}

export interface LinhaResultado {
  questao_id: string
  enunciado: string
  comentario: string | null
  alternativa_marcada: string | null
  alternativa_correta: string
  acertou: boolean
  ordem: number
}

/** Gabarito completo. So responde com a sessao encerrada. */
export async function resultado(
  sessaoId: string,
  cliente?: ClienteSupabase
): Promise<Resultado<LinhaResultado[]>> {
  return consulta<LinhaResultado[]>(
    'simulados.resultado',
    (sb) => sb.rpc('resultado_sessao', { p_sessao: sessaoId }),
    cliente
  )
}
