/**
 * EstudeVet v11 - Tipos derivados do schema (migrations 0001 e 0002).
 *
 * Fonte unica de verdade da forma dos dados. Se uma coluna mudar no SQL,
 * ela muda aqui e o build quebra em todo lugar que dependia dela - que era
 * exatamente o que faltava na v10.
 *
 * Nomes de dominio em portugues, nomes tecnicos em ingles.
 */

// ---------------------------------------------------------------------------
// Enums (espelham os tipos do Postgres)
// ---------------------------------------------------------------------------

export const PAPEIS_USUARIO = ['aluno', 'admin'] as const
export type PapelUsuario = (typeof PAPEIS_USUARIO)[number]

export const DIFICULDADES = ['facil', 'medio', 'dificil'] as const
export type Dificuldade = (typeof DIFICULDADES)[number]

export const STATUS_REVISAO = ['rascunho', 'precisa_revisao', 'publicada', 'arquivada'] as const
export type StatusRevisao = (typeof STATUS_REVISAO)[number]

export const TIPOS_QUESTAO = ['multipla_escolha', 'assertivas', 'julgamento'] as const
export type TipoQuestao = (typeof TIPOS_QUESTAO)[number]

export const TIPOS_MATERIAL = ['apostila', 'mapa_mental', 'resumo', 'link'] as const
export type TipoMaterial = (typeof TIPOS_MATERIAL)[number]

export const ESCOPOS_SIMULADO = ['materia', 'assunto', 'geral'] as const
export type EscopoSimulado = (typeof ESCOPOS_SIMULADO)[number]

export const STATUS_SESSAO = ['em_andamento', 'concluida', 'abandonada'] as const
export type StatusSessao = (typeof STATUS_SESSAO)[number]

export const ORIGENS_ACESSO = ['compra', 'cortesia', 'bolsa', 'turma'] as const
export type OrigemAcesso = (typeof ORIGENS_ACESSO)[number]

export const PAPEIS_TURMA = ['aluno', 'monitor'] as const
export type PapelTurma = (typeof PAPEIS_TURMA)[number]

export const LETRAS_ALTERNATIVA = ['a', 'b', 'c', 'd', 'e'] as const
export type LetraAlternativa = (typeof LETRAS_ALTERNATIVA)[number]

// ---------------------------------------------------------------------------
// Utilitarios
// ---------------------------------------------------------------------------

type UUID = string
type Timestamp = string // ISO 8601
type DateOnly = string // YYYY-MM-DD

/** Campos que o banco preenche sozinho e que nunca vao num insert. */
type Gerado = 'id' | 'created_at' | 'updated_at'

/** Coluna anulavel: se aceita null, o banco assume null quando ela e omitida. */
type ChavesNulas<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never
}[keyof T]

/**
 * Colunas nao anulaveis que tem DEFAULT na migration 0001 e portanto podem
 * faltar num insert. Mantida como lista de nomes de proposito: e curta, esta
 * ao lado do schema e quebra visivelmente se um default sair do SQL.
 */
type ComDefault =
  | 'ativa'
  | 'ativo'
  | 'ordem'
  | 'status'
  | 'tipo'
  | 'dificuldade'
  | 'papel'
  | 'origem'
  | 'correta'
  | 'acertos'
  | 'indice_atual'
  | 'tempo_segundos'
  | 'questoes_respondidas'
  | 'conta_streak'
  | 'meta_semanal_questoes'
  | 'minimo_diario_questoes'
  | 'mostrar_em_destaques'
  | 'liberado_em'
  | 'iniciada_em'
  | 'atualizada_em'
  | 'respondida_em'
  | 'conquistada_em'
  | 'entrou_em'

type Opcional<T> = Extract<Gerado | ComDefault | ChavesNulas<T>, keyof T>

export type Insert<T> = Omit<T, Opcional<T>> & Partial<Pick<T, Opcional<T>>>

export type Update<T> = Partial<Omit<T, Gerado>>

// ---------------------------------------------------------------------------
// Estrutura academica
// ---------------------------------------------------------------------------

export type Periodo = {
  id: UUID
  numero: number
  nome: string
  created_at: Timestamp
}

export type Materia = {
  id: UUID
  periodo_id: UUID
  /** Codigo da matriz (MV200206). NAO e unico: a matriz 2023/1 repete MV200246. */
  codigo: string | null
  nome: string
  slug: string
  descricao: string | null
  creditos: number | null
  ch_total: number | null
  ch_teorica: number | null
  ch_pratica: number | null
  ch_afec: number | null
  /** Imagem 16:9 no Supabase Storage. Substitui o emoji da v10. */
  imagem_url: string | null
  imagem_alt: string | null
  ativa: boolean
  ordem: number
  created_at: Timestamp
  updated_at: Timestamp
}

export type MateriaPrerequisito = {
  materia_id: UUID
  prerequisito_id: UUID
}

export type Assunto = {
  id: UUID
  materia_id: UUID
  /** Hierarquia: modulo -> assunto -> subassunto. O pai e sempre da mesma materia. */
  parent_id: UUID | null
  nome: string
  slug: string
  descricao: string | null
  ordem: number
  created_at: Timestamp
}

// ---------------------------------------------------------------------------
// Fonte bibliografica (opcional)
// ---------------------------------------------------------------------------

export type Livro = {
  id: UUID
  titulo: string
  autores: string
  edicao: string | null
  ano: number | null
  editora: string | null
  created_at: Timestamp
}

export type Capitulo = {
  id: UUID
  livro_id: UUID
  numero: string
  titulo: string
}

// ---------------------------------------------------------------------------
// Conteudo de estudo
// ---------------------------------------------------------------------------

export type Material = {
  id: UUID
  materia_id: UUID
  assunto_id: UUID | null
  tipo: TipoMaterial
  titulo: string
  descricao: string | null
  storage_path: string | null
  url_externa: string | null
  status: StatusRevisao
  ordem: number
  created_at: Timestamp
  updated_at: Timestamp
}

export type ConteudoSecao = {
  id: UUID
  material_id: UUID
  titulo: string
  /** Markdown. */
  corpo: string
  ordem: number
  created_at: Timestamp
}

// ---------------------------------------------------------------------------
// Questoes
// ---------------------------------------------------------------------------

export type Questao = {
  id: UUID
  materia_id: UUID
  tipo: TipoQuestao
  dificuldade: Dificuldade
  enunciado: string
  comentario: string | null
  status: StatusRevisao
  livro_id: UUID | null
  capitulo_id: UUID | null
  pagina: string | null
  fonte_livre: string | null
  /** Id da questao no banco antigo. Preenchido pela migracao da S2. */
  origem_legado_id: string | null
  criado_por: UUID | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type QuestaoAssunto = {
  questao_id: UUID
  assunto_id: UUID
}

export type Assertiva = {
  id: UUID
  questao_id: UUID
  ordem: number
  /** Como aparece na tela: 'I', 'II', 'III'. */
  numeral: string
  texto: string
  /** Obrigatorio em tipo 'julgamento'; apoio ao comentario em tipo 'assertivas'. */
  correta: boolean | null
}

export type Alternativa = {
  id: UUID
  questao_id: UUID
  letra: LetraAlternativa
  texto: string
  correta: boolean
}

// ---------------------------------------------------------------------------
// Usuario, acesso e metas
// ---------------------------------------------------------------------------

export type Usuario = {
  id: UUID
  nome: string
  email: string
  avatar_url: string | null
  papel: PapelUsuario
  periodo_id: UUID | null
  instituicao: string | null
  /** Consentimento para aparecer no bloco de constancia. Padrao: desligado. */
  mostrar_em_destaques: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

export type AcessoMateria = {
  id: UUID
  usuario_id: UUID
  materia_id: UUID
  origem: OrigemAcesso
  liberado_em: Timestamp
  expira_em: Timestamp | null
  ativo: boolean
  observacao: string | null
}

export type MetaUsuario = {
  usuario_id: UUID
  meta_semanal_questoes: number
  /** Quantas questoes fazem o dia contar no streak. Padrao 5. */
  minimo_diario_questoes: number
  updated_at: Timestamp
}

// ---------------------------------------------------------------------------
// Simulados
// ---------------------------------------------------------------------------

export type SessaoSimulado = {
  id: UUID
  usuario_id: UUID
  escopo: EscopoSimulado
  materia_id: UUID | null
  assunto_id: UUID | null
  total_questoes: number
  indice_atual: number
  status: StatusSessao
  acertos: number
  tempo_segundos: number
  iniciada_em: Timestamp
  atualizada_em: Timestamp
  finalizada_em: Timestamp | null
}

export type SessaoQuestao = {
  id: UUID
  sessao_id: UUID
  questao_id: UUID
  ordem: number
  /** Ordem embaralhada das alternativas, gravada para a sessao poder ser retomada. */
  ordem_alternativas: UUID[]
}

export type Resposta = {
  id: UUID
  sessao_id: UUID
  usuario_id: UUID
  questao_id: UUID
  alternativa_id: UUID | null
  correta: boolean
  tempo_segundos: number
  respondida_em: Timestamp
}

// ---------------------------------------------------------------------------
// Progresso
// ---------------------------------------------------------------------------

export type AtividadeDiaria = {
  usuario_id: UUID
  dia: DateOnly
  questoes_respondidas: number
  acertos: number
  tempo_segundos: number
  /** true quando questoes_respondidas >= minimo_diario_questoes. Escrito por trigger. */
  conta_streak: boolean
}

// ---------------------------------------------------------------------------
// Conquistas
// ---------------------------------------------------------------------------

export type CriterioConquista =
  | { tipo: 'simulados_concluidos'; valor: number }
  | { tipo: 'streak_dias'; valor: number }
  | { tipo: 'metas_semanais'; valor: number }
  | { tipo: 'metas_semanais_seguidas'; valor: number }
  | { tipo: 'questoes_respondidas'; valor: number }
  | { tipo: 'acerto_simulado'; valor: number; minimo_questoes: number }
  | { tipo: 'acerto_materia'; valor: number; minimo_questoes: number }
  | { tipo: 'erros_revertidos'; valor: number }

export type Conquista = {
  id: UUID
  codigo: string
  nome: string
  descricao: string
  criterio: CriterioConquista
  ordem: number
  ativa: boolean
}

export type UsuarioConquista = {
  usuario_id: UUID
  conquista_id: UUID
  conquistada_em: Timestamp
}

// ---------------------------------------------------------------------------
// Turmas (criadas, sem uso ate haver modelo de turma)
// ---------------------------------------------------------------------------

export type Turma = {
  id: UUID
  nome: string
  codigo: string
  periodo_id: UUID | null
  criada_por: UUID | null
  ativa: boolean
  created_at: Timestamp
}

export type TurmaMembro = {
  turma_id: UUID
  usuario_id: UUID
  papel: PapelTurma
  entrou_em: Timestamp
}

// ---------------------------------------------------------------------------
// Mapa de tabelas - consumido pelo client tipado do Supabase
// ---------------------------------------------------------------------------

export type Tabelas = {
  periodos: Periodo
  materias: Materia
  materia_prerequisitos: MateriaPrerequisito
  assuntos: Assunto
  livros: Livro
  capitulos: Capitulo
  materiais: Material
  conteudo_secoes: ConteudoSecao
  questoes: Questao
  questao_assuntos: QuestaoAssunto
  assertivas: Assertiva
  alternativas: Alternativa
  usuarios: Usuario
  acessos_materia: AcessoMateria
  metas_usuario: MetaUsuario
  sessoes_simulado: SessaoSimulado
  sessao_questoes: SessaoQuestao
  respostas: Resposta
  atividade_diaria: AtividadeDiaria
  conquistas: Conquista
  usuario_conquistas: UsuarioConquista
  turmas: Turma
  turma_membros: TurmaMembro
}

export type NomeTabela = keyof Tabelas
export type LinhaDe<T extends NomeTabela> = Tabelas[T]

/**
 * Formato esperado pelo createClient<Database>() do supabase-js.
 * Insert e Update sao derivados, nao redigitados.
 */
export type Database = {
  public: {
    Tables: {
      [K in NomeTabela]: {
        Row: Tabelas[K]
        Insert: Insert<Tabelas[K]>
        Update: Update<Tabelas[K]>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      tem_acesso_materia: { Args: { p_materia: UUID }; Returns: boolean }
      tem_acesso_questao: { Args: { p_questao: UUID }; Returns: boolean }
      registrar_resposta: {
        Args: {
          p_sessao: UUID
          p_questao: UUID
          p_alternativa: UUID | null
          p_tempo_segundos?: number
        }
        Returns: {
          acertou: boolean
          alternativa_correta_id: UUID
          comentario: string | null
          ja_respondida: boolean
        }
      }
      finalizar_sessao: {
        Args: { p_sessao: UUID }
        Returns: { total: number; respondidas: number; acertos: number }
      }
      resultado_sessao: {
        Args: { p_sessao: UUID }
        Returns: Array<{
          questao_id: UUID
          enunciado: string
          comentario: string | null
          alternativa_marcada: UUID | null
          alternativa_correta: UUID
          acertou: boolean
          ordem: number
        }>
      }
      admin_questao_completa: {
        Args: { p_questao: UUID }
        Returns: {
          questao: Questao
          alternativas: Alternativa[]
          assertivas: Assertiva[]
        }
      }
      admin_salvar_questao: {
        Args: { p_dados: Record<string, unknown> }
        Returns: UUID
      }
      admin_publicar_questao: {
        Args: { p_questao: UUID }
        Returns: { id: UUID; status: StatusRevisao }
      }
      mais_constantes_semana: {
        Args: { p_limite?: number }
        Returns: Array<{
          usuario_id: UUID
          nome: string
          dias_validos: number
          questoes: number
          sou_eu: boolean
        }>
      }
      evolucao_semanal: {
        Args: { p_semanas?: number }
        Returns: Array<{
          semana: DateOnly
          respondidas: number
          acertos: number
          taxa: number
        }>
      }
      avaliar_conquistas: {
        Args: Record<string, never>
        Returns: { novas: Array<{ codigo: string; nome: string }> }
      }
      progresso_conquistas: {
        Args: Record<string, never>
        Returns: {
          questoes_respondidas: number
          simulados_concluidos: number
          streak_dias: number
        }
      }
      admin_resumo: {
        Args: Record<string, never>
        Returns: {
          materias_ativas: number
          materias_total: number
          materias_sem_imagem: number
          questoes_publicadas: number
          questoes_revisao: number
          questoes_rascunho: number
          assuntos: number
          alunos: number
        }
      }
    }
    Enums: {
      papel_usuario: PapelUsuario
      dificuldade: Dificuldade
      status_revisao: StatusRevisao
      tipo_questao: TipoQuestao
      tipo_material: TipoMaterial
      escopo_simulado: EscopoSimulado
      status_sessao: StatusSessao
      origem_acesso: OrigemAcesso
      papel_turma: PapelTurma
    }
  }
}
