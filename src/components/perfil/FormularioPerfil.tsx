'use client'

import { useState, useTransition } from 'react'
import { Botao, Campo, Cartao, Entrada, Erro } from '@/components/ui'
import { definirMetaSemanal, definirDestaques } from '@/repositories/progresso.repo'
import { getBrowserClient } from '@/lib/supabase/client'
import { normalizaErro } from '@/lib/errors'

interface Props {
  usuarioId: string
  nome: string
  metaSemanal: number
  minimoDiario: number
  mostrarEmDestaques: boolean
}

export function FormularioPerfil({
  usuarioId,
  nome: nomeInicial,
  metaSemanal: metaInicial,
  minimoDiario,
  mostrarEmDestaques,
}: Props) {
  const [nome, setNome] = useState(nomeInicial)
  const [meta, setMeta] = useState(String(metaInicial))
  const [destaques, setDestaques] = useState(mostrarEmDestaques)
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function salvar() {
    setErro(null)
    setAviso(null)

    const valor = Number(meta)
    if (!Number.isInteger(valor) || valor < 5 || valor > 2000) {
      setErro({
        mensagem: 'Meta semanal invalida.',
        detalhe: 'Escolha um numero inteiro entre 5 e 2000.',
      })
      return
    }

    iniciar(async () => {
      try {
        const sb = getBrowserClient()
        const { error } = await sb
          .from('usuarios')
          .update({ nome: nome.trim() })
          .eq('id', usuarioId)
        if (error) throw error

        const r = await definirMetaSemanal(usuarioId, valor)
        if (!r.ok) {
          setErro({ mensagem: r.erro.message, detalhe: r.erro.detalhe })
          return
        }
        setAviso('Perfil salvo.')
      } catch (e) {
        const n = normalizaErro(e, 'perfil.salvar')
        setErro({ mensagem: n.message, detalhe: n.detalhe })
      }
    })
  }

  function alternarDestaques(valor: boolean) {
    setDestaques(valor)
    iniciar(async () => {
      const r = await definirDestaques(usuarioId, valor)
      if (!r.ok) {
        setDestaques(!valor)
        setErro({ mensagem: r.erro.message, detalhe: r.erro.detalhe })
      }
    })
  }

  return (
    <Cartao className="space-y-5">
      <Campo rotulo="Nome">
        <Entrada value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
      </Campo>

      <Campo
        rotulo="Meta semanal de questoes"
        dica={`O dia so conta para a sequencia com ${minimoDiario} questoes ou mais.`}
      >
        <Entrada
          type="number"
          min={5}
          max={2000}
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
          className="w-32"
        />
      </Campo>

      <label className="flex cursor-pointer items-start gap-3 border-t border-tinta-fraca/15 pt-4">
        <input
          type="checkbox"
          checked={destaques}
          disabled={salvando}
          onChange={(e) => alternarDestaques(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#12876C]"
        />
        <span>
          <span className="font-corpo text-sm font-semibold text-tinta-forte">
            Aparecer nos destaques da semana
          </span>
          <span className="mt-0.5 block font-corpo text-xs text-tinta-fraca">
            Seu nome e seus dias de estudo ficam visiveis para os outros alunos em
            Evolucao. Desligado por padrao.
          </span>
        </span>
      </label>

      {erro && <Erro mensagem={erro.mensagem} detalhe={erro.detalhe} />}
      {aviso && (
        <p role="status" className="font-corpo text-sm font-semibold text-acao">
          {aviso}
        </p>
      )}

      <Botao carregando={salvando} onClick={salvar}>
        Salvar alteracoes
      </Botao>
    </Cartao>
  )
}
