/**
 * EstudeVet v11 - Base da camada de repositorios.
 *
 * Contrato desta camada, sem excecao:
 *   - toda funcao devolve Resultado<T>, nunca lanca;
 *   - nenhum arquivo fora de src/repositories importa o client do Supabase;
 *   - cache e explicito: quem escreve invalida o que mudou.
 *
 * O cache da v10 era um objeto global que so sabia se estava carregado ou
 * nao. Aqui cada entrada tem chave, TTL e prefixo, entao dar para invalidar
 * so as questoes de uma materia sem derrubar o resto.
 */

import { tentar } from '@/lib/errors'
import type { Resultado } from '@/lib/errors'
import { getBrowserClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type { Resultado }

/**
 * Client injetado. Server Component passa o dele; no navegador fica de fora e
 * usamos o client do browser.
 */
export type ClienteSupabase = SupabaseClient<Database>

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface Entrada<T> {
  valor: T
  expiraEm: number
}

/**
 * ATENCAO: este Map vive no modulo. No navegador isso e por aba; no servidor
 * Node o modulo e compartilhado entre requisicoes de pessoas diferentes.
 * Por isso o cache SO e usado quando nao ha client injetado - ou seja, so no
 * browser. Cachear no servidor vazaria o progresso de um aluno para outro.
 */
const cache = new Map<string, Entrada<unknown>>()

/** 5 minutos. Catalogo muda pouco; progresso usa TTL curto ou nenhum. */
export const TTL_PADRAO = 5 * 60 * 1000
export const TTL_CURTO = 30 * 1000

export function lerCache<T>(chave: string): T | null {
  const e = cache.get(chave)
  if (!e) return null
  if (Date.now() > e.expiraEm) {
    cache.delete(chave)
    return null
  }
  return e.valor as T
}

export function gravarCache<T>(chave: string, valor: T, ttl = TTL_PADRAO): void {
  cache.set(chave, { valor, expiraEm: Date.now() + ttl })
}

/** Invalida uma chave exata ou tudo que comeca com o prefixo. */
export function invalidar(chaveOuPrefixo: string): number {
  if (cache.delete(chaveOuPrefixo)) return 1
  let n = 0
  for (const k of [...cache.keys()]) {
    if (k.startsWith(chaveOuPrefixo)) {
      cache.delete(k)
      n++
    }
  }
  return n
}

export function invalidarTudo(): void {
  cache.clear()
}

/** Chaves de cache num lugar so, para invalidar sem adivinhar string. */
export const chaves = {
  materias: () => 'materias',
  materia: (slug: string) => `materia:${slug}`,
  assuntos: (materiaId: string) => `assuntos:${materiaId}`,
  contagemQuestoes: (materiaId: string) => `contagem:${materiaId}`,
  acessos: () => 'acessos',
  metas: () => 'metas',
  prefixoAssuntos: 'assuntos:',
  prefixoContagem: 'contagem:',
}

// ---------------------------------------------------------------------------
// Execucao
// ---------------------------------------------------------------------------

/**
 * Resposta crua do PostgREST. `data` fica como `unknown` de proposito: o
 * builder do supabase-js tem genericos que nao casam com um wrapper generico,
 * e a alternativa era espalhar `as never` em toda query - o que desligaria a
 * checagem de tipo justamente onde ela importa. Aqui a conversao acontece uma
 * vez so, e o tipo de retorno vem do parametro T que cada funcao declara.
 */
type RespostaCrua = { data: unknown; error: unknown }

/**
 * Roda uma query do Supabase e devolve Resultado.
 * `error` do PostgREST nao vira excecao sozinho - por isso o teste explicito.
 */
export async function consulta<T>(
  contexto: string,
  fn: (sb: ClienteSupabase) => PromiseLike<RespostaCrua>,
  cliente?: ClienteSupabase
): Promise<Resultado<T>> {
  return tentar(contexto, async () => {
    const { data, error } = await fn(cliente ?? (getBrowserClient() as ClienteSupabase))
    if (error) throw error
    return data as T
  })
}

/**
 * Igual a `consulta`, com cache por chave. Erro nunca e cacheado.
 * Com client injetado (servidor) o cache e ignorado nas duas pontas: nao le e
 * nao grava. Ver o comentario do Map acima.
 */
export async function consultaComCache<T>(
  contexto: string,
  chave: string,
  fn: (sb: ClienteSupabase) => PromiseLike<RespostaCrua>,
  ttl = TTL_PADRAO,
  cliente?: ClienteSupabase
): Promise<Resultado<T>> {
  if (cliente) return consulta<T>(contexto, fn, cliente)

  const emCache = lerCache<T>(chave)
  if (emCache !== null) return { ok: true, dados: emCache }

  const r = await consulta<T>(contexto, fn)
  if (r.ok) gravarCache(chave, r.dados, ttl)
  return r
}

// ---------------------------------------------------------------------------
// Embaralhamento
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates sobre copia.
 *
 * Usado para ordenar alternativas. O gabarito nao depende desta ordem: ele
 * e o UUID da alternativa correta, guardado no servidor. Na v10 o gabarito
 * era o indice (`correct: 0`), entao embaralhar sem cuidado trocava a
 * resposta certa de lugar.
 */
export function embaralhar<T>(entrada: readonly T[]): T[] {
  const arr = [...entrada]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Amostra sem repeticao. */
export function amostrar<T>(entrada: readonly T[], quantidade: number): T[] {
  return embaralhar(entrada).slice(0, Math.max(0, quantidade))
}
