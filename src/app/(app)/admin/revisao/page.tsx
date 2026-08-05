/**
 * Fila de revisao. As questoes que a migracao marcou como incompletas
 * chegam aqui: editar, completar e publicar.
 */
import { getServerClient } from '@/lib/supabase/server'
import { carregarQuestao, filaRevisao } from '@/repositories/admin.repo'
import { Erro, Vazio } from '@/components/ui'
import { EditorQuestao } from '@/components/admin/EditorQuestao'
import type { QuestaoParaEditar } from '@/components/admin/EditorQuestao'

export default async function PaginaRevisao() {
  const sb = await getServerClient()

  const resultadoFila = await filaRevisao(undefined, 20, sb)

  if (!resultadoFila.ok) {
    return (
      <Erro
        mensagem="Não foi possível carregar a fila."
        detalhe="Recarregue a página para tentar de novo."
      />
    )
  }

  const fila = resultadoFila.dados

  if (fila.length === 0) {
    return (
      <Vazio
        titulo="Fila vazia"
        descricao="Nenhuma questão esperando revisão. Quando a migração trouxer questões incompletas, elas aparecem aqui."
      />
    )
  }

  // O gabarito so vem por RPC, uma questao por vez, com o papel validado no
  // servidor. Nao existe leitura em massa de gabarito nem para admin.
  const questoes: QuestaoParaEditar[] = []
  for (const item of fila) {
    const carregada = await carregarQuestao(item.id, sb)
    if (!carregada.ok) continue
    const data = carregada.dados

    questoes.push({
      id: data.questao.id,
      materia_id: data.questao.materia_id,
      materia_nome: item.materias?.nome ?? 'Sem matéria',
      tipo: data.questao.tipo,
      dificuldade: data.questao.dificuldade,
      enunciado: data.questao.enunciado,
      comentario: data.questao.comentario,
      status: data.questao.status,
      alternativas: data.alternativas.map((a) => ({
        letra: a.letra,
        texto: a.texto,
        correta: a.correta,
      })),
      assertivas: data.assertivas.map((a) => ({
        ordem: a.ordem,
        numeral: a.numeral,
        texto: a.texto,
        correta: a.correta,
      })),
      assunto_ids: [],
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-titulo text-xl font-extrabold text-casca">Fila de revisão</h2>
        <p className="mt-1 font-corpo text-sm text-tinta-media">
          {questoes.length} questoes prontas para conferir. Publicar so funciona quando a
          questao esta completa.
        </p>
      </div>
      {questoes.map((q) => (
        <EditorQuestao key={q.id} inicial={q} />
      ))}
    </div>
  )
}
