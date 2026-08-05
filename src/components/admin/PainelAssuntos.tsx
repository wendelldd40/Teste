'use client'

import { useState, useTransition } from 'react'
import { Botao, Cartao, Entrada, Erro, Selecao } from '@/components/ui'
import { removerAssunto, salvarAssunto } from '@/app/(app)/admin/actions'

export interface AssuntoDaLista {
  id: string
  materia_id: string
  parent_id: string | null
  nome: string
  slug: string
  ordem: number
}

/** Mesmo slug do resto do sistema: sem acento, minusculo, com hifen. */
export function paraSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

interface No extends AssuntoDaLista {
  filhos: No[]
}

function montarArvore(lista: readonly AssuntoDaLista[]): No[] {
  const nos = new Map(lista.map((a) => [a.id, { ...a, filhos: [] as No[] }]))
  const raizes: No[] = []
  for (const a of lista) {
    const no = nos.get(a.id)!
    const pai = a.parent_id ? nos.get(a.parent_id) : undefined
    if (pai) pai.filhos.push(no)
    else raizes.push(no)
  }
  return raizes
}

export function PainelAssuntos({
  materia,
  assuntos,
}: {
  materia: { id: string; nome: string; slug: string }
  assuntos: AssuntoDaLista[]
}) {
  const [lista, setLista] = useState(assuntos)
  const [nome, setNome] = useState('')
  const [paiId, setPaiId] = useState('')
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null)
  const [processando, iniciar] = useTransition()

  const arvore = montarArvore(lista)

  function adicionar() {
    const limpo = nome.trim()
    if (!limpo) return
    setErro(null)

    iniciar(async () => {
      const slug = paraSlug(limpo)
      const r = await salvarAssunto({
        materia_id: materia.id,
        nome: limpo,
        slug,
        parent_id: paiId || null,
        ordem: lista.length,
      })
      if (!r.ok) {
        setErro({
          mensagem: r.mensagem ?? 'Não foi possível criar o assunto.',
          detalhe:
            r.mensagem?.includes('já existe')
              ? `Ja existe um assunto com o endereco "${slug}" nesta materia.`
              : r.detalhe,
        })
        return
      }
      setLista((atual) => [
        ...atual,
        {
          id: r.id ?? crypto.randomUUID(),
          materia_id: materia.id,
          parent_id: paiId || null,
          nome: limpo,
          slug,
          ordem: atual.length,
        },
      ])
      setNome('')
      setPaiId('')
    })
  }

  function remover(id: string) {
    setErro(null)
    iniciar(async () => {
      const r = await removerAssunto(id)
      if (!r.ok) {
        setErro({ mensagem: r.mensagem ?? 'Não foi possível remover.', detalhe: r.detalhe })
        return
      }
      // Remove o assunto e os filhos dele, que o banco derruba em cascata.
      const paraRemover = new Set([id])
      let mudou = true
      while (mudou) {
        mudou = false
        for (const a of lista) {
          if (a.parent_id && paraRemover.has(a.parent_id) && !paraRemover.has(a.id)) {
            paraRemover.add(a.id)
            mudou = true
          }
        }
      }
      setLista((atual) => atual.filter((a) => !paraRemover.has(a.id)))
    })
  }

  function renderizar(nos: No[], nivel = 0) {
    return nos.map((no) => (
      <div key={no.id}>
        <div
          className="flex items-center justify-between gap-3 border-b border-tinta-fraca/10 py-2"
          style={{ paddingLeft: `${nivel * 20}px` }}
        >
          <div className="min-w-0">
            <p className="truncate font-corpo text-sm font-semibold text-tinta-forte">
              {no.nome}
            </p>
            <p className="truncate font-corpo text-xs text-tinta-fraca">{no.slug}</p>
          </div>
          <Botao variante="perigo" disabled={processando} onClick={() => remover(no.id)}>
            Remover
          </Botao>
        </div>
        {no.filhos.length > 0 && renderizar(no.filhos, nivel + 1)}
      </div>
    ))
  }

  return (
    <Cartao>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-titulo text-base font-bold text-casca">{materia.nome}</h3>
        <span className="font-corpo text-xs text-tinta-fraca">
          {lista.length} {lista.length === 1 ? 'assunto' : 'assuntos'}
        </span>
      </div>

      <div className="mt-4">
        {arvore.length > 0 ? (
          renderizar(arvore)
        ) : (
          <p className="py-3 font-corpo text-sm text-tinta-media">
            Nenhum assunto ainda. Crie o primeiro abaixo.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Entrada
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do assunto"
            onKeyDown={(e) => {
              if (e.key === 'Enter') adicionar()
            }}
          />
        </div>
        <Selecao
          value={paiId}
          onChange={(e) => setPaiId(e.target.value)}
          className="w-52"
          aria-label="Assunto pai"
        >
          <option value="">Sem assunto pai</option>
          {lista.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </Selecao>
        <Botao carregando={processando} onClick={adicionar}>
          Adicionar
        </Botao>
      </div>

      {erro && (
        <div className="mt-3">
          <Erro mensagem={erro.mensagem} detalhe={erro.detalhe} />
        </div>
      )}
    </Cartao>
  )
}
