/**
 * CRUD de materias. A lista completa da matriz ja esta no banco pelo seed:
 * aqui o trabalho e ligar, descrever e dar capa - nao cadastrar do zero.
 */
import { getServerClient } from '@/lib/supabase/server'
import { listarMaterias } from '@/repositories/admin.repo'
import { Erro, Vazio } from '@/components/ui'
import { LinhaMateria } from '@/components/admin/LinhaMateria'

export default async function PaginaMaterias() {
  const sb = await getServerClient()
  const r = await listarMaterias(sb)

  if (!r.ok) {
    return (
      <Erro
        mensagem="Nao foi possivel carregar as materias."
        detalhe="Recarregue a pagina para tentar de novo."
      />
    )
  }

  const materias = r.dados
  if (materias.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma materia cadastrada"
        descricao="Rode o seed da matriz curricular para popular o catalogo."
      />
    )
  }

  const ativas = materias.filter((m) => m.ativa)
  const desligadas = materias.filter((m) => !m.ativa)

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          No ar ({ativas.length})
        </h2>
        <div className="mt-3 space-y-3">
          {ativas.map((m) => (
            <LinhaMateria key={m.id} materia={m} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Desligadas ({desligadas.length})
        </h2>
        <p className="mt-1 font-corpo text-sm text-tinta-media">
          Cadastradas pela matriz, invisiveis para o aluno ate serem ligadas.
        </p>
        <div className="mt-3 space-y-3">
          {desligadas.map((m) => (
            <LinhaMateria key={m.id} materia={m} />
          ))}
        </div>
      </section>
    </div>
  )
}
