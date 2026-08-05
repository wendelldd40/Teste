/**
 * Dashboard.
 *
 * Ordem deliberada: primeiro o estado (sequencia e meta), depois os numeros,
 * depois a acao. Quem abre o app quer saber "estou em dia?" antes de
 * qualquer outra coisa.
 */

// auditoria: sem-estado-vazio - sempre há usuario; sequencia zerada ja é o estado inicial

import Link from 'next/link'
import { getServerClient } from '@/lib/supabase/server'
import { requireUsuario } from '@/lib/auth/guards'
import { atividade, resumoStreak } from '@/repositories/progresso.repo'
import { listarComAcesso } from '@/repositories/materias.repo'
import { sessaoAberta } from '@/repositories/simulados.repo'
import { CartaoAbertura } from '@/components/progresso/CartaoAbertura'
import { Erro, Indicador } from '@/components/ui'
import { IconeEstudar, IconeSimulados } from '@/components/ui/Icones'

function primeiroNome(nome: string, email: string): string {
  const limpo = nome.trim()
  if (limpo) return limpo.split(/\s+/)[0]
  return email.split('@')[0]
}

export default async function PaginaDashboard() {
  const usuario = await requireUsuario()
  const sb = await getServerClient()

  const [streak, materias, aberta, dias] = await Promise.all([
    resumoStreak(sb),
    listarComAcesso(sb),
    sessaoAberta(sb),
    atividade(14, sb),
  ])

  if (!streak.ok) {
    return (
      <Erro
        mensagem="Não foi possível carregar seu progresso."
        detalhe="Recarregue a página para tentar de novo."
      />
    )
  }

  const liberadas = materias.ok ? materias.dados.filter((m) => m.liberada).length : 0
  const sessao = aberta.ok ? aberta.dados : null
  const diasValidos = dias.ok
    ? dias.dados.filter((d) => d.conta_streak).map((d) => d.dia)
    : []

  return (
    <div className="space-y-8">
      <CartaoAbertura
        nome={primeiroNome(usuario.nome, usuario.email)}
        diasSeguidos={streak.dados.diasSeguidos}
        hojeContou={streak.dados.hojeContou}
        questoesNaSemana={streak.dados.questoesNaSemana}
        metaSemanal={streak.dados.metaSemanal}
        progressoSemanal={streak.dados.progressoSemanal}
        diasValidos={diasValidos}
      />

      <section>
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Seus numeros
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Indicador valor={streak.dados.questoesNaSemana} rotulo="Questões na semana" />
          <Indicador valor={streak.dados.recorde} rotulo="Maior sequência" destaque />
          <Indicador valor={liberadas} rotulo="Matérias liberadas" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Atalho
          href={sessao ? `/simulados/${sessao.id}` : '/simulados'}
          titulo={sessao ? 'Continuar simulado' : 'Começar um simulado'}
          descricao={
            sessao
              ? `Você parou na questao ${sessao.indice_atual + 1} de ${sessao.total_questoes}.`
              : 'Escolha uma matéria, um assunto ou misture tudo.'
          }
          Icone={IconeSimulados}
          principal
        />
        <Atalho
          href="/estudar"
          titulo="Estudar"
          descricao="Matérias, assuntos e material de apoio."
          Icone={IconeEstudar}
        />
      </section>
    </div>
  )
}

function Atalho({
  href,
  titulo,
  descricao,
  Icone,
  principal = false,
}: {
  href: string
  titulo: string
  descricao: string
  Icone: (props: { className?: string }) => React.ReactElement
  principal?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-4 rounded-cartao p-5 shadow-cartao transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao ${
        principal ? 'bg-ação text-white' : 'bg-cartao text-tinta-forte'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-pequeno ${
          principal ? 'bg-white/15 text-white' : 'bg-creme text-ação'
        }`}
      >
        <Icone className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-titulo text-lg font-bold">{titulo}</span>
        <span
          className={`mt-0.5 block font-corpo text-sm ${principal ? 'text-white/75' : 'text-tinta-media'}`}
        >
          {descricao}
        </span>
      </span>
    </Link>
  )
}
