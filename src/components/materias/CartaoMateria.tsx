/**
 * Card de materia. Imagem 16:9 no lugar do emoji da v10; sem capa propria,
 * entra a arte deterministica de lib/imagem.
 *
 * Materia sem acesso continua visivel (decisao do brief: o aluno ve tudo,
 * acessa o que assinou) - mas o card diz isso com todas as letras, em vez de
 * deixar a pessoa clicar e bater numa parede.
 */
import Link from 'next/link'
import { capaFallbackDataUri } from '@/lib/imagem'

export interface DadosCartaoMateria {
  nome: string
  slug: string
  descricao: string | null
  imagem_url: string | null
  imagem_alt: string | null
  ch_total: number | null
  liberada?: boolean
  questoes?: number
}

export function CartaoMateria({ materia }: { materia: DadosCartaoMateria }) {
  const liberada = materia.liberada !== false
  const capa = materia.imagem_url ?? capaFallbackDataUri(materia.nome, materia.slug)

  const conteudo = (
    <>
      <div className="relative overflow-hidden rounded-t-cartao">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={capa}
          alt={materia.imagem_alt ?? ''}
          className={`aspect-video w-full object-cover transition-transform duration-300 ${
            liberada ? 'group-hover:scale-[1.03]' : 'opacity-60 saturate-50'
          }`}
        />
        {!liberada && (
          <span className="absolute right-3 top-3 rounded-full bg-casca/90 px-2.5 py-1 font-corpo text-xs font-semibold text-white">
            Não liberada
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-titulo text-base font-bold text-tinta-forte">{materia.nome}</h3>
        {materia.descricao && (
          <p className="mt-1 line-clamp-2 font-corpo text-sm text-tinta-media">
            {materia.descricao}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 font-corpo text-xs text-tinta-fraca">
          {materia.ch_total !== null && <span>{materia.ch_total} h</span>}
          {materia.questoes !== undefined && (
            <span>
              {materia.questoes} {materia.questoes === 1 ? 'questão' : 'questões'}
            </span>
          )}
        </div>
      </div>
    </>
  )

  if (!liberada) {
    return (
      <div className="overflow-hidden rounded-cartao bg-cartao shadow-cartao">{conteudo}</div>
    )
  }

  return (
    <Link
      href={`/estudar/${materia.slug}`}
      className="group block overflow-hidden rounded-cartao bg-cartao shadow-cartao transition-shadow hover:shadow-flutuante focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao"
    >
      {conteudo}
    </Link>
  )
}
