/**
 * Evolucao: historico, curva de acerto e constancia da semana.
 */
import Link from 'next/link'
import { getServerClient } from '@/lib/supabase/server'
import { requireUsuario } from '@/lib/auth/guards'
import {
  atividade,
  evolucaoSemanal,
  maisConstantesDaSemana,
  resumoStreak,
} from '@/repositories/progresso.repo'
import { GraficoAcerto } from '@/components/progresso/GraficoAcerto'
import { OptInDestaques } from '@/components/progresso/OptInDestaques'
import { Cartao, Erro, Indicador, Vazio } from '@/components/ui'

export default async function PaginaEvolucao() {
  const usuario = await requireUsuario()
  const sb = await getServerClient()

  const [serie, dias, streak, constantes] = await Promise.all([
    evolucaoSemanal(12, sb),
    atividade(60, sb),
    resumoStreak(sb),
    maisConstantesDaSemana(5, sb),
  ])

  if (!serie.ok) {
    return (
      <Erro
        mensagem="Nao foi possivel carregar sua evolucao."
        detalhe="Recarregue a pagina para tentar de novo."
      />
    )
  }

  const totalRespondidas = dias.ok
    ? dias.dados.reduce((s, d) => s + d.questoes_respondidas, 0)
    : 0
  const diasEstudados = dias.ok ? dias.dados.filter((d) => d.conta_streak).length : 0

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-titulo text-2xl font-extrabold text-casca">Evolucao</h1>
        <p className="mt-1 font-corpo text-sm text-tinta-media">
          Como seu acerto se move ao longo das semanas.
        </p>
      </header>

      {serie.dados.length === 0 ? (
        <Vazio
          titulo="A curva comeca no primeiro simulado"
          descricao="Cada semana com questoes respondidas vira um ponto aqui."
          acao={
            <Link
              href="/simulados"
              className="rounded-pequeno bg-acao px-4 py-2.5 font-corpo text-sm font-semibold text-white transition-colors hover:bg-casca focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao"
            >
              Comecar agora
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Indicador valor={totalRespondidas} rotulo="Questoes em 60 dias" />
            <Indicador valor={diasEstudados} rotulo="Dias estudados" />
            <Indicador
              valor={streak.ok ? streak.dados.recorde : 0}
              rotulo="Maior sequencia"
              destaque
            />
          </div>

          <Cartao>
            <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
              Acerto por semana
            </h2>
            <div className="mt-4">
              <GraficoAcerto
                serie={serie.dados.map((p) => ({
                  semana: p.semana,
                  taxa: Number(p.taxa ?? 0),
                  respondidas: p.respondidas,
                }))}
              />
            </div>
          </Cartao>
        </>
      )}

      <Cartao>
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Mais constantes da semana
        </h2>
        <p className="mt-1 font-corpo text-sm text-tinta-media">
          Nao e placar de pontos: e quem manteve os dias de estudo.
        </p>

        {constantes.ok && constantes.dados.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {constantes.dados.map((c) => (
              <li
                key={c.usuario_id}
                className={`flex items-center justify-between gap-3 rounded-pequeno px-3 py-2.5 ${
                  c.sou_eu ? 'bg-acao/10' : 'bg-creme'
                }`}
              >
                <span className="min-w-0 truncate font-corpo text-sm font-semibold text-tinta-forte">
                  {c.nome}
                  {c.sou_eu && (
                    <span className="ml-2 font-corpo text-xs font-normal text-acao">voce</span>
                  )}
                </span>
                <span className="shrink-0 font-corpo text-sm tabular-nums text-tinta-media">
                  {c.dias_validos} {c.dias_validos === 1 ? 'dia' : 'dias'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 font-corpo text-sm text-tinta-fraca">
            Ninguem escolheu aparecer aqui ainda. A lista so mostra quem ligou a opcao
            abaixo.
          </p>
        )}

        <OptInDestaques usuarioId={usuario.id} inicial={usuario.mostrar_em_destaques} />
      </Cartao>
    </div>
  )
}
