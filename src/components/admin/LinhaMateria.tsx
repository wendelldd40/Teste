'use client'

import { useState, useTransition } from 'react'
import { Botao, Campo, Cartao, Entrada, Erro } from '@/components/ui'
import { capaFallbackDataUri } from '@/lib/imagem'
import { UploadCapa } from './UploadCapa'
import { salvarMateria } from '@/app/(app)/admin/actions'

export interface MateriaDaLista {
  id: string
  nome: string
  slug: string
  descricao: string | null
  imagem_url: string | null
  ativa: boolean
  ordem: number
}

export function LinhaMateria({ materia }: { materia: MateriaDaLista }) {
  const [aberta, setAberta] = useState(false)
  const [descricao, setDescricao] = useState(materia.descricao ?? '')
  const [ativa, setAtiva] = useState(materia.ativa)
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null)
  const [salvando, iniciar] = useTransition()

  function salvar(campos: { descricao?: string; ativa?: boolean }) {
    setErro(null)
    iniciar(async () => {
      const r = await salvarMateria(materia.id, campos)
      if (!r.ok) {
        setErro({ mensagem: r.mensagem ?? 'Nao foi possivel salvar.', detalhe: r.detalhe })
        if (campos.ativa !== undefined) setAtiva(!campos.ativa)
      }
    })
  }

  return (
    <Cartao className="p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={materia.imagem_url ?? capaFallbackDataUri(materia.nome, materia.slug)}
          alt=""
          className="h-16 w-28 shrink-0 rounded-pequeno object-cover"
        />

        <div className="min-w-48 flex-1">
          <p className="font-titulo text-base font-bold text-tinta-forte">{materia.nome}</p>
          <p className="font-corpo text-xs text-tinta-fraca">
            {materia.imagem_url ? 'Capa propria' : 'Capa provisoria'}
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={ativa}
            disabled={salvando}
            onChange={(e) => {
              setAtiva(e.target.checked)
              salvar({ ativa: e.target.checked })
            }}
            className="h-4 w-4 accent-[#12876C]"
          />
          <span className="font-corpo text-sm text-tinta-media">No ar</span>
        </label>

        <Botao variante="discreta" onClick={() => setAberta((v) => !v)}>
          {aberta ? 'Fechar' : 'Editar'}
        </Botao>
      </div>

      {aberta && (
        <div className="mt-5 grid gap-6 border-t border-tinta-fraca/15 pt-5 md:grid-cols-2">
          <div className="space-y-4">
            <Campo rotulo="Descricao" dica="Aparece no card e no topo da materia.">
              <Entrada
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Uma linha sobre o que o aluno estuda aqui"
              />
            </Campo>
            <Botao carregando={salvando} onClick={() => salvar({ descricao })}>
              Salvar descricao
            </Botao>
            {erro && <Erro mensagem={erro.mensagem} detalhe={erro.detalhe} />}
          </div>

          <UploadCapa
            materiaId={materia.id}
            nome={materia.nome}
            slug={materia.slug}
            imagemAtual={materia.imagem_url}
          />
        </div>
      )}
    </Cartao>
  )
}
