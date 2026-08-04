/**
 * EstudeVet v11 - Sprint 2 - Exportador do banco ANTIGO.
 *
 *   npx tsx scripts/migracao/exportar-legado.ts > legado.json
 *
 * Somente leitura. Este script so faz SELECT. Nao existe insert, update,
 * delete ou rpc em lugar nenhum dele - e essa e a garantia de que o banco
 * antigo continua servindo a v10 enquanto a v11 e construida.
 *
 * Variaveis de ambiente (do projeto ANTIGO):
 *   LEGADO_SUPABASE_URL
 *   LEGADO_SUPABASE_KEY   (anon serve; service role le tambem o inativo)
 */

import { createClient } from '@supabase/supabase-js'
import type { DumpLegado } from './legado.types'

const url = process.env.LEGADO_SUPABASE_URL
const key = process.env.LEGADO_SUPABASE_KEY

if (!url || !key) {
  console.error('Defina LEGADO_SUPABASE_URL e LEGADO_SUPABASE_KEY (projeto antigo).')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const PAGINA = 1000

/** Pagina o SELECT: o Supabase corta em 1000 linhas por padrao. */
async function lerTudo<T>(tabela: string, colunas: string): Promise<T[]> {
  const saida: T[] = []
  let de = 0

  for (;;) {
    const { data, error } = await sb
      .from(tabela)
      .select(colunas)
      .range(de, de + PAGINA - 1)
      .order('id')

    if (error) {
      // Tabela que nao existe mais no projeto antigo nao derruba a exportacao.
      console.error(`[aviso] ${tabela}: ${error.message}`)
      return saida
    }
    if (!data || data.length === 0) break

    saida.push(...(data as unknown as T[]))
    if (data.length < PAGINA) break
    de += PAGINA
  }

  console.error(`[ok] ${tabela}: ${saida.length} linhas`)
  return saida
}

async function main() {
  // Inclui ativo = false de proposito: questao desligada na v10 nao e lixo,
  // e material que entra como rascunho e voce decide depois.
  const dump: DumpLegado = {
    exportado_em: new Date().toISOString(),
    questoes: await lerTudo(
      'questoes',
      'id,materia,materia_nome,tema,dificuldade,texto,assertivas,opcao_a,opcao_b,opcao_c,opcao_d,opcao_e,gabarito,comentario,ativo,created_at'
    ),
    conteudo_estudo: await lerTudo(
      'conteudo_estudo',
      'id,materia,livro,autor,edicao,capitulo,titulo,subtitulo,tags,conteudo,ordem,ativo,created_at'
    ),
    usuarios: await lerTudo(
      'usuarios',
      'id,nome,email,xp_total,streak,total_questoes,ranking_opt,created_at,updated_at'
    ),
  }

  // JSON no stdout, log no stderr: da para redirecionar limpo.
  process.stdout.write(JSON.stringify(dump, null, 2))
  console.error(`\n[fim] ${dump.questoes.length} questoes exportadas.`)
}

main().catch((e) => {
  console.error('Falha na exportacao:', e instanceof Error ? e.message : e)
  process.exit(1)
})
