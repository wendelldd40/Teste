/**
 * Layout do admin. O guard roda aqui, no servidor, antes de qualquer render.
 * Quem nao e admin nem chega a receber o HTML.
 */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireAdminPagina } from '@/lib/auth/guards'

const ABAS = [
  { href: '/admin', rotulo: 'Resumo' },
  { href: '/admin/materias', rotulo: 'Materias' },
  { href: '/admin/assuntos', rotulo: 'Assuntos' },
  { href: '/admin/revisao', rotulo: 'Fila de revisao' },
]

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const admin = await requireAdminPagina()

  return (
    <div className="min-h-screen bg-creme">
      <header className="border-b border-tinta-fraca/15 bg-cartao">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="font-titulo text-lg font-extrabold text-casca">Administracao</h1>
            <p className="font-corpo text-xs text-tinta-fraca">{admin.nome || admin.email}</p>
          </div>
          <nav className="flex flex-wrap gap-1">
            {ABAS.map((aba) => (
              <Link
                key={aba.href}
                href={aba.href}
                className="rounded-pequeno px-3 py-2 font-corpo text-sm font-semibold text-tinta-media transition-colors hover:bg-creme hover:text-acao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao"
              >
                {aba.rotulo}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
