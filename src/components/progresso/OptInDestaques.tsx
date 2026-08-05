'use client'

/**
 * Controle do opt-in de destaques.
 *
 * Fica junto do bloco de constancia, nao escondido nas configuracoes: quem ve
 * a lista e quem decide se quer estar nela. O padrao e desligado.
 */
import { useState, useTransition } from 'react'
import { Erro } from '@/components/ui'
import { definirDestaques } from '@/repositories/progresso.repo'

export function OptInDestaques({
  usuarioId,
  inicial,
}: {
  usuarioId: string
  inicial: boolean
}) {
  const [ligado, setLigado] = useState(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function alternar(valor: boolean) {
    setLigado(valor)
    setErro(null)
    iniciar(async () => {
      const r = await definirDestaques(usuarioId, valor)
      if (!r.ok) {
        setLigado(!valor)
        setErro(r.erro.message)
      }
    })
  }

  return (
    <div className="mt-4 border-t border-tinta-fraca/15 pt-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={ligado}
          disabled={salvando}
          onChange={(e) => alternar(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#12876C]"
        />
        <span>
          <span className="font-corpo text-sm font-semibold text-tinta-forte">
            Aparecer nesta lista
          </span>
          <span className="mt-0.5 block font-corpo text-xs text-tinta-fraca">
            Seu nome e seus dias de estudo ficam visíveis para os outros alunos. Pode
            desligar quando quiser.
          </span>
        </span>
      </label>
      {erro && (
        <div className="mt-2">
          <Erro mensagem={erro} />
        </div>
      )}
    </div>
  )
}
