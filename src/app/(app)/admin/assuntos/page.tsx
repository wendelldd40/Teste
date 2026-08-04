/**
 * CRUD de assuntos, agrupado por materia. A hierarquia usa parent_id: o
 * assunto filho aparece indentado sob o pai.
 */
import { getServerClient } from '@/lib/supabase/server'
import { listar as listarMateriasAtivas } from '@/repositories/materias.repo'
import { todosAssuntos } from '@/repositories/assuntos.repo'
import { Erro, Vazio } from '@/components/ui'
import { PainelAssuntos } from '@/components/admin/PainelAssuntos'

export default async function PaginaAssuntos() {
  const sb = await getServerClient()

  const [resultadoMaterias, resultadoAssuntos] = await Promise.all([
    listarMateriasAtivas(sb),
    todosAssuntos(sb),
  ])

  if (!resultadoMaterias.ok || !resultadoAssuntos.ok) {
    return (
      <Erro
        mensagem="Nao foi possivel carregar os assuntos."
        detalhe="Recarregue a pagina para tentar de novo."
      />
    )
  }

  const materias = resultadoMaterias.dados
  const assuntos = resultadoAssuntos.dados

  if (materias.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma materia no ar"
        descricao="Ligue ao menos uma materia para organizar os assuntos dela."
      />
    )
  }

  return (
    <div className="space-y-8">
      {materias.map((m) => (
        <PainelAssuntos
          key={m.id}
          materia={m}
          assuntos={assuntos.filter((a) => a.materia_id === m.id)}
        />
      ))}
    </div>
  )
}
