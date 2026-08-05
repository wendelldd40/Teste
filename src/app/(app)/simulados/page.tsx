/**
 * Simulados: monta um novo ou retoma o que ficou aberto.
 */
import Link from 'next/link'
import { getServerClient } from '@/lib/supabase/server'
import { requireUsuario } from '@/lib/auth/guards'
import { listarComAcesso } from '@/repositories/materias.repo'
import { sessaoAberta } from '@/repositories/simulados.repo'
import { Cartao, Erro, Vazio } from '@/components/ui'
import { SelecaoSimulado } from '@/components/simulado/SelecaoSimulado'

export default async function PaginaSimulados() {
  const usuario = await requireUsuario()
  const sb = await getServerClient()

  const [materias, aberta] = await Promise.all([listarComAcesso(sb), sessaoAberta(sb)])

  if (!materias.ok) {
    return (
      <Erro
        mensagem="Não foi possível carregar as matérias."
        detalhe="Recarregue a página para tentar de novo."
      />
    )
  }

  const liberadas = materias.dados.filter((m) => m.liberada)

  if (liberadas.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma matéria liberada"
        descricao="Simulados usam as questões das matérias que você assinou. Assim que uma for liberada, ela aparece aqui."
      />
    )
  }

  const { data: assuntos } = await sb
    .from('assuntos')
    .select('id, materia_id, nome')
    .in(
      'materia_id',
      liberadas.map((m) => m.id)
    )
    .order('ordem')

  const selecionaveis = liberadas.map((m) => ({
    id: m.id,
    nome: m.nome,
    assuntos: (assuntos ?? [])
      .filter((a) => a.materia_id === m.id)
      .map((a) => ({ id: a.id, nome: a.nome })),
  }))

  const sessao = aberta.ok ? aberta.dados : null

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-titulo text-2xl font-extrabold text-casca">Simulados</h1>
        <p className="mt-1 font-corpo text-sm text-tinta-media">
          Responda questao a questao, com comentario logo depois de cada resposta.
        </p>
      </header>

      {sessao && (
        <Cartao className="flex flex-wrap items-center justify-between gap-3 bg-casca text-white">
          <div>
            <p className="font-titulo text-base font-bold">Você tem um simulado em andamento</p>
            <p className="mt-0.5 font-corpo text-sm text-white/70">
              Parou na questao {sessao.indice_atual + 1} de {sessao.total_questoes}.
            </p>
          </div>
          <Link
            href={`/simulados/${sessao.id}`}
            className="rounded-pequeno bg-ouro px-4 py-2.5 font-corpo text-sm font-bold text-casca transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ouro"
          >
            Continuar
          </Link>
        </Cartao>
      )}

      <SelecaoSimulado usuarioId={usuario.id} materias={selecionaveis} />
    </div>
  )
}
