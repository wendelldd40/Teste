/**
 * Anel de progresso duplo.
 *
 * O brief pede streak duplo: dias seguidos E meta semanal de questoes. Em vez
 * de dois numeros soltos, um anel de dois arcos concentricos - a meta semanal
 * por fora (teal), os dias da semana por dentro (dourado). O que da para ler
 * de longe e o quanto falta, nao o valor exato.
 *
 * A matematica fica fora do componente porque e onde erro aparece: arco que
 * passa de uma volta, divisao por zero em meta zerada, valor negativo.
 */

export const RAIO_EXTERNO = 54
export const RAIO_INTERNO = 40
const ESPESSURA = 10

export function circunferencia(raio: number): number {
  return 2 * Math.PI * raio
}

/**
 * Traco do arco para um progresso de 0 a 1.
 * Entrada fora da faixa e presa nos limites: 1,4 nao vira uma volta e meia.
 */
export function tracoDoArco(
  progresso: number,
  raio: number
): { dasharray: string; porcentagem: number } {
  // NaN vira zero (dado ausente). Infinity vira volta cheia (muito acima da
  // meta) - tratar os dois igual mostraria anel vazio para quem passou da
  // meta com denominador zerado.
  let limitado: number
  if (Number.isNaN(progresso)) limitado = 0
  else if (progresso === Infinity) limitado = 1
  else limitado = Math.min(Math.max(progresso, 0), 1)

  const c = circunferencia(raio)
  return {
    dasharray: `${(c * limitado).toFixed(2)} ${c.toFixed(2)}`,
    porcentagem: Math.round(limitado * 100),
  }
}

interface Props {
  diasSeguidos: number
  hojeContou: boolean
  questoesNaSemana: number
  metaSemanal: number
  progressoSemanal: number
}

export function AnelProgresso({
  diasSeguidos,
  hojeContou,
  questoesNaSemana,
  metaSemanal,
  progressoSemanal,
}: Props) {
  const semanal = tracoDoArco(progressoSemanal, RAIO_EXTERNO)
  // Anel interno: quanto da semana ja foi marcado como dia valido, ate 7.
  const diario = tracoDoArco(Math.min(diasSeguidos, 7) / 7, RAIO_INTERNO)

  const descricao = `Meta semanal em ${semanal.porcentagem} por cento, ${questoesNaSemana} de ${metaSemanal} questoes. Sequencia de ${diasSeguidos} ${diasSeguidos === 1 ? 'dia' : 'dias'}.`

  return (
    <div className="flex items-center gap-5">
      <svg
        viewBox="0 0 128 128"
        className="h-32 w-32 shrink-0 -rotate-90"
        role="img"
        aria-label={descricao}
      >
        <circle
          cx="64"
          cy="64"
          r={RAIO_EXTERNO}
          fill="none"
          stroke="#12876C"
          strokeOpacity="0.15"
          strokeWidth={ESPESSURA}
        />
        <circle
          cx="64"
          cy="64"
          r={RAIO_EXTERNO}
          fill="none"
          stroke="#12876C"
          strokeWidth={ESPESSURA}
          strokeLinecap="round"
          strokeDasharray={semanal.dasharray}
        />
        <circle
          cx="64"
          cy="64"
          r={RAIO_INTERNO}
          fill="none"
          stroke="#C99D66"
          strokeOpacity="0.2"
          strokeWidth={ESPESSURA - 3}
        />
        <circle
          cx="64"
          cy="64"
          r={RAIO_INTERNO}
          fill="none"
          stroke="#C99D66"
          strokeWidth={ESPESSURA - 3}
          strokeLinecap="round"
          strokeDasharray={diario.dasharray}
        />
      </svg>

      <div>
        <p className="font-titulo text-4xl font-extrabold leading-none tabular-nums text-casca">
          {diasSeguidos}
          <span className="ml-1.5 font-corpo text-sm font-semibold text-tinta-fraca">
            {diasSeguidos === 1 ? 'dia seguido' : 'dias seguidos'}
          </span>
        </p>
        <p className="mt-2 font-corpo text-sm text-tinta-media">
          <span className="font-semibold tabular-nums text-tinta-forte">
            {questoesNaSemana}
          </span>{' '}
          de {metaSemanal} questões na semana
        </p>
        <p className="mt-1 font-corpo text-xs text-tinta-fraca">
          {hojeContou
            ? 'Hoje já conta para a sequência.'
            : 'Hoje ainda não conta. Faltam questões para fechar o dia.'}
        </p>
      </div>
    </div>
  )
}
