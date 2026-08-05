/**
 * Shell da área logada: casca verde profunda à esquerda, conteudo em creme.
 * O rodapé da barra mostra quem esta logado - detalhe que a v10 tinha e
 * ajuda a saber em qual conta voce esta sem abrir o Perfil.
 */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUsuarioAtual } from '@/lib/auth/session'
import { Navegacao } from '@/components/shell/Navegacao'
import { MarcaZeloVet } from '@/components/ui/Icones'

function iniciais(nome: string, email: string): string {
  const limpo = nome.trim()
  if (!limpo) return email.slice(0, 2).toUpperCase()
  const partes = limpo.split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const usuario = await getUsuarioAtual()
  if (!usuario) redirect('/entrar')

  return (
    <div className="min-h-screen bg-creme lg:flex">
      <aside className="flex flex-col bg-casca lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0">
        <div className="flex items-center gap-3 px-5 py-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <MarcaZeloVet className="h-10 w-10 shrink-0" />
            <span>
              <span className="block font-titulo text-lg font-extrabold leading-none tracking-tight text-white">
                Estude<span className="text-ouro">Vet</span>
              </span>
              <span className="mt-1 block font-corpo text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Universo ZeloVet
              </span>
            </span>
          </Link>
        </div>

        <div className="flex-1 px-3 pb-4">
          <Navegacao ehAdmin={usuario.papel === 'admin'} />
        </div>

        <div className="mx-3 mb-4 flex items-center gap-3 rounded-pequeno bg-white/5 px-3 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ouro font-corpo text-xs font-bold text-casca">
            {iniciais(usuario.nome, usuario.email)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-corpo text-sm font-semibold text-white">
              {usuario.nome || usuario.email.split('@')[0]}
            </span>
            <span className="block truncate font-corpo text-xs text-white/45">
              {usuario.papel === 'admin' ? 'Administrador' : 'Aluno'}
            </span>
          </span>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-5xl px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  )
}
