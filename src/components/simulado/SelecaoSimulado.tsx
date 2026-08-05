'use client'

/**
 * Selecao do simulado. Tres escopos, como o repositorio suporta: uma materia,
 * um assunto ou geral.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Botao, Cartao, Erro, Selecao } from '@/components/ui'
import { montar } from '@/repositories/simulados.repo'
import type { EscopoSimulado } from '@/types/database'

export interface MateriaSelecionavel {
  id: string
  nome: string
  assuntos: Array<{ id: string; nome: string }>
}

const QUANTIDADES = [10, 20, 30, 50]

export function SelecaoSimulado({
  usuarioId,
  materias,
}: {
  usuarioId: string
  materias: MateriaSelecionavel[]
}) {
  const router = useRouter()
  const [escopo, setEscopo] = useState<EscopoSimulado>('materia')
  const [materiaId, setMateriaId] = useState(materias[0]?.id ?? '')
  const [assuntoId, setAssuntoId] = useState('')
  const [quantidade, setQuantidade] = useState(20)
  const [montando, setMontando] = useState(false)
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null)

  const assuntos = materias.find((m) => m.id === materiaId)?.assuntos ?? []

  async function comecar() {
    setMontando(true)
    setErro(null)

    const r = await montar(usuarioId, {
      escopo,
      quantidade,
      materiaId: escopo === 'geral' ? undefined : materiaId,
      assuntoIds: escopo === 'assunto' && assuntoId ? [assuntoId] : undefined,
    })

    if (!r.ok) {
      setErro({ mensagem: r.erro.message, detalhe: r.erro.detalhe })
      setMontando(false)
      return
    }
    router.push(`/simulados/${r.dados.sessao.id}`)
  }

  return (
    <Cartao className="space-y-5">
      <div>
        <p className="font-corpo text-sm font-semibold text-tinta-forte">Sobre o que</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ['materia', 'Uma matéria'],
              ['assunto', 'Um assunto'],
              ['geral', 'Tudo misturado'],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setEscopo(valor)}
              aria-pressed={escopo === valor}
              className={`rounded-pequeno border-2 px-4 py-2 font-corpo text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao ${
                escopo === valor
                  ? 'border-acao bg-acao/10 text-acao'
                  : 'border-tinta-fraca/25 text-tinta-media hover:border-acao'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {escopo !== 'geral' && (
        <label className="block">
          <span className="font-corpo text-sm font-semibold text-tinta-forte">Matéria</span>
          <Selecao
            value={materiaId}
            onChange={(e) => {
              setMateriaId(e.target.value)
              setAssuntoId('')
            }}
            className="mt-1.5"
          >
            {materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Selecao>
        </label>
      )}

      {escopo === 'assunto' && (
        <label className="block">
          <span className="font-corpo text-sm font-semibold text-tinta-forte">Assunto</span>
          <Selecao
            value={assuntoId}
            onChange={(e) => setAssuntoId(e.target.value)}
            className="mt-1.5"
          >
            <option value="">Escolha um assunto</option>
            {assuntos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </Selecao>
        </label>
      )}

      <div>
        <p className="font-corpo text-sm font-semibold text-tinta-forte">Quantas questões</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUANTIDADES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuantidade(q)}
              aria-pressed={quantidade === q}
              className={`w-16 rounded-pequeno border-2 py-2 font-corpo text-sm font-bold tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao ${
                quantidade === q
                  ? 'border-acao bg-acao/10 text-acao'
                  : 'border-tinta-fraca/25 text-tinta-media hover:border-acao'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {erro && <Erro mensagem={erro.mensagem} detalhe={erro.detalhe} />}

      <Botao
        carregando={montando}
        disabled={escopo === 'assunto' && !assuntoId}
        onClick={() => void comecar()}
      >
        Comecar simulado
      </Botao>
    </Cartao>
  )
}
