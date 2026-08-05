/**
 * Uma materia: assuntos, material de apoio e atalho para simulado da materia.
 *
 * O acesso e checado no servidor antes de qualquer coisa. A RLS ja barraria a
 * leitura das questoes, mas quem nao assinou merece uma explicacao clara em
 * vez de uma pagina vazia sem motivo aparente.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { porSlug } from '@/repositories/materias.repo'
import { arvorePorMateria } from '@/repositories/assuntos.repo'
import { materiaisDaMateria } from '@/repositories/materiais.repo'
import { capaFallbackDataUri } from '@/lib/imagem'
import { Cartao, Erro, Vazio } from '@/components/ui'
import type { AssuntoNo } from '@/repositories/assuntos.repo'

const ROTULO_TIPO: Record<string, string> = {
  apostila: 'Apostila',
  mapa_mental: 'Mapa mental',
  resumo: 'Resumo',
  link: 'Link',
}

function ListaAssuntos({ nos, nivel = 0 }: { nos: AssuntoNo[]; nivel?: number }) {
  return (
    <ul className={nivel === 0 ? 'space-y-1' : 'mt-1 space-y-1'}>
      {nos.map((no) => (
        <li key={no.id}>
          <div
            className="rounded-pequeno px-3 py-2 font-corpo text-sm text-tinta-forte odd:bg-creme"
            style={{ paddingLeft: `${12 + nivel * 16}px` }}
          >
            {no.nome}
          </div>
          {no.filhos.length > 0 && <ListaAssuntos nos={no.filhos} nivel={nivel + 1} />}
        </li>
      ))}
    </ul>
  )
}

export default async function PaginaMateria({
  params,
}: {
  params: Promise<{ materia: string }>
}) {
  const { materia: slug } = await params
  const sb = await getServerClient()

  const materia = await porSlug(slug, sb)
  if (!materia.ok) {
    if (materia.erro.codigo === 'nao_encontrado') notFound()
    return (
      <Erro
        mensagem="Não foi possível abrir esta matéria."
        detalhe="Recarregue a página para tentar de novo."
      />
    )
  }

  const { data: acesso } = await sb
    .from('acessos_materia')
    .select('materia_id')
    .eq('materia_id', materia.dados.id)
    .eq('ativo', true)
    .maybeSingle()

  const capa = materia.dados.imagem_url ?? capaFallbackDataUri(materia.dados.nome, slug)

  if (!acesso) {
    return (
      <div className="space-y-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={capa}
          alt=""
          className="aspect-video w-full rounded-cartao object-cover opacity-60 saturate-50"
        />
        <Vazio
          titulo={`${materia.dados.nome} ainda nao esta liberada`}
          descricao="Você consegue ver todas as matérias do curso, mas só estuda as que estão liberadas para a sua conta. Fale com a coordenação para liberar está."
          acao={
            <Link
              href="/estudar"
              className="rounded-pequeno border border-tinta-fraca/30 px-4 py-2.5 font-corpo text-sm font-semibold text-tinta-forte transition-colors hover:border-acao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao"
            >
              Ver outras materias
            </Link>
          }
        />
      </div>
    )
  }

  const [assuntos, materiais] = await Promise.all([
    arvorePorMateria(materia.dados.id, sb),
    materiaisDaMateria(materia.dados.id, sb),
  ])

  return (
    <div className="space-y-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={capa}
        alt={materia.dados.imagem_alt ?? ''}
        className="aspect-video w-full rounded-cartao object-cover"
      />

      <header>
        <h1 className="font-titulo text-2xl font-extrabold text-casca">
          {materia.dados.nome}
        </h1>
        {materia.dados.descricao && (
          <p className="mt-1 font-corpo text-sm text-tinta-media">
            {materia.dados.descricao}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 font-corpo text-xs text-tinta-fraca">
          {materia.dados.periodo && <span>{materia.dados.periodo.numero}o periodo</span>}
          {materia.dados.ch_total !== null && <span>{materia.dados.ch_total} horas</span>}
        </div>
      </header>

      <Link
        href="/simulados"
        className="block rounded-cartao bg-casca p-5 text-white shadow-cartao transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao"
      >
        <p className="font-titulo text-base font-bold">Fazer simulado desta matéria</p>
        <p className="mt-0.5 font-corpo text-sm text-white/70">
          Questões sorteadas entre os assuntos abaixo.
        </p>
      </Link>

      <section>
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Assuntos
        </h2>
        <Cartao className="mt-3 p-3">
          {assuntos.ok && assuntos.dados.length > 0 ? (
            <ListaAssuntos nos={assuntos.dados} />
          ) : (
            <p className="px-3 py-2 font-corpo text-sm text-tinta-media">
              Os assuntos desta materia ainda estao sendo organizados.
            </p>
          )}
        </Cartao>
      </section>

      <section>
        <h2 className="font-titulo text-sm font-bold uppercase tracking-wide text-tinta-fraca">
          Material de apoio
        </h2>
        {materiais.ok && materiais.dados.length > 0 ? (
          <div className="mt-3 space-y-2">
            {materiais.dados.map((m) => (
              <Cartao key={m.id} className="p-4">
                <p className="font-corpo text-xs font-bold uppercase tracking-wide text-tinta-fraca">
                  {ROTULO_TIPO[m.tipo] ?? m.tipo}
                </p>
                <p className="mt-1 font-corpo text-sm font-semibold text-tinta-forte">
                  {m.titulo}
                </p>
                {m.descricao && (
                  <p className="mt-0.5 font-corpo text-sm text-tinta-media">{m.descricao}</p>
                )}
              </Cartao>
            ))}
          </div>
        ) : (
          <Cartao className="mt-3">
            <p className="font-corpo text-sm text-tinta-media">
              O material desta materia ainda esta em producao. Enquanto isso, os simulados
              ja funcionam.
            </p>
          </Cartao>
        )}
      </section>
    </div>
  )
}
