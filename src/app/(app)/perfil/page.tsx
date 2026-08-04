/**
 * Perfil: dados da conta, meta semanal e as duas escolhas que a pessoa
 * controla (aparecer nos destaques, sair).
 */

// auditoria: sem-estado-vazio - sempre ha usuario e metas, criadas no cadastro
import { getServerClient } from '@/lib/supabase/server'
import { requireUsuario } from '@/lib/auth/guards'
import { metas } from '@/repositories/progresso.repo'
import { listarComAcesso } from '@/repositories/materias.repo'
import { Cartao, Erro } from '@/components/ui'
import { FormularioPerfil } from '@/components/perfil/FormularioPerfil'
import { Sair } from '@/components/perfil/Sair'

export default async function PaginaPerfil() {
  const usuario = await requireUsuario()
  const sb = await getServerClient()

  const [meta, materias] = await Promise.all([metas(sb), listarComAcesso(sb)])

  if (!meta.ok) {
    return (
      <Erro
        mensagem="Nao foi possivel carregar seu perfil."
        detalhe="Recarregue a pagina para tentar de novo."
      />
    )
  }

  const liberadas = materias.ok ? materias.dados.filter((m) => m.liberada) : []

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-titulo text-2xl font-extrabold text-casca">Perfil</h1>
        <p className="mt-1 font-corpo text-sm text-tinta-media">{usuario.email}</p>
      </header>

      <FormularioPerfil
        usuarioId={usuario.id}
        nome={usuario.nome}
        metaSemanal={meta.dados.meta_semanal_questoes}
        minimoDiario={meta.dados.minimo_diario_questoes}
        mostrarEmDestaques={usuario.mostrar_em_destaques}
      />

      <Cartao>
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Materias liberadas
        </h2>
        {liberadas.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {liberadas.map((m) => (
              <li key={m.id} className="font-corpo text-sm text-tinta-forte">
                {m.nome}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-corpo text-sm text-tinta-media">
            Nenhuma materia liberada ainda. Fale com a coordenacao para liberar acesso.
          </p>
        )}
      </Cartao>

      <Sair />
    </div>
  )
}
