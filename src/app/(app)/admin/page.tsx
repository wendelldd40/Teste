/**
 * Resumo do admin. Os numeros vem de uma RPC unica: oito contagens em uma
 * ida ao banco, em vez de oito consultas.
 */

// auditoria: sem-estado-vazio - contadores sempre existem, zero e um valor valido
import Link from 'next/link'
import { getServerClient } from '@/lib/supabase/server'
import { resumo } from '@/repositories/admin.repo'
import { Erro, Indicador } from '@/components/ui'

export default async function PaginaResumo() {
  const sb = await getServerClient()
  const r = await resumo(sb)

  if (!r.ok) {
    return (
      <Erro
        mensagem="Nao foi possivel carregar os numeros."
        detalhe="Recarregue a pagina. Se continuar, verifique a conexao com o banco."
      />
    )
  }

  const data = r.dados

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Conteudo
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador valor={data.questoes_publicadas} rotulo="Questoes no ar" />
          <Indicador
            valor={data.questoes_revisao}
            rotulo="Esperando revisao"
            destaque={data.questoes_revisao > 0}
          />
          <Indicador valor={data.questoes_rascunho} rotulo="Rascunhos" />
          <Indicador valor={data.assuntos} rotulo="Assuntos" />
        </div>
      </section>

      <section>
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Catalogo
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador valor={data.materias_ativas} rotulo="Materias no ar" />
          <Indicador valor={data.materias_total} rotulo="Materias cadastradas" />
          <Indicador
            valor={data.materias_sem_imagem}
            rotulo="Sem capa"
            destaque={data.materias_sem_imagem > 0}
          />
          <Indicador valor={data.alunos} rotulo="Alunos" />
        </div>
      </section>

      {data.questoes_revisao > 0 && (
        <Link
          href="/admin/revisao"
          className="inline-flex rounded-pequeno bg-acao px-4 py-2.5 font-corpo text-sm font-semibold text-white transition-colors hover:bg-casca focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao"
        >
          Revisar {data.questoes_revisao} questoes
        </Link>
      )}
    </div>
  )
}
