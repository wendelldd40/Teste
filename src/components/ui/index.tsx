/**
 * Design system proprio. Sem biblioteca de UI pronta - decisao do brief.
 * Toda cor vem dos tokens do Tailwind; nenhum hex aparece aqui.
 */
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type Variante = 'primaria' | 'secundaria' | 'discreta' | 'perigo'

const VARIANTES: Record<Variante, string> = {
  primaria: 'bg-ação text-white hover:bg-casca',
  secundaria: 'bg-cartao text-tinta-forte border border-tinta-fraca/30 hover:border-acao',
  discreta: 'bg-transparent text-tinta-media hover:text-ação',
  perigo: 'bg-cartao text-red-700 border border-red-200 hover:bg-red-50',
}

export function Botao({
  variante = 'primaria',
  carregando = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  carregando?: boolean
}) {
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      className={`inline-flex items-center justify-center gap-2 rounded-pequeno px-4 py-2.5 font-corpo text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    >
      {carregando ? 'Salvando...' : children}
    </button>
  )
}

export function Cartao({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-cartao bg-cartao p-5 shadow-cartao ${className}`}>{children}</div>
  )
}

export function Campo({
  rotulo,
  dica,
  erro,
  children,
}: {
  rotulo: string
  dica?: string
  erro?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="font-corpo text-sm font-semibold text-tinta-forte">{rotulo}</span>
      {dica && <span className="mt-0.5 block font-corpo text-xs text-tinta-fraca">{dica}</span>}
      <div className="mt-1.5">{children}</div>
      {erro && <span className="mt-1 block font-corpo text-xs text-red-700">{erro}</span>}
    </label>
  )
}

const ESTILO_ENTRADA =
  'w-full rounded-pequeno border border-tinta-fraca/30 bg-cartao px-3 py-2 font-corpo text-sm text-tinta-forte outline-none transition-colors placeholder:text-tinta-fraca focus:border-acao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-acao'

export function Entrada({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${ESTILO_ENTRADA} ${className}`} />
}

export function AreaTexto({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${ESTILO_ENTRADA} min-h-24 resize-y ${className}`} />
}

export function Selecao({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${ESTILO_ENTRADA} ${className}`} />
}

const TONS = {
  publicada: 'bg-acao/10 text-acao',
  precisa_revisao: 'bg-ouro/25 text-ouro-tinta',
  rascunho: 'bg-tinta-fraca/15 text-tinta-media',
  arquivada: 'bg-tinta-fraca/10 text-tinta-fraca',
} as const

const ROTULOS = {
  publicada: 'Publicada',
  precisa_revisao: 'Precisa revisão',
  rascunho: 'Rascunho',
  arquivada: 'Arquivada',
} as const

export function Selo({ status }: { status: keyof typeof TONS }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-corpo text-xs font-semibold ${TONS[status]}`}
    >
      {ROTULOS[status]}
    </span>
  )
}

/** Estado vazio como convite a agir, nao como aviso de falta. */
export function Vazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao: string
  acao?: ReactNode
}) {
  return (
    <div className="rounded-cartao border border-dashed border-tinta-fraca/40 bg-cartao/60 p-10 text-center">
      <p className="font-titulo text-lg font-bold text-tinta-forte">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md font-corpo text-sm text-tinta-media">{descricao}</p>
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  )
}

/** Erro diz o que aconteceu e o que fazer. Nao pede desculpa e nao e vago. */
export function Erro({ mensagem, detalhe }: { mensagem: string; detalhe?: string }) {
  return (
    <div role="alert" className="rounded-pequeno border border-red-200 bg-red-50 px-4 py-3">
      <p className="font-corpo text-sm font-semibold text-red-800">{mensagem}</p>
      {detalhe && <p className="mt-1 font-corpo text-xs text-red-700">{detalhe}</p>}
    </div>
  )
}

/** Numero grande com rotulo pequeno. Usado no resumo do admin. */
export function Indicador({
  valor,
  rotulo,
  destaque = false,
}: {
  valor: number | string
  rotulo: string
  destaque?: boolean
}) {
  return (
    <div className="rounded-cartao bg-cartao p-4 shadow-cartao">
      <p
        className={`font-titulo text-3xl font-extrabold tabular-nums ${destaque ? 'text-ouro' : 'text-casca'}`}
      >
        {valor}
      </p>
      <p className="mt-1 font-corpo text-xs font-medium uppercase tracking-wide text-tinta-fraca">
        {rotulo}
      </p>
    </div>
  )
}
