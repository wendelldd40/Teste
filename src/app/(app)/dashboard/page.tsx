/**
 * Dashboard.
 *
 * Ordem deliberada: primeiro o estado (streak e meta), depois os numeros,
 * depois a acao. Quem abre o app quer saber "estou em dia?" antes de
 * qualquer outra coisa.
 */

// auditoria: sem-estado-vazio - sempre ha usuario; streak zerado ja e o estado inicial

import Link from 'next/link'
import { getServerClient } from '@/lib/supabase/server'
import { requireUsuario } from '@/lib/auth/guards'
import { resumoStreak } from '@/repositories/progresso.repo'
import { listarComAcesso } from '@/repositories/materias.repo'
import { sessaoAberta } from '@/repositories/simulados.repo'
import { AnelProgresso } from '@/components/progresso/AnelProgresso'
import { Cartao, Erro, Indicador } from '@/components/ui'

function saudacao(hora: number): string {
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

function primeiroNome(nome: string, email: string): string {
  const limpo = nome.trim()
  if (limpo) return limpo.split(/\s+/)[0]
  return email.split('@')[0]
}

export default async function PaginaDashboard() {
  const usuario = await requireUsuario()
  const sb = await getServerClient()

  const [streak, materias, aberta] = await Promise.all([
    resumoStreak(sb),
    listarComAcesso(sb),
    sessaoAberta(sb),
  ])

  if (!streak.ok) {
    return (
      <Erro
        mensagem="Nao foi possivel carregar seu progresso."
        detalhe="Recarregue a pagina para tentar de novo."
      />
    )
  }

  const liberadas = materias.ok ? materias.dados.filter((m) => m.liberada).length : 0
  const sessao = aberta.ok ? aberta.dados : null

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-titulo text-2xl font-extrabold text-casca">
          {saudacao(new Date().getHours())}, {primeiroNome(usuario.nome, usuario.email)}
        </h1>
        <p className="mt-1 font-corpo text-sm text-tinta-media">
          {streak.dados.metaSemanalCumprida
            ? 'Meta da semana batida. O que vier agora e vantagem.'
            : `Faltam ${streak.dados.metaSemanal - streak.dados.questoesNaSemana} questoes para fechar a semana.`}
        </p>
      </header>

      <Cartao>
        <AnelProgresso
          diasSeguidos={streak.dados.diasSeguidos}
          hojeContou={streak.dados.hojeContou}
          questoesNaSemana={streak.dados.questoesNaSemana}
          metaSemanal={streak.dados.metaSemanal}
          progressoSemanal={streak.dados.progressoSemanal}
        />
      </Cartao>

      <section>
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Seus numeros
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Indicador valor={streak.dados.questoesNaSemana} rotulo="Questoes na semana" />
          <Indicador valor={streak.dados.recorde} rotulo="Maior sequencia" destaque />
          <Indicador valor={liberadas} rotulo="Materias liberadas" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Atalho
          href={sessao ? `/simulados/${sessao.id}` : '/simulados'}
          titulo={sessao ? 'Continuar simulado' : 'Comecar um simulado'}
          descricao={
            sessao
              ? `Voce parou na questao ${sessao.indice_atual + 1} de ${sessao.total_questoes}.`
              : 'Escolha uma materia, um assunto ou misture tudo.'
          }
          principal
        />
        <Atalho
          href="/estudar"
          titulo="Estudar"
          descricao="Materias, assuntos e material de apoio."
        />
      </section>
    </div>
  )
}

function Atalho({
  href,
  titulo,
  descricao,
  principal = false,
}: {
  href: string
  titulo: string
  descricao: string
  principal?: boolean
}) {
  return (
    <Link
      href={href}
      className={`block rounded-cartao p-6 shadow-cartao transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao ${
        principal ? 'bg-casca text-white' : 'bg-cartao text-tinta-forte'
      }`}
    >
      <p className="font-titulo text-lg font-bold">{titulo}</p>
      <p
        className={`mt-1 font-corpo text-sm ${principal ? 'text-white/70' : 'text-tinta-media'}`}
      >
        {descricao}
      </p>
    </Link>
  )
}
