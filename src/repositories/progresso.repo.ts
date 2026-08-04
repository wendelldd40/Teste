/**
 * Repositorio de progresso.
 *
 * Streak e duplo, como decidido no brief: dias seguidos batendo o minimo
 * diario E a meta semanal de questoes. Quem marca o dia como valido e o
 * trigger no banco (`atividade_diaria.conta_streak`); aqui so lemos e
 * contamos a sequencia.
 */

import type { AtividadeDiaria, MetaUsuario } from '@/types/database'
import {
  chaves,
  consulta,
  consultaComCache,
  invalidar,
  TTL_CURTO,
  TTL_PADRAO,
  type ClienteSupabase,
  type Resultado,
} from './base'

// ---------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------

export async function metas(cliente?: ClienteSupabase): Promise<Resultado<MetaUsuario>> {
  return consultaComCache<MetaUsuario>(
    'progresso.metas',
    chaves.metas(),
    (sb) => sb.from('metas_usuario').select('*').single(),
    TTL_PADRAO,
    cliente
  )
}

export async function definirMetaSemanal(
  usuarioId: string,
  questoes: number
): Promise<Resultado<null>> {
  const r = await consulta<null>('progresso.definirMetaSemanal', (sb) =>
    sb
      .from('metas_usuario')
      .update({ meta_semanal_questoes: questoes })
      .eq('usuario_id', usuarioId)
  )
  if (r.ok) invalidar(chaves.metas())
  return r
}

// ---------------------------------------------------------------------------
// Atividade e streak
// ---------------------------------------------------------------------------

export async function atividade(
  dias = 120,
  cliente?: ClienteSupabase
): Promise<Resultado<AtividadeDiaria[]>> {
  const desde = new Date()
  desde.setDate(desde.getDate() - dias)
  const iso = desde.toISOString().slice(0, 10)

  return consultaComCache<AtividadeDiaria[]>(
    'progresso.atividade',
    `atividade:${dias}`,
    (sb) =>
      sb
        .from('atividade_diaria')
        .select('*')
        .gte('dia', iso)
        .order('dia', { ascending: false }),
    TTL_CURTO,
    cliente
  )
}

export interface ResumoStreak {
  /** Dias seguidos ate hoje (ou ate ontem, se hoje ainda nao bateu). */
  diasSeguidos: number
  /** Maior sequencia ja alcancada na janela lida. */
  recorde: number
  /** Hoje ja conta? */
  hojeContou: boolean
  questoesNaSemana: number
  metaSemanal: number
  /** 0 a 1, limitado em 1. Alimenta o anel do dashboard. */
  progressoSemanal: number
  metaSemanalCumprida: boolean
}

const DIA_MS = 24 * 60 * 60 * 1000

function paraData(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime()
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Conta a sequencia. Regra: o streak nao quebra por hoje ainda nao ter
 * comecado - so quebra quando ONTEM tambem nao contou. Sem isso, o numero
 * apareceria zerado toda manha.
 */
export function calculaStreak(
  atividades: readonly AtividadeDiaria[],
  hoje = hojeISO()
): { diasSeguidos: number; recorde: number; hojeContou: boolean } {
  const validos = atividades
    .filter((a) => a.conta_streak)
    .map((a) => a.dia)
    .sort()
    .reverse()

  const conjunto = new Set(validos)
  const hojeContou = conjunto.has(hoje)

  let cursor = paraData(hoje)
  if (!hojeContou) cursor -= DIA_MS // tolera o dia corrente ainda em aberto

  let diasSeguidos = 0
  while (conjunto.has(new Date(cursor).toISOString().slice(0, 10))) {
    diasSeguidos++
    cursor -= DIA_MS
  }

  let recorde = 0
  let atual = 0
  let anterior: number | null = null
  for (const dia of [...validos].reverse()) {
    const t = paraData(dia)
    atual = anterior !== null && t - anterior === DIA_MS ? atual + 1 : 1
    recorde = Math.max(recorde, atual)
    anterior = t
  }

  return { diasSeguidos, recorde: Math.max(recorde, diasSeguidos), hojeContou }
}

/** Segunda-feira como inicio da semana. */
export function inicioDaSemana(hoje = new Date()): string {
  const d = new Date(hoje)
  const diaSemana = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diaSemana)
  return d.toISOString().slice(0, 10)
}

export async function resumoStreak(
  cliente?: ClienteSupabase
): Promise<Resultado<ResumoStreak>> {
  const [ativ, met] = await Promise.all([atividade(120, cliente), metas(cliente)])
  if (!ativ.ok) return ativ
  if (!met.ok) return met

  const { diasSeguidos, recorde, hojeContou } = calculaStreak(ativ.dados)

  const inicio = inicioDaSemana()
  const questoesNaSemana = ativ.dados
    .filter((a) => a.dia >= inicio)
    .reduce((soma, a) => soma + a.questoes_respondidas, 0)

  const metaSemanal = met.dados.meta_semanal_questoes

  return {
    ok: true,
    dados: {
      diasSeguidos,
      recorde,
      hojeContou,
      questoesNaSemana,
      metaSemanal,
      progressoSemanal: metaSemanal > 0 ? Math.min(questoesNaSemana / metaSemanal, 1) : 0,
      metaSemanalCumprida: questoesNaSemana >= metaSemanal,
    },
  }
}

// ---------------------------------------------------------------------------
// Analise de erros
// ---------------------------------------------------------------------------

export interface DesempenhoPorMateria {
  materia_id: string
  nome: string
  respondidas: number
  acertos: number
  taxa: number
}

/**
 * Desempenho por materia. Agrega no cliente de proposito: sao as respostas
 * de UMA pessoa, entao o volume e pequeno e evita uma view a mais no banco.
 * Se um dia passar de alguns milhares, isso vira uma view materializada.
 */
export async function desempenhoPorMateria(
  cliente?: ClienteSupabase
): Promise<Resultado<DesempenhoPorMateria[]>> {
  const r = await consulta<
    Array<{ correta: boolean; questoes: { materia_id: string; materias: { nome: string } } }>
  >(
    'progresso.desempenhoPorMateria',
    (sb) =>
      sb
        .from('respostas')
        .select('correta, questoes!inner(materia_id, materias!inner(nome))'),
    cliente
  )
  if (!r.ok) return r

  const mapa = new Map<string, DesempenhoPorMateria>()
  for (const linha of r.dados) {
    const id = linha.questoes.materia_id
    if (!mapa.has(id)) {
      mapa.set(id, {
        materia_id: id,
        nome: linha.questoes.materias.nome,
        respondidas: 0,
        acertos: 0,
        taxa: 0,
      })
    }
    const d = mapa.get(id)!
    d.respondidas++
    if (linha.correta) d.acertos++
  }

  const saida = [...mapa.values()].map((d) => ({
    ...d,
    taxa: d.respondidas ? d.acertos / d.respondidas : 0,
  }))
  saida.sort((a, b) => a.taxa - b.taxa) // pior primeiro: e o que a tela mostra

  return { ok: true, dados: saida }
}

export interface DesempenhoPorAssunto {
  assunto_id: string
  nome: string
  materia_id: string
  respondidas: number
  acertos: number
  taxa: number
}

export async function desempenhoPorAssunto(
  materiaId?: string,
  cliente?: ClienteSupabase
): Promise<Resultado<DesempenhoPorAssunto[]>> {
  const r = await consulta<
    Array<{
      correta: boolean
      questoes: {
        materia_id: string
        questao_assuntos: Array<{ assuntos: { id: string; nome: string } }>
      }
    }>
  >('progresso.desempenhoPorAssunto', (sb) => {
    let q = sb
      .from('respostas')
      .select(
        'correta, questoes!inner(materia_id, questao_assuntos(assuntos(id, nome)))'
      )
    if (materiaId) q = q.eq('questoes.materia_id', materiaId)
    return q
  }, cliente)
  if (!r.ok) return r

  const mapa = new Map<string, DesempenhoPorAssunto>()
  for (const linha of r.dados) {
    for (const vinculo of linha.questoes.questao_assuntos ?? []) {
      const a = vinculo.assuntos
      if (!a) continue
      if (!mapa.has(a.id)) {
        mapa.set(a.id, {
          assunto_id: a.id,
          nome: a.nome,
          materia_id: linha.questoes.materia_id,
          respondidas: 0,
          acertos: 0,
          taxa: 0,
        })
      }
      const d = mapa.get(a.id)!
      d.respondidas++
      if (linha.correta) d.acertos++
    }
  }

  const saida = [...mapa.values()].map((d) => ({
    ...d,
    taxa: d.respondidas ? d.acertos / d.respondidas : 0,
  }))
  saida.sort((a, b) => a.taxa - b.taxa)
  return { ok: true, dados: saida }
}

/**
 * O assunto mais fraco, para a tela de Analise de Erros apontar um alvo.
 * Exige um minimo de respostas: 1 erro em 1 questao nao e tendencia.
 */
export function assuntoMaisFraco(
  desempenho: readonly DesempenhoPorAssunto[],
  minimoRespostas = 5
): DesempenhoPorAssunto | null {
  const candidatos = desempenho.filter((d) => d.respondidas >= minimoRespostas)
  return candidatos.length ? candidatos[0] : null
}

export function invalidarProgresso(): void {
  invalidar('atividade:')
  invalidar(chaves.metas())
}

// ---------------------------------------------------------------------------
// Evolucao, constancia e conquistas
// ---------------------------------------------------------------------------

export interface PontoEvolucaoSemanal {
  semana: string
  respondidas: number
  acertos: number
  taxa: number
}

export async function evolucaoSemanal(
  semanas = 12,
  cliente?: ClienteSupabase
): Promise<Resultado<PontoEvolucaoSemanal[]>> {
  return consulta<PontoEvolucaoSemanal[]>(
    'progresso.evolucaoSemanal',
    (sb) => sb.rpc('evolucao_semanal', { p_semanas: semanas }),
    cliente
  )
}

export interface ConstanteDaSemana {
  usuario_id: string
  nome: string
  dias_validos: number
  questoes: number
  sou_eu: boolean
}

/**
 * Bloco que substitui o ranking. Devolve SO quem ligou o opt-in de destaques
 * (migration 0005). Lista vazia e o estado normal enquanto ninguem optou -
 * nao e erro.
 */
export async function maisConstantesDaSemana(
  limite = 5,
  cliente?: ClienteSupabase
): Promise<Resultado<ConstanteDaSemana[]>> {
  return consulta<ConstanteDaSemana[]>(
    'progresso.maisConstantesDaSemana',
    (sb) => sb.rpc('mais_constantes_semana', { p_limite: limite }),
    cliente
  )
}

export async function definirDestaques(
  usuarioId: string,
  mostrar: boolean
): Promise<Resultado<null>> {
  return consulta<null>('progresso.definirDestaques', (sb) =>
    sb.from('usuarios').update({ mostrar_em_destaques: mostrar }).eq('id', usuarioId)
  )
}

export interface ProgressoConquistas {
  questoes_respondidas: number
  simulados_concluidos: number
  streak_dias: number
}

export async function progressoConquistas(
  cliente?: ClienteSupabase
): Promise<Resultado<ProgressoConquistas>> {
  return consulta<ProgressoConquistas>(
    'progresso.progressoConquistas',
    (sb) => sb.rpc('progresso_conquistas'),
    cliente
  )
}

/** Avalia e concede no servidor. Chamada ao terminar um simulado. */
export async function avaliarConquistas(
  cliente?: ClienteSupabase
): Promise<Resultado<{ novas: Array<{ codigo: string; nome: string }> }>> {
  return consulta<{ novas: Array<{ codigo: string; nome: string }> }>(
    'progresso.avaliarConquistas',
    (sb) => sb.rpc('avaliar_conquistas'),
    cliente
  )
}
