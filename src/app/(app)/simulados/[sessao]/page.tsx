/**
 * Execucao de uma sessao. Carrega no servidor e entrega para o componente
 * de cliente - inclusive a ordem das alternativas gravada na sessao.
 */

// auditoria: sem-estado-vazio - sessao sem questoes e tratada dentro de ExecucaoSimulado
import { getServerClient } from '@/lib/supabase/server'
import { carregar } from '@/repositories/simulados.repo'
import { ExecucaoSimulado } from '@/components/simulado/ExecucaoSimulado'
import { Erro } from '@/components/ui'
import { redirect } from 'next/navigation'

export default async function PaginaSessao({
  params,
}: {
  params: Promise<{ sessao: string }>
}) {
  const { sessao: sessaoId } = await params
  const sb = await getServerClient()

  const r = await carregar(sessaoId, sb)
  if (!r.ok) {
    return (
      <Erro
        mensagem="Não foi possível abrir este simulado."
        detalhe="Volte para Simulados e monte um novo."
      />
    )
  }

  if (r.dados.sessao.status !== 'em_andamento') {
    redirect(`/simulados/${sessaoId}/resultado`)
  }

  return <ExecucaoSimulado inicial={r.dados} />
}
