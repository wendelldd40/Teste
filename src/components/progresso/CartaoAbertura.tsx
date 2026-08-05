/**
 * Cartão de abertura do dashboard.
 *
 * A v10 acertava aqui: um cartão escuro com saudação, data e a semana em
 * círculos dava leitura imediata de "estou em dia?". A v11 tinha trocado
 * isso por um retângulo branco com dois numeros - correto e sem presença.
 *
 * Esta versão recupera a estrutura da v10 e mantém as decisões do brief:
 * streak duplo (dias seguidos + meta semanal), nenhum emoji, XP fora - a
 * v11 mede constancia e acerto, nao pontos.
 */

import { Chama } from '@/components/ui/Icones'
import { tracoDoArco, RAIO_EXTERNO, RAIO_INTERNO } from './AnelProgresso'

const DIAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const
const NOMES_DIA = [
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
  'domingo',
] as const

export interface DiaDaSemana {
  /** 0 = segunda. */
  indice: number
  contou: boolean
  eHoje: boolean
  futuro: boolean
}

/**
 * Monta a faixa da semana a partir dos dias válidos.
 * Função pura: é onde erro de fuso e de índice aparece.
 */
export function montaSemana(
  diasValidos: readonly string[],
  hoje: Date = new Date()
): DiaDaSemana[] {
  const diaSemana = (hoje.getDay() + 6) % 7 // 0 = segunda
  const segunda = new Date(hoje)
  segunda.setDate(hoje.getDate() - diaSemana)

  const validos = new Set(diasValidos)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(segunda)
    d.setDate(segunda.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return {
      indice: i,
      contou: validos.has(iso),
      eHoje: i === diaSemana,
      futuro: i > diaSemana,
    }
  })
}

function dataPorExtenso(d: Date): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)
  // So a primeira letra. O `capitalize` do Tailwind subiria tambem "De" e
  // "Feira", virando "Terca-Feira, 4 De Agosto".
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

interface Props {
  nome: string
  diasSeguidos: number
  hojeContou: boolean
  questoesNaSemana: number
  metaSemanal: number
  progressoSemanal: number
  diasValidos: readonly string[]
}

export function CartaoAbertura({
  nome,
  diasSeguidos,
  hojeContou,
  questoesNaSemana,
  metaSemanal,
  progressoSemanal,
  diasValidos,
}: Props) {
  const agora = new Date()
  const hora = agora.getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const semana = montaSemana(diasValidos, agora)
  const semanal = tracoDoArco(progressoSemanal, RAIO_EXTERNO)
  const diario = tracoDoArco(Math.min(diasSeguidos, 7) / 7, RAIO_INTERNO)
  const faltam = Math.max(metaSemanal - questoesNaSemana, 0)

  return (
    <section className="relative overflow-hidden rounded-cartao bg-casca p-6 text-white shadow-cartao sm:p-7">
      {/* Textura discreta: mesma malha diagonal das capas de materia. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
        preserveAspectRatio="none"
        viewBox="0 0 400 200"
      >
        {Array.from({ length: 14 }, (_, i) => (
          <line
            key={i}
            x1={i * 40 - 200}
            y1="0"
            x2={i * 40}
            y2="200"
            stroke="#C99D66"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="font-corpo text-sm text-white/60">{saudacao},</p>
          <h1 className="mt-0.5 font-titulo text-3xl font-extrabold tracking-tight">
            {nome}
          </h1>
          <p className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 font-corpo text-xs font-medium text-white/75">
            {dataPorExtenso(agora)}
          </p>
        </div>

        {/* Anel duplo: meta semanal por fora (teal), dias por dentro (ouro). */}
        <div className="relative shrink-0">
          <svg
            viewBox="0 0 128 128"
            className="h-28 w-28 -rotate-90"
            role="img"
            aria-label={`Meta semanal em ${semanal.porcentagem} por cento. Sequência de ${diasSeguidos} ${diasSeguidos === 1 ? 'dia' : 'dias'}.`}
          >
            <circle cx="64" cy="64" r={RAIO_EXTERNO} fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="9" />
            <circle
              cx="64"
              cy="64"
              r={RAIO_EXTERNO}
              fill="none"
              stroke="#12876C"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={semanal.dasharray}
            />
            <circle cx="64" cy="64" r={RAIO_INTERNO} fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="6" />
            <circle
              cx="64"
              cy="64"
              r={RAIO_INTERNO}
              fill="none"
              stroke="#C99D66"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={diario.dasharray}
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-titulo text-2xl font-extrabold leading-none tabular-nums">
              {semanal.porcentagem}%
            </span>
            <span className="mt-0.5 font-corpo text-[10px] uppercase tracking-wide text-white/50">
              da meta
            </span>
          </span>
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-6 border-t border-white/10 pt-5">
        <div className="flex items-center gap-3">
          <Chama
            className={`h-8 w-8 shrink-0 ${diasSeguidos > 0 ? 'text-ouro' : 'text-white/25'}`}
          />
          <span>
            <span className="block font-titulo text-2xl font-extrabold leading-none tabular-nums">
              {diasSeguidos}
            </span>
            <span className="mt-0.5 block font-corpo text-xs text-white/60">
              {diasSeguidos === 0
                ? 'comece sua sequência hoje'
                : diasSeguidos === 1
                  ? 'dia seguido'
                  : 'dias seguidos'}
            </span>
          </span>
        </div>

        {/* Faixa da semana. Cada círculo é um dia; preenchido = dia válido. */}
        <ul className="flex items-center gap-2" aria-label="Dias da semana com estudo">
          {semana.map((dia, i) => (
            <li key={i} className="flex flex-col items-center gap-1.5">
              <span
                title={`${NOMES_DIA[i]}${dia.contou ? ': estudou' : dia.futuro ? '' : ': sem estudo'}`}
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                  dia.contou
                    ? 'border-ouro bg-ouro text-casca'
                    : dia.eHoje
                      ? 'border-ouro/70 border-dashed text-ouro'
                      : dia.futuro
                        ? 'border-white/15 text-white/25'
                        : 'border-white/20 text-white/35'
                }`}
              >
                {dia.contou ? <MarcaCerto /> : ''}
              </span>
              <span className="font-corpo text-[10px] font-semibold text-white/40">
                {DIAS[i]}
              </span>
            </li>
          ))}
        </ul>

        <div className="text-right">
          <span className="block font-titulo text-2xl font-extrabold leading-none tabular-nums">
            {questoesNaSemana}
          </span>
          <span className="mt-0.5 block font-corpo text-xs text-white/60">
            {faltam === 0
              ? `meta de ${metaSemanal} batida`
              : `de ${metaSemanal} questões`}
          </span>
        </div>
      </div>
    </section>
  )
}

function MarcaCerto() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M3.5 8.5l3 3 6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
