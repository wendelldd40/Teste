'use client'

/**
 * Menu lateral. Exatamente o do brief.
 *
 * Ranking NAO aparece aqui. A rota existe (/ranking), mas fica fora do menu
 * ate haver modelo de turma - comparar aluno de periodos diferentes num
 * ranking global desanima mais do que motiva. No lugar dela, o bloco "mais
 * constantes da semana" dentro de Evolucao.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const GRUPOS = [
  {
    titulo: 'Principal',
    itens: [
      { href: '/dashboard', rotulo: 'Dashboard' },
      { href: '/estudar', rotulo: 'Estudar' },
      { href: '/simulados', rotulo: 'Simulados' },
    ],
  },
  {
    titulo: 'Progresso',
    itens: [
      { href: '/analise-erros', rotulo: 'Analise de Erros' },
      { href: '/evolucao', rotulo: 'Evolucao' },
      { href: '/conquistas', rotulo: 'Conquistas' },
    ],
  },
  {
    titulo: 'Configuracoes',
    itens: [{ href: '/perfil', rotulo: 'Perfil' }],
  },
] as const

export function Navegacao({ ehAdmin }: { ehAdmin: boolean }) {
  const caminho = usePathname()

  const grupos = ehAdmin
    ? GRUPOS.map((g) =>
        g.titulo === 'Configuracoes'
          ? { ...g, itens: [...g.itens, { href: '/admin', rotulo: 'Admin' }] }
          : g
      )
    : GRUPOS

  return (
    <nav aria-label="Navegacao principal" className="space-y-6">
      {grupos.map((grupo) => (
        <div key={grupo.titulo}>
          <p className="px-3 font-corpo text-xs font-bold uppercase tracking-widest text-white/40">
            {grupo.titulo}
          </p>
          <ul className="mt-2 space-y-0.5">
            {grupo.itens.map((item) => {
              const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={ativo ? 'page' : undefined}
                    className={`block rounded-pequeno px-3 py-2 font-corpo text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ouro ${
                      ativo
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.rotulo}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
