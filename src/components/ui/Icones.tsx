/**
 * Ícones do menu.
 *
 * Desenhados aqui, nao importados de biblioteca: o brief pede design system
 * proprio, e uma dependência de ícones traria 200 símbolos para usar 8.
 *
 * Todos partem da mesma grade de 24, traço de 1.75 e cantos arredondados,
 * para que fiquem irmãos entre si em vez de parecerem recortados de fontes
 * diferentes.
 */

interface Props {
  className?: string
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconeDashboard({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="2" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
    </svg>
  )
}

export function IconeEstudar({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.75 1.75 0 0 0-1.75-1.75H5.5A1.5 1.5 0 0 1 4 15.75z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.75 1.75 0 0 1 1.75-1.75h4.75A1.5 1.5 0 0 0 20 15.75z" />
    </svg>
  )
}

export function IconeSimulados({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8.5 8.5h7M8.5 12.5h7M8.5 16.5h4" />
    </svg>
  )
}

export function IconeAnalise({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
    </svg>
  )
}

export function IconeEvolucao({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 17.5l5-5.5 3.5 3 6-7" />
      <path d="M14 8h4.5v4.5" />
      <path d="M3.5 21h17" />
    </svg>
  )
}

export function IconeConquistas({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M7.5 3.5h9v5a4.5 4.5 0 1 1-9 0z" />
      <path d="M7.5 5.5H5a2 2 0 0 0 2.5 3.8M16.5 5.5H19a2 2 0 0 1-2.5 3.8" />
      <path d="M12 13v3.5M9 20.5h6M10.5 16.5h3l.75 4h-4.5z" />
    </svg>
  )
}

export function IconePerfil({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </svg>
  )
}

export function IconeAdmin({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2.5l7.5 3v6c0 4.5-3 8.4-7.5 10-4.5-1.6-7.5-5.5-7.5-10v-6z" />
      <path d="M9.25 12l2 2 3.5-3.75" />
    </svg>
  )
}

/** Marca do produto: o Z de ZeloVet dentro de um selo. */
export function MarcaZeloVet({ className }: Props) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#F7F5F0" />
      <path
        d="M13 12.5h14l-9.5 15H27"
        fill="none"
        stroke="#0C3328"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Chama da sequencia. Substitui o emoji de fogo da v10 - mesma leitura
 * imediata, desenhada na paleta e sem depender da fonte do sistema.
 */
export function Chama({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2.5c4 4 6 7.5 6 10.5a6 6 0 0 1-12 0c0-2 1-3.7 2.7-5.3.3 2 1.3 3 2.3 3.3-1 -2.3-.6-5.3 1-8.5z"
        fill="currentColor"
      />
      <path
        d="M12 21a3 3 0 0 1-3-3c0-1.4.9-2.6 3-4.5 2.1 1.9 3 3.1 3 4.5a3 3 0 0 1-3 3z"
        fill="#F7F5F0"
        fillOpacity="0.35"
      />
    </svg>
  )
}
