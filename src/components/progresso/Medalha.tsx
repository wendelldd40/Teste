/**
 * Medalhas.
 *
 * Desenhadas em SVG, na paleta da marca - nada de emoji e nada de icone de
 * biblioteca. A forma muda com a familia da conquista, entao "sete dias
 * seguidos" e "mil questoes" nao viram a mesma figura com texto diferente.
 *
 * Tres estados: conquistada (dourado cheio), em progresso (contorno com o
 * arco do quanto falta) e bloqueada (silhueta apagada).
 */

export type FamiliaConquista =
  | 'streak_dias'
  | 'questoes_respondidas'
  | 'metas_semanais'
  | 'metas_semanais_seguidas'
  | 'simulados_concluidos'
  | 'acerto_simulado'
  | 'acerto_materia'
  | 'erros_revertidos'

export type EstadoMedalha = 'conquistada' | 'em_progresso' | 'bloqueada'

const OURO = '#C99D66'
const CASCA = '#0C3328'
const ACAO = '#12876C'
const FRACA = '#75887D'

/** Progresso 0..1 preso nos limites. Espelha a regra do anel do dashboard. */
export function progressoMedalha(atual: number, alvo: number): number {
  if (!Number.isFinite(atual) || !Number.isFinite(alvo) || alvo <= 0) return 0
  return Math.min(Math.max(atual / alvo, 0), 1)
}

/** Cada familia tem uma silhueta propria. */
function miolo(familia: FamiliaConquista, cor: string) {
  switch (familia) {
    case 'streak_dias':
    case 'metas_semanais':
    case 'metas_semanais_seguidas':
      // Chama: constancia que se mantem acesa.
      return (
        <path
          d="M32 18c6 6 9 11 9 16a9 9 0 0 1-18 0c0-3 1.5-5.5 4-8 .5 3 2 4.5 3.5 5C29 27 29.5 22 32 18z"
          fill={cor}
        />
      )
    case 'questoes_respondidas':
    case 'simulados_concluidos':
      // Pilha de folhas: volume acumulado.
      return (
        <g fill={cor}>
          <rect x="21" y="34" width="22" height="4" rx="2" />
          <rect x="21" y="27" width="22" height="4" rx="2" opacity="0.75" />
          <rect x="21" y="20" width="22" height="4" rx="2" opacity="0.5" />
        </g>
      )
    case 'acerto_simulado':
    case 'acerto_materia':
      // Alvo: pontaria.
      return (
        <g fill="none" stroke={cor} strokeWidth="3">
          <circle cx="32" cy="30" r="11" />
          <circle cx="32" cy="30" r="4" fill={cor} stroke="none" />
        </g>
      )
    case 'erros_revertidos':
      // Seta de volta: o erro que virou acerto.
      return (
        <g fill="none" stroke={cor} strokeWidth="3" strokeLinecap="round">
          <path d="M22 30a10 10 0 1 1 3 7" />
          <path d="M21 24v7h7" />
        </g>
      )
  }
}

interface Props {
  familia: FamiliaConquista
  estado: EstadoMedalha
  progresso?: number
  nome: string
  tamanho?: number
}

export function Medalha({ familia, estado, progresso = 0, nome, tamanho = 64 }: Props) {
  const cor = estado === 'conquistada' ? OURO : estado === 'em_progresso' ? ACAO : FRACA
  const opacidade = estado === 'bloqueada' ? 0.35 : 1

  const raio = 28
  const c = 2 * Math.PI * raio
  const preenchido = c * Math.min(Math.max(progresso, 0), 1)

  const descricao =
    estado === 'conquistada'
      ? `${nome}: conquistada`
      : estado === 'em_progresso'
        ? `${nome}: ${Math.round(progresso * 100)} por cento`
        : `${nome}: ainda bloqueada`

  return (
    <svg
      viewBox="0 0 64 64"
      width={tamanho}
      height={tamanho}
      role="img"
      aria-label={descricao}
      style={{ opacity: opacidade }}
    >
      {estado === 'conquistada' && <circle cx="32" cy="32" r={raio} fill={CASCA} />}

      <circle
        cx="32"
        cy="32"
        r={raio}
        fill="none"
        stroke={cor}
        strokeOpacity={estado === 'conquistada' ? 1 : 0.2}
        strokeWidth="4"
      />

      {estado === 'em_progresso' && (
        <circle
          cx="32"
          cy="32"
          r={raio}
          fill="none"
          stroke={cor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${preenchido.toFixed(2)} ${c.toFixed(2)}`}
          transform="rotate(-90 32 32)"
        />
      )}

      {miolo(familia, cor)}

      {estado === 'conquistada' && (
        <path d="M26 44h12l-2 4H28z" fill={OURO} opacity="0.85" />
      )}
    </svg>
  )
}
