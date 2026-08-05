'use client'

/**
 * Execucao do simulado.
 *
 * Regras que a tela respeita porque o servidor as impoe:
 *   - o gabarito nao existe no cliente antes de responder. Ele chega no
 *     retorno de `responder()`, depois da resposta gravada;
 *   - a ordem das alternativas vem do banco, gravada na sessao. Nao
 *     embaralhamos aqui: sair da questao e voltar mostraria outra ordem;
 *   - sair no meio nao perde nada. A sessao continua aberta e o dashboard
 *     oferece continuar.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Botao, Cartao, Erro } from '@/components/ui'
import { finalizar, marcarPosicao, responder } from '@/repositories/simulados.repo'
import type { QuestaoNaSessao, SessaoCarregada } from '@/repositories/simulados.repo'

interface EstadoResposta {
  marcada: string | null
  corretaId: string | null
  acertou: boolean | null
  comentario: string | null
}

const VAZIO: EstadoResposta = { marcada: null, corretaId: null, acertou: null, comentario: null }

export function ExecucaoSimulado({ inicial }: { inicial: SessaoCarregada }) {
  const router = useRouter()
  const { sessao, questoes } = inicial

  const [indice, setIndice] = useState(
    Math.min(sessao.indice_atual, Math.max(questoes.length - 1, 0))
  )
  const [resposta, setResposta] = useState<EstadoResposta>(VAZIO)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null)
  const [inicioQuestao, setInicioQuestao] = useState(() => Date.now())

  const atual: QuestaoNaSessao | undefined = questoes[indice]
  const ultima = indice === questoes.length - 1

  useEffect(() => {
    setResposta(VAZIO)
    setInicioQuestao(Date.now())
    void marcarPosicao(sessao.id, indice)
  }, [indice, sessao.id])

  if (!atual) {
    return (
      <Erro
        mensagem="Esta sessão não tem questões."
        detalhe="Volte para Simulados e monte um novo."
      />
    )
  }

  async function confirmar(alternativaId: string) {
    if (resposta.acertou !== null || enviando || !atual) return

    setEnviando(true)
    setErro(null)

    const segundos = Math.round((Date.now() - inicioQuestao) / 1000)
    const r = await responder(sessao.id, atual.questao.id, alternativaId, segundos)

    if (!r.ok) {
      setErro({ mensagem: r.erro.message, detalhe: r.erro.detalhe })
      setEnviando(false)
      return
    }

    setResposta({
      marcada: alternativaId,
      corretaId: r.dados.alternativa_correta_id,
      acertou: r.dados.acertou,
      comentario: r.dados.comentario,
    })
    setEnviando(false)
  }

  async function avancar() {
    if (!ultima) {
      setIndice((i) => i + 1)
      return
    }
    setEnviando(true)
    const r = await finalizar(sessao.id)
    if (!r.ok) {
      setErro({ mensagem: r.erro.message, detalhe: r.erro.detalhe })
      setEnviando(false)
      return
    }
    router.push(`/simulados/${sessao.id}/resultado`)
  }

  const respondida = resposta.acertou !== null
  const progresso = ((indice + (respondida ? 1 : 0)) / questoes.length) * 100

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between">
          <p className="font-corpo text-sm font-semibold text-tinta-forte">
            Questão {indice + 1} de {questoes.length}
          </p>
          <p className="font-corpo text-xs text-tinta-fraca">
            {atual.questao.dificuldade === 'facil' && 'Fácil'}
            {atual.questao.dificuldade === 'medio' && 'Médio'}
            {atual.questao.dificuldade === 'dificil' && 'Difícil'}
          </p>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-tinta-fraca/20"
          role="progressbar"
          aria-valuenow={Math.round(progresso)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso do simulado"
        >
          <div
            className="h-full rounded-full bg-acao transition-[width] duration-300"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>

      <Cartao className="space-y-5">
        <p className="font-corpo text-base leading-relaxed text-tinta-forte">
          {atual.questao.enunciado}
        </p>

        {atual.questao.assertivas.length > 0 && (
          <div className="rounded-pequeno bg-creme p-4">
            <p className="font-corpo text-xs font-bold uppercase tracking-wide text-tinta-fraca">
              Assertivas
            </p>
            <ul className="mt-2 space-y-2">
              {atual.questao.assertivas.map((a) => (
                <li key={a.id} className="font-corpo text-sm leading-relaxed text-tinta-media">
                  <span className="font-semibold text-tinta-forte">{a.numeral}.</span> {a.texto}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="space-y-2">
          {atual.alternativasOrdenadas.map((alt, i) => {
            const letra = String.fromCharCode(65 + i)
            const marcada = resposta.marcada === alt.id
            const ehCorreta = respondida && resposta.corretaId === alt.id
            const erradaMarcada = respondida && marcada && !resposta.acertou

            let estilo = 'border-tinta-fraca/25 hover:border-acao'
            if (ehCorreta) estilo = 'border-acao bg-acao/10'
            else if (erradaMarcada) estilo = 'border-red-300 bg-red-50'
            else if (respondida) estilo = 'border-tinta-fraca/15 opacity-60'

            return (
              <li key={alt.id}>
                <button
                  type="button"
                  disabled={respondida || enviando}
                  onClick={() => void confirmar(alt.id)}
                  className={`flex w-full items-start gap-3 rounded-pequeno border-2 bg-cartao p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao disabled:cursor-default ${estilo}`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-creme font-corpo text-xs font-bold text-tinta-media">
                    {letra}
                  </span>
                  <span className="font-corpo text-sm leading-relaxed text-tinta-forte">
                    {alt.texto}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {respondida && (
          <div
            className={`rounded-pequeno p-4 ${resposta.acertou ? 'bg-acao/10' : 'bg-ouro/15'}`}
          >
            <p
              className={`font-titulo text-sm font-bold ${resposta.acertou ? 'text-acao' : 'text-ouro-tinta'}`}
            >
              {resposta.acertou ? 'Você acertou.' : 'Resposta errada.'}
            </p>
            {resposta.comentario && (
              <p className="mt-1.5 font-corpo text-sm leading-relaxed text-tinta-media">
                {resposta.comentario}
              </p>
            )}
          </div>
        )}

        {erro && <Erro mensagem={erro.mensagem} detalhe={erro.detalhe} />}
      </Cartao>

      <div className="flex items-center justify-between gap-3">
        <p className="font-corpo text-xs text-tinta-fraca">
          Pode sair a hora que quiser. A sessao fica salva.
        </p>
        <Botao disabled={!respondida} carregando={enviando} onClick={() => void avancar()}>
          {ultima ? 'Ver resultado' : 'Próxima questão'}
        </Botao>
      </div>
    </div>
  )
}
