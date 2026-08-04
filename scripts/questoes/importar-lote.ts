/**
 * EstudeVet v11 - Importacao de lote de questoes.
 *
 *   npx tsx scripts/questoes/importar-lote.ts lote.json --dry-run
 *   npx tsx scripts/questoes/importar-lote.ts lote.json --executar
 *
 * Valida antes. Se houver UM erro, nao importa nada - metade de um lote
 * dentro do banco e pior que lote nenhum, porque voce nao sabe mais o que
 * ja entrou.
 *
 * A gravacao passa por `admin_salvar_questao`, a mesma RPC do admin: questao,
 * alternativas, assertivas e vinculos numa transacao so.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

/** Mesmo valor de src/lib/supabase/config.ts. Publico por natureza. */
const SUPABASE_URL_PADRAO = 'https://gfshmgllnrzjxuutqrte.supabase.co'
import type { Database } from '../../src/types/database'
import { validaLote } from './validar-lote'
import type { Lote, QuestaoDeLote } from './validar-lote'

const args = process.argv.slice(2)
const caminho = args.find((a) => !a.startsWith('--'))
const executar = args.includes('--executar')

if (!caminho) {
  console.error('Uso: npx tsx scripts/questoes/importar-lote.ts lote.json [--executar]')
  process.exit(2)
}

// A URL cai no valor embutido; so a service_role precisa vir do ambiente.
const url = process.env.SUPABASE_URL ?? SUPABASE_URL_PADRAO
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY

if (executar && !chave) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY no ambiente. Use --dry-run para conferir.')
  process.exit(1)
}

/** Normaliza para o formato que a RPC espera. */
function paraRpc(
  q: QuestaoDeLote,
  materiaId: string,
  assuntoIds: string[]
): Record<string, unknown> {
  const gabarito = (q.gabarito ?? '').trim().toLowerCase()

  const alternativas = q.alternativas.map((a) => {
    const letra = (a.letra ?? '').trim().toLowerCase()
    return {
      letra,
      texto: (a.texto ?? '').trim(),
      correta: a.correta === true || (gabarito !== '' && letra === gabarito),
    }
  })

  const assertivas = (q.assertivas ?? []).map((a, i) => ({
    ordem: i + 1,
    numeral: a.numeral ?? romano(i + 1),
    texto: (a.texto ?? '').trim(),
    correta: a.correta ?? null,
  }))

  return {
    materia_id: materiaId,
    tipo: q.tipo ?? 'multipla_escolha',
    dificuldade: q.dificuldade ?? 'medio',
    enunciado: q.enunciado.trim(),
    comentario: (q.comentario ?? '').trim() || null,
    fonte_livre: (q.fonte ?? '').trim() || null,
    status: q.status ?? 'publicada',
    alternativas,
    assertivas,
    assunto_ids: assuntoIds,
  }
}

function romano(n: number): string {
  const tabela: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let resto = n
  let saida = ''
  for (const [valor, simbolo] of tabela) {
    while (resto >= valor) {
      saida += simbolo
      resto -= valor
    }
  }
  return saida
}

async function main() {
  const lote = JSON.parse(readFileSync(resolve(process.cwd(), caminho!), 'utf8')) as Lote
  const questoes = lote.questoes ?? []

  console.log('='.repeat(70))
  console.log(`Importacao de lote - ${questoes.length} questoes`)
  console.log(`Modo: ${executar ? 'EXECUCAO' : 'DRY-RUN (nao grava nada)'}`)
  console.log('='.repeat(70))

  // 1. Validar. Um erro derruba o lote inteiro.
  const achados = validaLote(lote)
  const erros = achados.filter((a) => a.gravidade === 'erro')

  if (erros.length > 0) {
    console.error(`\n${erros.length} erro(s). Rode validar-lote.ts para ver a lista completa.`)
    console.error('Nada foi importado.')
    process.exit(1)
  }

  const alertas = achados.filter((a) => a.gravidade === 'alerta')
  console.log(`\nValidacao ok. ${alertas.length} alerta(s) - nao bloqueiam.`)

  if (!executar) {
    const porMateria = new Map<string, number>()
    for (const q of questoes) {
      porMateria.set(q.materia_slug, (porMateria.get(q.materia_slug) ?? 0) + 1)
    }
    console.log('\nSeria importado:')
    for (const [slug, n] of [...porMateria].sort()) {
      console.log(`  ${String(n).padStart(4)}  ${slug}`)
    }
    console.log('\nRode com --executar para gravar.')
    return
  }

  const sb = createClient<Database>(url!, chave!, { auth: { persistSession: false } })

  // 2. Resolver slugs.
  const { data: materias, error: erroMaterias } = await sb.from('materias').select('id, slug')
  if (erroMaterias) throw erroMaterias

  const idMateria = new Map((materias ?? []).map((m) => [m.slug, m.id]))
  const faltando = [...new Set(questoes.map((q) => q.materia_slug))].filter(
    (s) => !idMateria.has(s)
  )
  if (faltando.length > 0) {
    console.error(`\nMaterias inexistentes no banco: ${faltando.join(', ')}`)
    console.error('Rode o seed antes. Nada foi importado.')
    process.exit(1)
  }

  const { data: assuntos, error: erroAssuntos } = await sb
    .from('assuntos')
    .select('id, slug, materia_id')
  if (erroAssuntos) throw erroAssuntos

  const idAssunto = new Map(
    (assuntos ?? []).map((a) => [`${a.materia_id}::${a.slug}`, a.id])
  )

  // 3. Gravar, uma a uma. A RPC ja e transacional por questao.
  let gravadas = 0
  const semAssunto: string[] = []

  for (const [i, q] of questoes.entries()) {
    const materiaId = idMateria.get(q.materia_slug)!

    const ids: string[] = []
    for (const slug of q.assunto_slugs ?? []) {
      const id = idAssunto.get(`${materiaId}::${slug}`)
      if (id) ids.push(id)
      else semAssunto.push(`${q.referencia ?? `#${i + 1}`}: assunto '${slug}' nao existe`)
    }

    const { error } = await sb.rpc('admin_salvar_questao', {
      p_dados: paraRpc(q, materiaId, ids),
    })

    if (error) {
      console.error(`\nFalhou em ${q.referencia ?? `#${i + 1}`}: ${error.message}`)
      console.error(`${gravadas} questoes foram gravadas antes desta. Corrija e rode o resto.`)
      process.exit(1)
    }

    gravadas++
    if (gravadas % 10 === 0 || gravadas === questoes.length) {
      process.stdout.write(`\rGravadas ${gravadas}/${questoes.length}`)
    }
  }

  console.log('\n')
  if (semAssunto.length > 0) {
    console.log('Assuntos nao encontrados (questao entrou sem vinculo):')
    for (const s of semAssunto) console.log(`  ${s}`)
    console.log('')
  }
  console.log(`${gravadas} questoes importadas.`)
}

main().catch((e) => {
  console.error('\nImportacao interrompida:', e instanceof Error ? e.message : e)
  process.exit(1)
})
