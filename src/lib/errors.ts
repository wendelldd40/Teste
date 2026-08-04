/**
 * EstudeVet v11 - Erro padronizado.
 *
 * Todo repositorio devolve Resultado<T>, nunca lanca. A tela decide o que
 * fazer com o codigo, sem precisar entender erro do Postgres.
 */

export type CodigoErro =
  | 'sem_sessao'
  | 'sem_permissao'
  | 'sem_acesso_materia'
  | 'nao_encontrado'
  | 'duplicado'
  | 'dado_invalido'
  | 'conflito'
  | 'rede'
  | 'desconhecido'

export class AppError extends Error {
  readonly codigo: CodigoErro
  readonly detalhe?: string
  readonly origem?: unknown

  constructor(codigo: CodigoErro, mensagem: string, detalhe?: string, origem?: unknown) {
    super(mensagem)
    this.name = 'AppError'
    this.codigo = codigo
    this.detalhe = detalhe
    this.origem = origem
  }
}

/** Mensagens em portugues, prontas para a tela. Sem jargao de banco. */
const MENSAGENS: Record<CodigoErro, string> = {
  sem_sessao: 'Sua sessao expirou. Entre novamente.',
  sem_permissao: 'Voce nao tem permissao para isso.',
  sem_acesso_materia: 'Esta materia ainda nao esta liberada para voce.',
  nao_encontrado: 'Nao encontramos o que voce procurava.',
  duplicado: 'Esse registro ja existe.',
  dado_invalido: 'Alguma informacao esta invalida.',
  conflito: 'Alguem alterou este registro enquanto voce trabalhava nele.',
  rede: 'Nao conseguimos falar com o servidor. Verifique sua conexao.',
  desconhecido: 'Algo deu errado. Tente de novo em instantes.',
}

interface ErroPostgrest {
  code?: string
  message?: string
  details?: string
  hint?: string
}

/**
 * Traduz erro do Supabase/Postgres em AppError.
 * Os codigos vem do Postgres (23505, 42501...) e do PostgREST (PGRST116).
 */
export function normalizaErro(erro: unknown, contexto?: string): AppError {
  if (erro instanceof AppError) return erro

  const e = (erro ?? {}) as ErroPostgrest
  const code = e.code ?? ''
  const msg = (e.message ?? '').toLowerCase()

  let codigo: CodigoErro = 'desconhecido'

  if (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
    codigo = msg.includes('acesso a esta materia') ? 'sem_acesso_materia' : 'sem_permissao'
  } else if (code === 'PGRST301' || msg.includes('jwt') || msg.includes('sem sessao')) {
    codigo = 'sem_sessao'
  } else if (code === 'PGRST116' || code === 'P0002') {
    codigo = 'nao_encontrado'
  } else if (code === '23505') {
    codigo = 'duplicado'
  } else if (code === '23503' || code === '23514' || code === '22023' || code === '22P02') {
    codigo = 'dado_invalido'
  } else if (code === '40001' || code === '40P01') {
    codigo = 'conflito'
  } else if (erro instanceof TypeError && msg.includes('fetch')) {
    codigo = 'rede'
  }

  return new AppError(
    codigo,
    MENSAGENS[codigo],
    [contexto, e.message, e.details].filter(Boolean).join(' | ') || undefined,
    erro
  )
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: AppError }

export const ok = <T>(dados: T): Resultado<T> => ({ ok: true, dados })

export const falha = <T = never>(erro: AppError): Resultado<T> => ({ ok: false, erro })

/** Envelopa qualquer chamada async no formato Resultado. */
export async function tentar<T>(
  contexto: string,
  fn: () => Promise<T>
): Promise<Resultado<T>> {
  try {
    return ok(await fn())
  } catch (e) {
    return falha(normalizaErro(e, contexto))
  }
}
