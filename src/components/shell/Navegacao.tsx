'use client'

/**
 * Menu lateral.
 *
 * Ranking NÃO aparece aqui. A rota existe (/ranking), mas fica fora do menu
 * até haver modelo de turma - comparar aluno de períodos diferentes num
 * ranking global desanima mais do que motiva. No lugar dela, o bloco "mais
 * constantes da semana" dentro de Evolução.
 *
 * Os ícones sao desenhados em src/components/ui/Icones.tsx. Nada de emoji e
 * nada de biblioteca de ícones.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconeAdmin,
  IconeAnalise,
  IconeConquistas,
  IconeDashboard,
  IconeEstudar,
  IconeEvolucao,
  IconePerfil,
  IconeSimulados,
} from '@/components/ui/Icones'

type Icone = (props: { className?: string }) => React.ReactElement

interface Item {
  href: string
  rotulo: string
  Icone: Icone
}

const GRUPOS: Array<{ titulo: string; itens: Item[] }> = [
  {
    titulo: 'Principal',
    itens: [
      { href: '/dashboard', rotulo: 'Dashboard', Icone: IconeDashboard },
      { href: '/estudar', rotulo: 'Estudar', Icone: IconeEstudar },
      { href: '/simulados', rotulo: 'Simulados', Icone: IconeSimulados },
    ],
  },
  {
    titulo: 'Progresso',
    itens: [
      { href: '/analise-erros', rotulo: 'Análise de Erros', Icone: IconeAnalise },
      { href: '/evolucao', rotulo: 'Evolução', Icone: IconeEvolucao },
      { href: '/conquistas', rotulo: 'Conquistas', Icone: IconeConquistas },
    ],
  },
  {
    titulo: 'Configurações',
    itens: [{ href: '/perfil', rotulo: 'Perfil', Icone: IconePerfil }],
  },
]

export function Navegacao({ ehAdmin }: { ehAdmin: boolean }) {
  const caminho = usePathname()

  const grupos = ehAdmin
    ? GRUPOS.map((g) =>
        g.titulo === 'Configurações'
          ? { ...g, itens: [...g.itens, { href: '/admin', rotulo: 'Admin', Icone: IconeAdmin }] }
          : g
      )
    : GRUPOS

  return (
    <nav aria-label="Navegação principal" className="space-y-6">
      {grupos.map((grupo) => (
        <div key={grupo.titulo}>
          <p className="px-3 font-corpo text-[11px] font-bold uppercase tracking-[0.14em] text-ouro/70">
            {grupo.titulo}
          </p>
          <ul className="mt-2 space-y-0.5">
            {grupo.itens.map(({ href, rotulo, Icone }) => {
              const ativo = caminho === href || caminho.startsWith(`${href}/`)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={ativo ? 'page' : undefined}
                    className={`group relative flex items-center gap-3 rounded-pequeno px-3 py-2.5 font-corpo text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ouro ${
                      ativo
                        ? 'bg-white/10 text-white'
                        : 'text-white/65 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {/* Marcador dourado na aba ativa: dá para achar onde se
                        esta sem depender so da diferença de cor do texto. */}
                    <span
                      aria-hidden
                      className={`absolute left-0 h-5 w-[3px] rounded-r-full bg-ouro transition-opacity ${
                        ativo ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    <Icone
                      className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                        ativo ? 'text-ouro' : 'text-white/45 group-hover:text-white/70'
                      }`}
                    />
                    {rotulo}
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
