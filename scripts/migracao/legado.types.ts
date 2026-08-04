/**
 * EstudeVet v11 - Sprint 2 - Forma do banco legado.
 *
 * Derivado do codigo da v10 (src/data/questoes.repo.js, conteudo.repo.js,
 * perfil.repo.js), nao de suposicao. Todo campo aqui existe de fato la.
 *
 * Nada neste arquivo escreve no banco antigo. A migracao e somente leitura
 * na origem.
 */

// ---------------------------------------------------------------------------
// Tabelas do banco antigo que ENTRAM na migracao
// ---------------------------------------------------------------------------

export interface QuestaoLegado {
  id: string
  /** Key curta: 'analisesclinicas', 'farmacologia'... */
  materia: string | null
  materia_nome: string | null
  /** String livre. Vira entidade `assuntos` no schema novo. */
  tema: string | null
  /** 'Facil' | 'Medio' | 'Dificil', com acento e capitalizacao inconsistentes. */
  dificuldade: string | null
  texto: string | null
  /** Assertivas separadas por '|'. Pode vir nulo e estar embutido no texto. */
  assertivas: string | null
  opcao_a: string | null
  opcao_b: string | null
  opcao_c: string | null
  opcao_d: string | null
  opcao_e: string | null
  /** 'A' a 'E'. Sem isso a questao e rejeitada. */
  gabarito: string | null
  comentario: string | null
  /** Fazia papel de status na v10. Vira `status_revisao` no schema novo. */
  ativo: boolean | null
  created_at?: string | null
}

export interface ConteudoLegado {
  id: string
  materia: string | null
  livro: string | null
  autor: string | null
  edicao: string | null
  capitulo: string | null
  titulo: string | null
  subtitulo: string | null
  tags: string | null
  conteudo: string | null
  ordem: number | null
  ativo: boolean | null
  created_at?: string | null
}

export interface UsuarioLegado {
  id: string
  nome: string | null
  email: string | null
  xp_total: number | null
  streak: number | null
  total_questoes: number | null
  ranking_opt: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

/**
 * Formato do arquivo legado.json consumido pelo migrar.ts.
 * Gerado por exportar-legado.ts ou montado a mao com o mesmo formato.
 */
export interface DumpLegado {
  exportado_em: string
  questoes: QuestaoLegado[]
  conteudo_estudo?: ConteudoLegado[]
  usuarios?: UsuarioLegado[]
}

// ---------------------------------------------------------------------------
// Tabelas do banco antigo que NAO entram (decisoes travadas do brief)
// ---------------------------------------------------------------------------

/** Nao migram: flashcards nao existem na v11; concursos vira outro produto. */
export const TABELAS_DESCARTADAS = [
  'flashcards',
  'flashcard_progresso',
  'questoes_concurso',
  'editais',
] as const

// ---------------------------------------------------------------------------
// Mapa de materias: key legada -> slug da matriz curricular 2023/1
// ---------------------------------------------------------------------------

/**
 * Explicito de proposito. Nada de casar por similaridade de nome:
 * 'patologia' na v10 e Patologia Veterinaria GERAL na matriz, e existe
 * tambem uma Patologia Veterinaria Especial no 6o periodo. Adivinhar
 * mandaria questao para a materia errada sem ninguem perceber.
 */
export const MAPA_MATERIAS: Record<string, string> = {
  analisesclinicas: 'analises-clinicas-veterinarias',
  farmacologia: 'farmacologia-veterinaria-e-toxicologia',
  aquicultura: 'aquicultura',
  semiologia: 'semiologia-basica',
  inspecaoleite: 'inspecao-de-leite-produtos-lacteos-e-mel',
  patologia: 'patologia-veterinaria-geral',
  zootecnia: 'zootecnia-i',
}

/** Aceita tambem o nome por extenso, caso a key venha vazia no dump. */
export const MAPA_MATERIAS_POR_NOME: Record<string, string> = {
  'analises clinicas': 'analises-clinicas-veterinarias',
  farmacologia: 'farmacologia-veterinaria-e-toxicologia',
  aquicultura: 'aquicultura',
  semiologia: 'semiologia-basica',
  'inspecao do leite': 'inspecao-de-leite-produtos-lacteos-e-mel',
  patologia: 'patologia-veterinaria-geral',
  zootecnia: 'zootecnia-i',
}

// ---------------------------------------------------------------------------
// Dificuldade: valores livres da v10 -> enum do schema novo
// ---------------------------------------------------------------------------

import type { Dificuldade } from '../../src/types/database'

export function normalizaDificuldade(valor: string | null): Dificuldade {
  const v = (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

  if (v.startsWith('fac') || v === 'easy' || v === '1') return 'facil'
  if (v.startsWith('dif') || v === 'hard' || v === '3') return 'dificil'
  return 'medio'
}
