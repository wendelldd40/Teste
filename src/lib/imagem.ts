/**
 * EstudeVet v11 - Imagem de materia.
 *
 * Cada materia tem uma imagem 16:9 no card, no lugar do emoji da v10. Duas
 * coisas moram aqui:
 *   - o corte automatico, para que qualquer arquivo que o admin escolha vire
 *     16:9 sem distorcer;
 *   - o fallback, para que o card nunca fique vazio enquanto a imagem nao
 *     existe. Sem emoji, sem imagem generica: uma capa desenhada na paleta da
 *     marca, derivada do nome da materia.
 */

export const PROPORCAO = 16 / 9
export const LARGURA_ALVO = 1280
export const ALTURA_ALVO = 720

// ---------------------------------------------------------------------------
// Corte
// ---------------------------------------------------------------------------

export interface Recorte {
  x: number
  y: number
  largura: number
  altura: number
}

/**
 * Maior retangulo 16:9 centrado que cabe na imagem original.
 *
 * Funcao pura de proposito: e a parte que da para testar sem navegador, e e
 * onde erro de arredondamento vira faixa preta na borda do card.
 */
export function calcularRecorte16x9(
  larguraOriginal: number,
  alturaOriginal: number
): Recorte {
  if (larguraOriginal <= 0 || alturaOriginal <= 0) {
    throw new Error('Dimensoes invalidas para recorte.')
  }

  const proporcaoOriginal = larguraOriginal / alturaOriginal

  if (proporcaoOriginal > PROPORCAO) {
    // Imagem larga demais: sobra nos lados.
    const largura = Math.round(alturaOriginal * PROPORCAO)
    return {
      x: Math.round((larguraOriginal - largura) / 2),
      y: 0,
      largura,
      altura: alturaOriginal,
    }
  }

  // Imagem alta demais (ou ja 16:9): sobra em cima e embaixo.
  const altura = Math.round(larguraOriginal / PROPORCAO)
  return {
    x: 0,
    y: Math.round((alturaOriginal - altura) / 2),
    largura: larguraOriginal,
    altura,
  }
}

/**
 * Corta em 16:9, redimensiona para 1280x720 e devolve WebP.
 * So roda no navegador (usa canvas).
 */
export async function prepararImagem(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)

  try {
    const recorte = calcularRecorte16x9(bitmap.width, bitmap.height)

    // Nao aumenta imagem pequena: melhor entregar 800x450 nitido do que
    // 1280x720 borrado.
    const largura = Math.min(LARGURA_ALVO, recorte.largura)
    const altura = Math.round(largura / PROPORCAO)

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Nao foi possivel preparar a imagem neste navegador.')

    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      bitmap,
      recorte.x,
      recorte.y,
      recorte.largura,
      recorte.altura,
      0,
      0,
      largura,
      altura
    )

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.86)
    )
    if (!blob) throw new Error('Nao foi possivel converter a imagem.')
    return blob
  } finally {
    bitmap.close()
  }
}

/** Caminho no bucket. Timestamp evita cache velho depois de trocar a capa. */
export function caminhoImagem(slug: string): string {
  return `${slug}/capa-${Date.now()}.webp`
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

const PALETA = [
  { fundo: '#0C3328', traco: '#12876C', realce: '#C99D66' },
  { fundo: '#12876C', traco: '#0C3328', realce: '#F7F5F0' },
  { fundo: '#14231D', traco: '#12876C', realce: '#C99D66' },
  { fundo: '#44594E', traco: '#0C3328', realce: '#F7F5F0' },
] as const

/** Hash estavel: a mesma materia recebe sempre a mesma capa. */
function hash(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** Iniciais da materia: 'Analises Clinicas Veterinarias' vira 'AC'. */
export function iniciais(nome: string): string {
  const ignorar = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o'])
  const palavras = nome
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((p) => p.length > 0 && !ignorar.has(p.toLowerCase()))

  if (palavras.length === 0) return '?'
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase()
  return (palavras[0][0] + palavras[1][0]).toUpperCase()
}

/**
 * Capa 16:9 desenhada, para materia sem imagem. Determinista: mesma materia,
 * mesma capa, sempre. Sem emoji - decisao travada do brief.
 */
export function capaFallbackSvg(nome: string, slug: string): string {
  const cor = PALETA[hash(slug) % PALETA.length]
  const letras = iniciais(nome)
  const semente = hash(slug)

  // Malha de linhas diagonais: textura discreta, derivada do slug.
  const passo = 40 + (semente % 5) * 8
  const inclinacao = semente % 2 === 0 ? 1 : -1
  const linhas: string[] = []
  for (let x = -720; x < 1280 + 720; x += passo) {
    linhas.push(
      `<line x1="${x}" y1="0" x2="${x + 720 * inclinacao}" y2="720" stroke="${cor.traco}" stroke-width="1.5" opacity="0.35"/>`
    )
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" role="img" aria-label="${escapar(nome)}">
  <rect width="1280" height="720" fill="${cor.fundo}"/>
  <g>${linhas.join('')}</g>
  <rect x="0" y="640" width="1280" height="80" fill="${cor.fundo}" opacity="0.85"/>
  <rect x="0" y="640" width="240" height="6" fill="${cor.realce}"/>
  <text x="80" y="380" font-family="Plus Jakarta Sans, Inter, sans-serif" font-size="220" font-weight="800" fill="${cor.realce}" opacity="0.9">${escapar(letras)}</text>
  <text x="80" y="694" font-family="Inter, sans-serif" font-size="30" font-weight="600" fill="#F7F5F0" opacity="0.92">${escapar(recortarTexto(nome, 46))}</text>
</svg>`
}

/** Data URI pronta para o atributo src. */
export function capaFallbackDataUri(nome: string, slug: string): string {
  const svg = capaFallbackSvg(nome, slug)
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function escapar(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function recortarTexto(t: string, max: number): string {
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}...`
}
