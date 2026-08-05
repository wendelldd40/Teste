/**
 * Ranking.
 *
 * A rota existe e nao esta no menu - decisao travada do brief. Ela fica de pe
 * para quando houver modelo de turma; ranking global entre alunos de periodos
 * diferentes compara quem nao e comparavel.
 *
 * Quem chegar aqui pelo endereco direto merece uma explicacao, nao um 404.
 */
import Link from 'next/link'
import { Vazio } from '@/components/ui'

export default function PaginaRanking() {
  return (
    <Vazio
      titulo="Ranking desligado"
      descricao="Comparar alunos de períodos diferentes num placar único atrapalha mais do que ajuda. Quando houver turmas, a comparação passa a fazer sentido e esta tela volta. Por enquanto, o bloco de constância da semana fica em Evolução."
      acao={
        <Link
          href="/evolucao"
          className="rounded-pequeno bg-acao px-4 py-2.5 font-corpo text-sm font-semibold text-white transition-colors hover:bg-casca focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao"
        >
          Ir para Evolução
        </Link>
      }
    />
  )
}
