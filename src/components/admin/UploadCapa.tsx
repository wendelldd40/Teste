'use client'

/**
 * Upload da capa da materia.
 *
 * O corte 16:9 acontece no navegador antes de subir: o admin escolhe
 * qualquer foto e o arquivo que chega ao Storage ja esta na proporcao certa,
 * em WebP, com menos de um decimo do tamanho original. Sem isso, ou a capa
 * distorce no card ou alguem precisa cortar a mao toda vez.
 */

import { useRef, useState } from 'react'
import { Botao, Erro } from '@/components/ui'
import {
  capaFallbackDataUri,
  caminhoImagem,
  prepararImagem,
} from '@/lib/imagem'
import { salvarImagemMateria } from '@/app/(app)/admin/actions'

interface Props {
  materiaId: string
  nome: string
  slug: string
  imagemAtual: string | null
}

export function UploadCapa({ materiaId, nome, slug, imagemAtual }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [previa, setPrevia] = useState<string | null>(imagemAtual)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null)

  const usandoFallback = previa === null

  async function aoEscolher(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    setEnviando(true)

    try {
      const cortada = await prepararImagem(arquivo)
      const urlLocal = URL.createObjectURL(cortada)
      setPrevia(urlLocal)

      const caminho = caminhoImagem(slug)
      const comoArquivo = new File([cortada], caminho.split('/').pop() ?? 'capa.webp', {
        type: 'image/webp',
      })

      const r = await salvarImagemMateria(materiaId, caminho, comoArquivo, nome)
      if (!r.ok) {
        setErro({ mensagem: r.mensagem ?? 'Nao foi possivel salvar a capa.', detalhe: r.detalhe })
        setPrevia(imagemAtual)
        return
      }
      if (r.id) setPrevia(r.id)
    } catch (e) {
      setErro({
        mensagem: 'Nao foi possivel preparar a imagem.',
        detalhe: e instanceof Error ? e.message : undefined,
      })
      setPrevia(imagemAtual)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-pequeno border border-tinta-fraca/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previa ?? capaFallbackDataUri(nome, slug)}
          alt={usandoFallback ? `Capa provisoria de ${nome}` : `Capa de ${nome}`}
          className="aspect-video w-full object-cover"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void aoEscolher(e.target.files?.[0])}
        />
        <Botao
          type="button"
          variante="secundaria"
          carregando={enviando}
          onClick={() => input.current?.click()}
        >
          {usandoFallback ? 'Adicionar capa' : 'Trocar capa'}
        </Botao>
        <span className="font-corpo text-xs text-tinta-fraca">
          {usandoFallback
            ? 'Sem capa: o card usa a arte provisoria acima.'
            : 'A imagem e cortada em 16:9 automaticamente.'}
        </span>
      </div>

      {erro && <Erro mensagem={erro.mensagem} detalhe={erro.detalhe} />}
    </div>
  )
}
