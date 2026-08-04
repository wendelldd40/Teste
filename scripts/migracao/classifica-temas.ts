/**
 * EstudeVet v11 - Sprint 2 - De `tema` (string livre) para a entidade `assuntos`.
 *
 * O campo `tema` da v10 era digitado a mao, entao a mesma coisa aparece como
 * 'Hemograma', 'hemograma ', 'Hemogramas' e 'Hemograma completo'. Agrupar
 * errado junta assunto que deveria ser separado; agrupar de menos enche o
 * menu de duplicata.
 *
 * A regra aqui e conservadora: so agrupa o que e claramente a mesma coisa
 * (diferenca de acento, caixa, espaco, plural, artigo). Qualquer outra
 * semelhanca vira PROPOSTA e sai no relatorio para decisao humana. O script
 * nunca junta dois temas por conta propria em caso de duvida.
 */

export interface TemaAgrupado {
  /** Nome que vai virar assunto no banco. */
  canonico: string
  slug: string
  /** Todas as grafias originais que caem neste assunto. */
  variantes: string[]
  quantidade: number
}

export interface ParAmbiguo {
  a: string
  b: string
  similaridade: number
  motivo: string
}

export interface ResultadoClassificacao {
  /** materia_slug -> assuntos resolvidos automaticamente */
  porMateria: Map<string, TemaAgrupado[]>
  /** Pares parecidos que o script NAO juntou. Decisao sua. */
  ambiguos: Array<ParAmbiguo & { materia_slug: string }>
}

// ---------------------------------------------------------------------------
// Normalizacao
// ---------------------------------------------------------------------------

const ARTIGOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'as', 'os'])

export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function slugify(s: string): string {
  return semAcento(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

/** Chave de agrupamento AUTOMATICO. Ela e deliberadamente restritiva. */
export function chaveCanonica(tema: string): string {
  const palavras = semAcento(tema)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !ARTIGOS.has(p))
    .map(singular)

  return palavras.sort().join(' ')
}

/** Plural simples do portugues. Nao mexe em palavra curta nem em excecao obvia. */
function singular(p: string): string {
  if (p.length <= 3) return p
  if (p.endsWith('oes')) return p.slice(0, -3) + 'ao'
  if (p.endsWith('aes')) return p.slice(0, -3) + 'ao'
  if (p.endsWith('ais')) return p.slice(0, -3) + 'al'
  if (p.endsWith('eis')) return p.slice(0, -3) + 'el'
  if (p.endsWith('ns')) return p.slice(0, -2) + 'm'
  if (p.endsWith('res') || p.endsWith('ses') || p.endsWith('zes')) return p.slice(0, -2)
  if (p.endsWith('s')) return p.slice(0, -1)
  return p
}

// ---------------------------------------------------------------------------
// Similaridade (para SUGERIR, nunca para agrupar sozinho)
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let anterior = Array.from({ length: n + 1 }, (_, j) => j)
  let atual = new Array<number>(n + 1)

  for (let i = 1; i <= m; i++) {
    atual[0] = i
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      atual[j] = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + custo)
    }
    ;[anterior, atual] = [atual, anterior]
  }
  return anterior[n]
}

export function similaridade(a: string, b: string): number {
  const maior = Math.max(a.length, b.length)
  if (maior === 0) return 1
  return 1 - levenshtein(a, b) / maior
}

/** Um tema contido no outro: 'Hemograma' dentro de 'Hemograma completo'. */
function umContemOutro(a: string, b: string): boolean {
  const pa = new Set(a.split(' '))
  const pb = new Set(b.split(' '))
  const menor = pa.size <= pb.size ? pa : pb
  const maior = pa.size <= pb.size ? pb : pa
  if (menor.size === 0) return false
  return [...menor].every((p) => maior.has(p))
}

// ---------------------------------------------------------------------------
// Classificacao
// ---------------------------------------------------------------------------

const LIMIAR_SUGESTAO = 0.82

export function classificaTemas(
  entradas: Array<{ materia_slug: string; tema: string | null }>
): ResultadoClassificacao {
  // materia -> chave canonica -> grafias originais
  const buckets = new Map<string, Map<string, string[]>>()

  for (const { materia_slug, tema } of entradas) {
    const limpo = (tema ?? '').trim()
    if (!limpo) continue

    const chave = chaveCanonica(limpo)
    if (!chave) continue

    if (!buckets.has(materia_slug)) buckets.set(materia_slug, new Map())
    const daMateria = buckets.get(materia_slug)!
    if (!daMateria.has(chave)) daMateria.set(chave, [])
    daMateria.get(chave)!.push(limpo)
  }

  const porMateria = new Map<string, TemaAgrupado[]>()
  const ambiguos: Array<ParAmbiguo & { materia_slug: string }> = []

  for (const [materia, daMateria] of buckets) {
    const grupos: TemaAgrupado[] = []

    for (const [, variantes] of daMateria) {
      // Canonico = grafia mais frequente. No empate: prefere a que comeca com
      // maiuscula e, depois, a mais curta - dentro de um mesmo grupo as
      // variantes so diferem em acento, caixa e plural, entao a mais curta e
      // o singular ('Hemograma' e nao 'hemogramas').
      const freq = new Map<string, number>()
      for (const v of variantes) freq.set(v, (freq.get(v) ?? 0) + 1)

      const pontua = (s: string) => (/^[A-ZÀ-Ý]/.test(s) ? 0 : 1)
      const canonico = [...freq.entries()].sort(
        (x, y) =>
          y[1] - x[1] || pontua(x[0]) - pontua(y[0]) || x[0].length - y[0].length
      )[0][0]

      grupos.push({
        canonico,
        slug: slugify(canonico),
        variantes: [...new Set(variantes)].sort(),
        quantidade: variantes.length,
      })
    }

    // Slug duplicado depois de encurtar: desempata com sufixo estavel.
    const vistos = new Map<string, number>()
    for (const g of grupos) {
      const n = (vistos.get(g.slug) ?? 0) + 1
      vistos.set(g.slug, n)
      if (n > 1) g.slug = `${g.slug}-${n}`
    }

    grupos.sort((a, b) => b.quantidade - a.quantidade)
    porMateria.set(materia, grupos)

    // Pares parecidos que ficaram separados: reporta, nao junta.
    const chaves = [...daMateria.keys()]
    for (let i = 0; i < chaves.length; i++) {
      for (let j = i + 1; j < chaves.length; j++) {
        const s = similaridade(chaves[i], chaves[j])
        const contido = umContemOutro(chaves[i], chaves[j])
        if (s >= LIMIAR_SUGESTAO || contido) {
          ambiguos.push({
            materia_slug: materia,
            a: daMateria.get(chaves[i])![0],
            b: daMateria.get(chaves[j])![0],
            similaridade: Number(s.toFixed(2)),
            motivo: contido ? 'um tema contem o outro' : 'grafia muito parecida',
          })
        }
      }
    }
  }

  ambiguos.sort((x, y) => y.similaridade - x.similaridade)
  return { porMateria, ambiguos }
}
