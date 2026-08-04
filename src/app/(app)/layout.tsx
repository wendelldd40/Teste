/**
 * Shell da area logada: casca verde profunda a esquerda, conteudo em creme.
 */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUsuarioAtual } from '@/lib/auth/session'
import { Navegacao } from '@/components/shell/Navegacao'

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const usuario = await getUsuarioAtual()
  if (!usuario) redirect('/entrar')

  return (
    <div className="min-h-screen bg-creme lg:flex">
      <aside className="bg-casca lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0">
        <div className="px-6 py-6">
          <Link
            href="/dashboard"
            className="font-titulo text-lg font-extrabold tracking-tight text-white"
          >
            EstudeVet
          </Link>
          <p className="mt-0.5 font-corpo text-xs text-white/50">Universo ZeloVet</p>
        </div>
        <div className="px-3 pb-6">
          <Navegacao ehAdmin={usuario.papel === 'admin'} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-5xl px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  )
}
