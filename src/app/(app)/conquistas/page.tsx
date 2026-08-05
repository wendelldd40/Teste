/**
 * Conquistas. As medalhas sao desenhadas em SVG na paleta da marca.
 *
 * O calculo de quem ganhou o que acontece no servidor (avaliar_conquistas).
 * Aqui so mostramos o estado.
 */
import Link from 'next/link'
import { getServerClient } from '@/lib/supabase/server'
import { progressoConquistas } from '@/repositories/progresso.repo'
import { listar, minhas } from '@/repositories/conquistas.repo'
import { Cartao, Erro, Vazio } from '@/components/ui'
import { Medalha, progressoMedalha } from '@/components/progresso/Medalha'
import type { FamiliaConquista } from '@/components/progresso/Medalha'

interface CriterioBruto {
  tipo: string
  valor: number
  minimo_questoes?: number
}

export default async function PaginaConquistas() {
  const sb = await getServerClient()

  const [catalogo, ganhasResultado, progresso] = await Promise.all([
    listar(sb),
    minhas(sb),
    progressoConquistas(sb),
  ])

  if (!catalogo.ok) {
    return (
      <Erro
        mensagem="Não foi possível carregar as conquistas."
        detalhe="Recarregue a página para tentar de novo."
      />
    )
  }

  const conquistas = catalogo.dados

  if (conquistas.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma conquista cadastrada"
        descricao="Rode o seed para popular as medalhas."
      />
    )
  }

  const ganhas = new Map(
    (ganhasResultado.ok ? ganhasResultado.dados : []).map((m) => [
      m.conquista_id,
      m.conquistada_em,
    ])
  )
  const atual = progresso.ok
    ? progresso.dados
    : { questoes_respondidas: 0, simulados_concluidos: 0, streak_dias: 0 }

  function progressoDe(criterio: CriterioBruto): number | null {
    switch (criterio.tipo) {
      case 'questoes_respondidas':
        return progressoMedalha(atual.questoes_respondidas, criterio.valor)
      case 'simulados_concluidos':
        return progressoMedalha(atual.simulados_concluidos, criterio.valor)
      case 'streak_dias':
        return progressoMedalha(atual.streak_dias, criterio.valor)
      default:
        // Criterio sem contador simples (acerto por materia, erros revertidos):
        // mostrar barra chutada seria pior que nao mostrar.
        return null
    }
  }

  const total = conquistas.length
  const conquistadas = conquistas.filter((c) => ganhas.has(c.id)).length

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-titulo text-2xl font-extrabold text-casca">Conquistas</h1>
        <p className="mt-1 font-corpo text-sm text-tinta-media">
          {conquistadas} de {total} conquistadas.
        </p>
      </header>

      {conquistadas === 0 && atual.questoes_respondidas === 0 && (
        <Cartao className="bg-casca text-white">
          <p className="font-titulo text-base font-bold">Nada conquistado ainda</p>
          <p className="mt-1 font-corpo text-sm text-white/70">
            As medalhas abaixo mostram o que da para alcancar. A primeira chega no fim do
            seu primeiro simulado.
          </p>
          <Link
            href="/simulados"
            className="mt-4 inline-flex rounded-pequeno bg-ouro px-4 py-2.5 font-corpo text-sm font-bold text-casca transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ouro"
          >
            Comecar agora
          </Link>
        </Cartao>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {conquistas.map((c) => {
          const criterio = c.criterio as unknown as CriterioBruto
          const ganha = ganhas.has(c.id)
          const p = progressoDe(criterio)
          const estado = ganha ? 'conquistada' : p !== null && p > 0 ? 'em_progresso' : 'bloqueada'

          return (
            <Cartao key={c.id} className="flex items-start gap-4">
              <Medalha
                familia={criterio.tipo as FamiliaConquista}
                estado={estado}
                progresso={p ?? 0}
                nome={c.nome}
              />
              <div className="min-w-0">
                <p className="font-titulo text-base font-bold text-tinta-forte">{c.nome}</p>
                <p className="mt-0.5 font-corpo text-sm text-tinta-media">{c.descricao}</p>
                {!ganha && p !== null && p > 0 && (
                  <p className="mt-1.5 font-corpo text-xs font-semibold text-acao">
                    {Math.round(p * 100)}% do caminho
                  </p>
                )}
                {ganha && (
                  <p className="mt-1.5 font-corpo text-xs font-semibold text-ouro">
                    Conquistada
                  </p>
                )}
              </div>
            </Cartao>
          )
        })}
      </div>
    </div>
  )
}
