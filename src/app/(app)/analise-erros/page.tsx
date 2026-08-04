/**
 * Analise de Erros.
 *
 * A tela existe para responder uma pergunta so: onde eu devo mexer primeiro.
 * Por isso o assunto mais fraco vem antes das tabelas, e nao depois delas.
 */
import Link from 'next/link'
import { getServerClient } from '@/lib/supabase/server'
import {
  assuntoMaisFraco,
  desempenhoPorAssunto,
  desempenhoPorMateria,
} from '@/repositories/progresso.repo'
import { Cartao, Erro, Vazio } from '@/components/ui'

function porcentagem(taxa: number): string {
  return `${Math.round(taxa * 100)}%`
}

function Barra({ taxa }: { taxa: number }) {
  const pct = Math.round(Math.min(Math.max(taxa, 0), 1) * 100)
  const cor = pct >= 70 ? 'bg-acao' : pct >= 50 ? 'bg-ouro' : 'bg-red-400'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-tinta-fraca/15">
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default async function PaginaAnaliseErros() {
  const sb = await getServerClient()
  const [materias, assuntos] = await Promise.all([
    desempenhoPorMateria(sb),
    desempenhoPorAssunto(undefined, sb),
  ])

  if (!materias.ok) {
    return (
      <Erro
        mensagem="Nao foi possivel carregar seu desempenho."
        detalhe="Recarregue a pagina para tentar de novo."
      />
    )
  }

  if (materias.dados.length === 0) {
    return (
      <Vazio
        titulo="Ainda nao ha erros para analisar"
        descricao="Esta tela mostra onde voce mais erra, por materia e por assunto. Ela ganha vida depois do primeiro simulado."
        acao={
          <Link
            href="/simulados"
            className="rounded-pequeno bg-acao px-4 py-2.5 font-corpo text-sm font-semibold text-white transition-colors hover:bg-casca focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao"
          >
            Fazer o primeiro simulado
          </Link>
        }
      />
    )
  }

  const fraco = assuntos.ok ? assuntoMaisFraco(assuntos.dados) : null

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-titulo text-2xl font-extrabold text-casca">Analise de Erros</h1>
        <p className="mt-1 font-corpo text-sm text-tinta-media">
          O que aparece aqui e o seu proprio historico, nao media de turma.
        </p>
      </header>

      {fraco ? (
        <Cartao className="bg-casca text-white">
          <p className="font-corpo text-xs font-bold uppercase tracking-widest text-white/50">
            Comece por aqui
          </p>
          <p className="mt-2 font-titulo text-xl font-extrabold">{fraco.nome}</p>
          <p className="mt-1 font-corpo text-sm text-white/70">
            {porcentagem(fraco.taxa)} de acerto em {fraco.respondidas} questoes. E o seu ponto
            mais fraco entre os assuntos com historico suficiente.
          </p>
        </Cartao>
      ) : (
        <Cartao>
          <p className="font-corpo text-sm text-tinta-media">
            Ainda nao da para apontar um assunto mais fraco: nenhum tem cinco respostas. Um
            erro isolado nao e tendencia.
          </p>
        </Cartao>
      )}

      <section>
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Por materia
        </h2>
        <div className="mt-3 space-y-3">
          {materias.dados.map((m) => (
            <Cartao key={m.materia_id} className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-corpo text-sm font-semibold text-tinta-forte">{m.nome}</p>
                <p className="font-corpo text-sm tabular-nums text-tinta-media">
                  {porcentagem(m.taxa)}{' '}
                  <span className="text-xs text-tinta-fraca">
                    ({m.acertos}/{m.respondidas})
                  </span>
                </p>
              </div>
              <div className="mt-2">
                <Barra taxa={m.taxa} />
              </div>
            </Cartao>
          ))}
        </div>
      </section>

      {assuntos.ok && assuntos.dados.length > 0 && (
        <section>
          <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
            Por assunto
          </h2>
          <p className="mt-1 font-corpo text-sm text-tinta-media">
            Do mais fraco para o mais forte.
          </p>
          <div className="mt-3 space-y-2">
            {assuntos.dados.slice(0, 15).map((a) => (
              <div
                key={a.assunto_id}
                className="flex items-center gap-4 rounded-pequeno bg-cartao px-4 py-3 shadow-cartao"
              >
                <p className="min-w-0 flex-1 truncate font-corpo text-sm text-tinta-forte">
                  {a.nome}
                </p>
                <div className="w-28 shrink-0">
                  <Barra taxa={a.taxa} />
                </div>
                <p className="w-20 shrink-0 text-right font-corpo text-sm tabular-nums text-tinta-media">
                  {porcentagem(a.taxa)}
                  <span className="ml-1 text-xs text-tinta-fraca">({a.respondidas})</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
