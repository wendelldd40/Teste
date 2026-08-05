/**
 * Estudar. Materias agrupadas por trilha - trilha e o periodo da matriz.
 */
import { getServerClient } from '@/lib/supabase/server'
import { listarComAcesso } from '@/repositories/materias.repo'
import { CartaoMateria } from '@/components/materias/CartaoMateria'
import { Erro, Vazio } from '@/components/ui'

export default async function PaginaEstudar() {
  const sb = await getServerClient()
  const materias = await listarComAcesso(sb)

  if (!materias.ok) {
    return (
      <Erro
        mensagem="Não foi possível carregar as matérias."
        detalhe="Recarregue a página para tentar de novo."
      />
    )
  }

  if (materias.dados.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma matéria no ar"
        descricao="Assim que uma matéria for liberada, ela aparece aqui."
      />
    )
  }

  // Agrupa por periodo preservando a ordem do catalogo.
  const trilhas = new Map<string, typeof materias.dados>()
  for (const m of materias.dados) {
    const nome = m.periodo ? `${m.periodo.numero}o periodo` : 'Outras'
    if (!trilhas.has(nome)) trilhas.set(nome, [])
    trilhas.get(nome)!.push(m)
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-titulo text-2xl font-extrabold text-casca">Estudar</h1>
        <p className="mt-1 font-corpo text-sm text-tinta-media">
          {materias.dados.filter((m) => m.liberada).length} de {materias.dados.length} materias
          liberadas para voce.
        </p>
      </header>

      {[...trilhas.entries()].map(([trilha, lista]) => (
        <section key={trilha}>
          <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
            {trilha}
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((m) => (
              <CartaoMateria key={m.id} materia={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
