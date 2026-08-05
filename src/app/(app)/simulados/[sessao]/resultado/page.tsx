/**
 * Resultado. O gabarito completo so existe aqui: a RPC resultado_sessao
 * responde apenas com a sessao encerrada.
 */
import Link from 'next/link'
import { getServerClient } from '@/lib/supabase/server'
import { resultado } from '@/repositories/simulados.repo'
import { Cartao, Erro, Indicador } from '@/components/ui'

export default async function PaginaResultado({
  params,
}: {
  params: Promise<{ sessao: string }>
}) {
  const { sessao: sessaoId } = await params
  const sb = await getServerClient()

  const r = await resultado(sessaoId, sb)
  if (!r.ok || r.dados.length === 0) {
    return (
      <Erro
        mensagem="Este resultado ainda não está disponível."
        detalhe="O resultado aparece depois que o simulado e finalizado."
      />
    )
  }

  const total = r.dados.length
  const acertos = r.dados.filter((l) => l.acertou).length
  const taxa = Math.round((acertos / total) * 100)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-titulo text-2xl font-extrabold text-casca">Resultado</h1>
        <p className="mt-1 font-corpo text-sm text-tinta-media">
          {taxa >= 70
            ? 'Bom desempenho. Vale olhar só o que escapou.'
            : 'Os erros abaixo são o material de estudo mais util que você tem agora.'}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Indicador valor={`${taxa}%`} rotulo="Acerto" destaque={taxa >= 70} />
        <Indicador valor={acertos} rotulo="Acertos" />
        <Indicador valor={total - acertos} rotulo="Erros" />
      </div>

      <section className="space-y-3">
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Questao a questao
        </h2>
        {r.dados.map((linha) => (
          <Cartao key={linha.questao_id} className="p-4">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-corpo text-xs font-bold ${
                  linha.acertou ? 'bg-acao/15 text-acao' : 'bg-red-100 text-red-700'
                }`}
              >
                {linha.ordem}
              </span>
              <div className="min-w-0">
                <p className="font-corpo text-sm leading-relaxed text-tinta-forte">
                  {linha.enunciado}
                </p>
                {!linha.acertou && linha.comentario && (
                  <p className="mt-2 font-corpo text-sm leading-relaxed text-tinta-media">
                    {linha.comentario}
                  </p>
                )}
              </div>
            </div>
          </Cartao>
        ))}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/simulados"
          className="rounded-pequeno bg-acao px-4 py-2.5 font-corpo text-sm font-semibold text-white transition-colors hover:bg-casca focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao"
        >
          Fazer outro simulado
        </Link>
        <Link
          href="/analise-erros"
          className="rounded-pequeno border border-tinta-fraca/30 px-4 py-2.5 font-corpo text-sm font-semibold text-tinta-forte transition-colors hover:border-acao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao"
        >
          Ver onde estou errando
        </Link>
      </div>
    </div>
  )
}
