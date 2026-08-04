/**
 * Repositorio de materias.
 *
 * Nao existe lista de materias no codigo. Elas vem do banco, com periodo,
 * imagem e carga horaria. Foi o hardcode de MATERIAS em JS que a v11 veio
 * consertar.
 */

import type { Materia, Periodo } from '@/types/database'
import {
  chaves,
  consulta,
  consultaComCache,
  invalidar,
  TTL_PADRAO,
  type ClienteSupabase,
  type Resultado,
} from './base'

export interface MateriaComPeriodo extends Materia {
  periodo: Pick<Periodo, 'numero' | 'nome'> | null
  /** Preenchido por listarComAcesso. */
  liberada?: boolean
}

const COLUNAS =
  'id, periodo_id, codigo, nome, slug, descricao, creditos, ch_total, ch_teorica, ch_pratica, ch_afec, imagem_url, imagem_alt, ativa, ordem, created_at, updated_at'

/** Materias ativas, agrupaveis por periodo (a trilha da tela Estudar). */
export async function listar(
  cliente?: ClienteSupabase
): Promise<Resultado<MateriaComPeriodo[]>> {
  return consultaComCache<MateriaComPeriodo[]>(
    'materias.listar',
    chaves.materias(),
    (sb) =>
      sb
        .from('materias')
        .select(`${COLUNAS}, periodo:periodos(numero, nome)`)
        .eq('ativa', true)
        .order('ordem'),
    TTL_PADRAO,
    cliente
  )
}

export async function porSlug(
  slug: string,
  cliente?: ClienteSupabase
): Promise<Resultado<MateriaComPeriodo>> {
  return consultaComCache<MateriaComPeriodo>(
    'materias.porSlug',
    chaves.materia(slug),
    (sb) =>
      sb
        .from('materias')
        .select(`${COLUNAS}, periodo:periodos(numero, nome)`)
        .eq('slug', slug)
        .single(),
    TTL_PADRAO,
    cliente
  )
}

/**
 * O aluno VE todas as materias ativas, mas so ACESSA as que assinou.
 * A flag `liberada` existe para a tela mostrar o cadeado sem uma segunda ida
 * ao banco - e nao substitui a RLS, que barra a leitura das questoes de
 * qualquer jeito.
 */
export async function listarComAcesso(
  cliente?: ClienteSupabase
): Promise<Resultado<MateriaComPeriodo[]>> {
  const materias = await listar(cliente)
  if (!materias.ok) return materias

  const acessos = await consultaComCache<Array<{ materia_id: string }>>(
    'materias.acessos',
    chaves.acessos(),
    (sb) =>
      sb
        .from('acessos_materia')
        .select('materia_id')
        .eq('ativo', true),
    TTL_PADRAO,
    cliente
  )
  if (!acessos.ok) return acessos

  const liberadas = new Set(acessos.dados.map((a) => a.materia_id))
  return {
    ok: true,
    dados: materias.dados.map((m) => ({ ...m, liberada: liberadas.has(m.id) })),
  }
}

/** Quantas questoes publicadas cada materia tem. Alimenta o card. */
export async function contarQuestoes(
  materiaId: string
): Promise<Resultado<number>> {
  const r = await consultaComCache<{ count: number }>(
    'materias.contarQuestoes',
    chaves.contagemQuestoes(materiaId),
    (sb) =>
      sb
        .from('questoes')
        .select('id', { count: 'exact', head: true })
        .eq('materia_id', materiaId)
        .eq('status', 'publicada')
        .then((r) => ({ data: { count: r.count ?? 0 }, error: r.error }))
  )
  return r.ok ? { ok: true, dados: r.dados.count } : r
}

/** Chamar depois de qualquer escrita no admin. */
export function invalidarMaterias(): void {
  invalidar(chaves.materias())
  invalidar('materia:')
  invalidar(chaves.prefixoContagem)
}

/** Uso do admin. A RLS ja barra quem nao e admin. */
export async function atualizar(
  id: string,
  campos: Partial<Pick<Materia, 'nome' | 'descricao' | 'imagem_url' | 'imagem_alt' | 'ativa' | 'ordem'>>
): Promise<Resultado<null>> {
  const r = await consulta<null>('materias.atualizar', (sb) =>
    sb.from('materias').update(campos).eq('id', id)
  )
  if (r.ok) invalidarMaterias()
  return r
}
