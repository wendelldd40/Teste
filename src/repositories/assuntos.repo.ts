/**
 * Repositorio de assuntos.
 *
 * `assuntos` substitui o campo `tema` (string livre) da v10. A hierarquia
 * (modulo -> assunto -> subassunto) usa parent_id; a arvore e montada aqui,
 * nao na tela.
 */

import type { Assunto } from '@/types/database'
import {
  chaves,
  consulta,
  consultaComCache,
  invalidar,
  TTL_PADRAO,
  type ClienteSupabase,
  type Resultado,
} from './base'

export interface AssuntoNo extends Assunto {
  filhos: AssuntoNo[]
}

export async function listarPorMateria(
  materiaId: string,
  cliente?: ClienteSupabase
): Promise<Resultado<Assunto[]>> {
  return consultaComCache<Assunto[]>(
    'assuntos.listarPorMateria',
    chaves.assuntos(materiaId),
    (sb) =>
      sb
        .from('assuntos')
        .select('*')
        .eq('materia_id', materiaId)
        .order('ordem'),
    TTL_PADRAO,
    cliente
  )
}

/** Todos os assuntos, de todas as materias. Uso do admin. */
export async function todosAssuntos(
  cliente?: ClienteSupabase
): Promise<Resultado<Assunto[]>> {
  return consulta<Assunto[]>(
    'assuntos.todos',
    (sb) => sb.from('assuntos').select('*').order('ordem'),
    cliente
  )
}

/** Monta a arvore a partir da lista plana. Ordem preservada em cada nivel. */
export function montarArvore(lista: readonly Assunto[]): AssuntoNo[] {
  const nos = new Map<string, AssuntoNo>()
  for (const a of lista) nos.set(a.id, { ...a, filhos: [] })

  const raizes: AssuntoNo[] = []
  for (const a of lista) {
    const no = nos.get(a.id)!
    if (a.parent_id && nos.has(a.parent_id)) {
      nos.get(a.parent_id)!.filhos.push(no)
    } else {
      raizes.push(no)
    }
  }
  return raizes
}

export async function arvorePorMateria(
  materiaId: string,
  cliente?: ClienteSupabase
): Promise<Resultado<AssuntoNo[]>> {
  const r = await listarPorMateria(materiaId, cliente)
  return r.ok ? { ok: true, dados: montarArvore(r.dados) } : r
}

/** Todos os ids do assunto e seus descendentes - usado para filtrar simulado. */
export function idsComDescendentes(
  lista: readonly Assunto[],
  raizId: string
): string[] {
  const filhosDe = new Map<string, string[]>()
  for (const a of lista) {
    if (!a.parent_id) continue
    if (!filhosDe.has(a.parent_id)) filhosDe.set(a.parent_id, [])
    filhosDe.get(a.parent_id)!.push(a.id)
  }

  const saida: string[] = []
  const pilha = [raizId]
  const visto = new Set<string>()

  while (pilha.length) {
    const id = pilha.pop()!
    if (visto.has(id)) continue
    visto.add(id)
    saida.push(id)
    for (const f of filhosDe.get(id) ?? []) pilha.push(f)
  }
  return saida
}

export function invalidarAssuntos(materiaId?: string): void {
  invalidar(materiaId ? chaves.assuntos(materiaId) : chaves.prefixoAssuntos)
}

/** Uso do admin. */
export async function criar(
  dados: Pick<Assunto, 'materia_id' | 'nome' | 'slug'> &
    Partial<Pick<Assunto, 'parent_id' | 'descricao' | 'ordem'>>
): Promise<Resultado<Assunto>> {
  const r = await consulta<Assunto>('assuntos.criar', (sb) =>
    sb.from('assuntos').insert(dados).select().single()
  )
  if (r.ok) invalidarAssuntos(dados.materia_id)
  return r
}
