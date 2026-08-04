/**
 * Curva de acerto ao longo do tempo.
 *
 * SVG proprio, sem biblioteca de grafico - o brief pede design system
 * proprio, e uma linha com pontos nao justifica 50 KB de dependencia.
 *
 * A conversao serie -> coordenadas fica em funcao pura: e onde erro aparece
 * (serie de um ponto so, divisao por zero na escala, valor fora de 0..1).
 */

export interface PontoEvolucao {
  semana: string
  taxa: number
  respondidas: number
}

export const LARGURA = 640
export const ALTURA = 200
const MARGEM = { topo: 16, base: 28, esquerda: 36, direita: 12 }

export interface Coordenada {
  x: number
  y: number
  ponto: PontoEvolucao
}

/**
 * Converte a serie em coordenadas.
 * Serie com um ponto so desenha no centro horizontal, nao na borda esquerda -
 * ponto colado no eixo parece erro de renderizacao.
 */
export function coordenadas(serie: readonly PontoEvolucao[]): Coordenada[] {
  const util = {
    largura: LARGURA - MARGEM.esquerda - MARGEM.direita,
    altura: ALTURA - MARGEM.topo - MARGEM.base,
  }

  if (serie.length === 0) return []
  if (serie.length === 1) {
    const taxa = presa(serie[0].taxa)
    return [
      {
        x: MARGEM.esquerda + util.largura / 2,
        y: MARGEM.topo + util.altura * (1 - taxa),
        ponto: serie[0],
      },
    ]
  }

  return serie.map((p, i) => {
    const taxa = presa(p.taxa)
    return {
      x: MARGEM.esquerda + (util.largura * i) / (serie.length - 1),
      y: MARGEM.topo + util.altura * (1 - taxa),
      ponto: p,
    }
  })
}

function presa(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(Math.max(v, 0), 1)
}

export function caminhoDaLinha(coords: readonly Coordenada[]): string {
  if (coords.length === 0) return ''
  return coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
}

function rotuloSemana(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function GraficoAcerto({ serie }: { serie: PontoEvolucao[] }) {
  const coords = coordenadas(serie)
  if (coords.length === 0) return null

  const media =
    serie.reduce((s, p) => s + presa(p.taxa), 0) / Math.max(serie.length, 1)

  const descricao = `Acerto por semana, de ${Math.round(presa(serie[0].taxa) * 100)} por cento a ${Math.round(presa(serie[serie.length - 1].taxa) * 100)} por cento. Media de ${Math.round(media * 100)} por cento.`

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className="w-full"
      role="img"
      aria-label={descricao}
    >
      {[0, 0.5, 1].map((nivel) => {
        const y = MARGEM.topo + (ALTURA - MARGEM.topo - MARGEM.base) * (1 - nivel)
        return (
          <g key={nivel}>
            <line
              x1={MARGEM.esquerda}
              y1={y}
              x2={LARGURA - MARGEM.direita}
              y2={y}
              stroke="#75887D"
              strokeOpacity="0.2"
              strokeDasharray={nivel === 0 ? undefined : '3 4'}
            />
            <text x="4" y={y + 4} fontSize="11" fill="#75887D" fontFamily="Inter, sans-serif">
              {nivel * 100}%
            </text>
          </g>
        )
      })}

      {coords.length > 1 && (
        <path
          d={caminhoDaLinha(coords)}
          fill="none"
          stroke="#12876C"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {coords.map((c) => (
        <g key={c.ponto.semana}>
          <circle cx={c.x} cy={c.y} r="4" fill="#12876C" />
          <text
            x={c.x}
            y={ALTURA - 8}
            fontSize="10"
            textAnchor="middle"
            fill="#75887D"
            fontFamily="Inter, sans-serif"
          >
            {rotuloSemana(c.ponto.semana)}
          </text>
        </g>
      ))}
    </svg>
  )
}
