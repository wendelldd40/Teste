/**
 * EstudeVet v11 - Sprint 2 - Migracao legado -> schema novo.
 *
 *   npx tsx scripts/migracao/migrar.ts --arquivo legado.json --dry-run
 *   npx tsx scripts/migracao/migrar.ts --arquivo legado.json --executar
 *
 * GARANTIA: este script NUNCA escreve, altera ou apaga nada no banco antigo.
 * A origem e um arquivo JSON. O destino e o Supabase novo. Nao existe conexao
 * com o projeto antigo em lugar nenhum deste arquivo.
 *
 * Ordem de execucao:
 *   1. le o dump e resolve a materia de cada questao;
 *   2. parseia (alternativas, assertivas, gabarito, dificuldade);
 *   3. classifica os temas livres em assuntos;
 *   4. grava assuntos, questoes, alternativas, assertivas e vinculos;
 *   5. imprime o relatorio e escreve os arquivos de conferencia.
 *
 * Idempotente: reexecutar nao duplica. A chave e `origem_legado_id`.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createClient } from '@supabase/supabase-js'

/** Mesmo valor de src/lib/supabase/config.ts. Publico por natureza. */
const SUPABASE_URL_PADRAO = 'https://gfshmgllnrzjxuutqrte.supabase.co'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, StatusRevisao } from '../../src/types/database'
import type { DumpLegado, QuestaoLegado } from './legado.types'
import { MAPA_MATERIAS, MAPA_MATERIAS_POR_NOME, TABELAS_DESCARTADAS } from './legado.types'
import { parseQuestao } from './parse-questao'
import type { QuestaoParseada, QuestaoRejeitada } from './parse-questao'
import { classificaTemas, semAcento } from './classifica-temas'

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const arquivo = valorDe('--arquivo') ?? 'legado.json'
const executar = args.includes('--executar')
const dryRun = !executar
const pastaSaida = valorDe('--saida') ?? 'scripts/migracao/relatorios'

function valorDe(flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

// ---------------------------------------------------------------------------
// Cliente (service role: a migracao roda por fora da RLS, de proposito)
// ---------------------------------------------------------------------------

// A URL cai no valor embutido; so a service_role precisa vir do ambiente.
const url = process.env.SUPABASE_URL ?? SUPABASE_URL_PADRAO
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!dryRun && !serviceRole) {
  console.error(
    'Falta SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local).\n' +
      'Use --dry-run para conferir o parse sem tocar no banco.'
  )
  process.exit(1)
}

const sb =
  url && serviceRole
    ? createClient<Database>(url, serviceRole, {
        auth: { persistSession: false },
      })
    : null

// ---------------------------------------------------------------------------
// Relatorio
// ---------------------------------------------------------------------------

interface LinhaRelatorio {
  lido: number
  limpo: number
  revisao: number
  rejeitado: number
}

const relatorio = new Map<string, LinhaRelatorio>()

function conta(materia: string, campo: keyof LinhaRelatorio) {
  if (!relatorio.has(materia)) {
    relatorio.set(materia, { lido: 0, limpo: 0, revisao: 0, rejeitado: 0 })
  }
  relatorio.get(materia)![campo] += 1
}

// ---------------------------------------------------------------------------
// Passo 1: leitura e resolucao de materia
// ---------------------------------------------------------------------------

function resolveMateriaSlug(q: QuestaoLegado): string | null {
  const key = (q.materia ?? '').trim().toLowerCase()
  if (key && MAPA_MATERIAS[key]) return MAPA_MATERIAS[key]

  const nome = semAcento((q.materia_nome ?? '').trim().toLowerCase())
  if (nome && MAPA_MATERIAS_POR_NOME[nome]) return MAPA_MATERIAS_POR_NOME[nome]

  return null
}

async function main() {
  const caminho = resolve(process.cwd(), arquivo)
  const dump = JSON.parse(readFileSync(caminho, 'utf8')) as DumpLegado

  console.log('='.repeat(72))
  console.log('EstudeVet v11 - Migracao legado -> schema novo')
  console.log('='.repeat(72))
  console.log(`Arquivo:  ${caminho}`)
  console.log(`Exportado em: ${dump.exportado_em ?? 'nao informado'}`)
  console.log(`Modo:     ${dryRun ? 'DRY-RUN (nao escreve nada)' : 'EXECUCAO'}`)
  console.log(`Descartadas por decisao de escopo: ${TABELAS_DESCARTADAS.join(', ')}`)
  console.log('')

  const questoesLegado = dump.questoes ?? []
  const aprovadas: QuestaoParseada[] = []
  const rejeitadas: QuestaoRejeitada[] = []

  for (const q of questoesLegado) {
    const slug = resolveMateriaSlug(q)
    const rotulo = slug ?? `(sem mapeamento: ${q.materia ?? 'null'})`
    conta(rotulo, 'lido')

    const r = parseQuestao(q, slug)
    if (!r.ok) {
      rejeitadas.push(r.rejeitada)
      conta(rotulo, 'rejeitado')
      continue
    }

    aprovadas.push(r.questao)
    conta(rotulo, r.questao.motivos_revisao.length > 0 ? 'revisao' : 'limpo')
  }

  // -------------------------------------------------------------------------
  // Passo 2: temas -> assuntos
  // -------------------------------------------------------------------------

  const { porMateria, ambiguos } = classificaTemas(
    aprovadas.map((q) => ({ materia_slug: q.materia_slug, tema: q.tema_original }))
  )

  // tema original -> slug do assunto, por materia
  const indiceTema = new Map<string, string>()
  for (const [materia, grupos] of porMateria) {
    for (const g of grupos) {
      for (const v of g.variantes) indiceTema.set(`${materia}::${v}`, g.slug)
    }
  }

  // -------------------------------------------------------------------------
  // Passo 3: escrita
  // -------------------------------------------------------------------------

  if (!dryRun && sb) {
    await gravar(sb, aprovadas, porMateria, indiceTema)
  }

  // -------------------------------------------------------------------------
  // Passo 4: relatorio
  // -------------------------------------------------------------------------

  imprimeRelatorio(questoesLegado.length, aprovadas, rejeitadas, ambiguos.length)
  escreveArquivos(rejeitadas, ambiguos, porMateria, aprovadas)

  if (dryRun) {
    console.log('\nNada foi gravado. Confira os arquivos em ' + pastaSaida + ' e rode com --executar.')
  }
}

// ---------------------------------------------------------------------------
// Gravacao
// ---------------------------------------------------------------------------

async function gravar(
  sb: SupabaseClient<Database>,
  aprovadas: QuestaoParseada[],
  porMateria: Map<string, Array<{ canonico: string; slug: string }>>,
  indiceTema: Map<string, string>
) {
  // Materias (ja existem pelo seed): slug -> id
  const { data: materias, error: erroMaterias } = await sb
    .from('materias')
    .select('id, slug')
  if (erroMaterias) throw erroMaterias

  const idMateria = new Map<string, string>(
    (materias ?? []).map((m: { slug: string; id: string }) => [m.slug, m.id])
  )

  const faltando = [...porMateria.keys()].filter((s) => !idMateria.has(s))
  if (faltando.length) {
    throw new Error(
      `Materias ausentes no banco novo: ${faltando.join(', ')}. Rode o seed antes.`
    )
  }

  // Assuntos
  const linhasAssunto = [...porMateria.entries()].flatMap(([materia, grupos]) =>
    grupos.map((g, i) => ({
      materia_id: idMateria.get(materia)!,
      nome: g.canonico,
      slug: g.slug,
      ordem: i,
    }))
  )

  if (linhasAssunto.length) {
    const { error } = await sb
      .from('assuntos')
      .upsert(linhasAssunto, { onConflict: 'materia_id,slug' })
    if (error) throw error
  }

  const { data: assuntos, error: erroAssuntos } = await sb
    .from('assuntos')
    .select('id, slug, materia_id')
  if (erroAssuntos) throw erroAssuntos

  const idAssunto = new Map<string, string>(
    (assuntos ?? []).map((a: { materia_id: string; slug: string; id: string }) => [
      `${a.materia_id}::${a.slug}`,
      a.id,
    ])
  )

  // Questoes, em lotes. Status: precisa_revisao quando ha pendencia,
  // publicada quando esta completa.
  const LOTE = 100
  let gravadas = 0

  for (let i = 0; i < aprovadas.length; i += LOTE) {
    const lote = aprovadas.slice(i, i + LOTE)

    const linhasQuestao = lote.map((q) => ({
      materia_id: idMateria.get(q.materia_slug)!,
      tipo: q.tipo,
      dificuldade: q.dificuldade,
      enunciado: q.enunciado,
      comentario: q.comentario,
      status: (q.motivos_revisao.length > 0
        ? 'precisa_revisao'
        : 'publicada') as StatusRevisao,
      origem_legado_id: q.origem_legado_id,
    }))

    const { data: inseridas, error } = await sb
      .from('questoes')
      .upsert(linhasQuestao, { onConflict: 'origem_legado_id' })
      .select('id, origem_legado_id')
    if (error) throw error

    const idPorLegado = new Map<string, string>(
      (inseridas ?? [])
        .filter((r): r is { id: string; origem_legado_id: string } =>
          r.origem_legado_id !== null
        )
        .map((r) => [r.origem_legado_id, r.id] as const)
    )

    const alternativas = lote.flatMap((q) => {
      const id = idPorLegado.get(q.origem_legado_id)
      if (!id) return []
      return q.alternativas.map((a) => ({
        questao_id: id,
        letra: a.letra,
        texto: a.texto,
        correta: a.correta,
      }))
    })

    const assertivasLinhas = lote.flatMap((q) => {
      const id = idPorLegado.get(q.origem_legado_id)
      if (!id) return []
      return q.assertivas.map((a) => ({
        questao_id: id,
        ordem: a.ordem,
        numeral: a.numeral,
        texto: a.texto,
        correta: null,
      }))
    })

    const vinculos = lote.flatMap((q) => {
      const id = idPorLegado.get(q.origem_legado_id)
      if (!id || !q.tema_original) return []
      const slugAssunto = indiceTema.get(`${q.materia_slug}::${q.tema_original}`)
      if (!slugAssunto) return []
      const chave = `${idMateria.get(q.materia_slug)}::${slugAssunto}`
      const assuntoId = idAssunto.get(chave)
      return assuntoId ? [{ questao_id: id, assunto_id: assuntoId }] : []
    })

    if (alternativas.length) {
      const { error: e } = await sb
        .from('alternativas')
        .upsert(alternativas, { onConflict: 'questao_id,letra' })
      if (e) throw e
    }
    if (assertivasLinhas.length) {
      const { error: e } = await sb
        .from('assertivas')
        .upsert(assertivasLinhas, { onConflict: 'questao_id,ordem' })
      if (e) throw e
    }
    if (vinculos.length) {
      const { error: e } = await sb
        .from('questao_assuntos')
        .upsert(vinculos, { onConflict: 'questao_id,assunto_id' })
      if (e) throw e
    }

    gravadas += lote.length
    process.stdout.write(`\rGravadas ${gravadas}/${aprovadas.length} questoes`)
  }

  console.log('')
}

// ---------------------------------------------------------------------------
// Saida
// ---------------------------------------------------------------------------

function imprimeRelatorio(
  totalLido: number,
  aprovadas: QuestaoParseada[],
  rejeitadas: QuestaoRejeitada[],
  ambiguos: number
) {
  console.log('\n' + '-'.repeat(72))
  console.log('RELATORIO POR MATERIA')
  console.log('-'.repeat(72))

  const cab = ['MATERIA'.padEnd(40), 'LIDO'.padStart(6), 'LIMPO'.padStart(7), 'REVISAO'.padStart(9), 'REJEIT.'.padStart(9)]
  console.log(cab.join(''))

  const chaves = [...relatorio.keys()].sort()
  const soma: LinhaRelatorio = { lido: 0, limpo: 0, revisao: 0, rejeitado: 0 }

  for (const k of chaves) {
    const l = relatorio.get(k)!
    soma.lido += l.lido
    soma.limpo += l.limpo
    soma.revisao += l.revisao
    soma.rejeitado += l.rejeitado
    console.log(
      k.slice(0, 39).padEnd(40) +
        String(l.lido).padStart(6) +
        String(l.limpo).padStart(7) +
        String(l.revisao).padStart(9) +
        String(l.rejeitado).padStart(9)
    )
  }

  console.log('-'.repeat(72))
  console.log(
    'TOTAL'.padEnd(40) +
      String(soma.lido).padStart(6) +
      String(soma.limpo).padStart(7) +
      String(soma.revisao).padStart(9) +
      String(soma.rejeitado).padStart(9)
  )

  if (totalLido !== soma.lido) {
    console.log(`\nAviso: dump tem ${totalLido} questoes e o relatorio somou ${soma.lido}.`)
  }

  // Motivos, para saber onde doi.
  const porMotivoRevisao = new Map<string, number>()
  for (const q of aprovadas) {
    for (const m of q.motivos_revisao) {
      porMotivoRevisao.set(m, (porMotivoRevisao.get(m) ?? 0) + 1)
    }
  }
  if (porMotivoRevisao.size) {
    console.log('\nMOTIVOS DE REVISAO')
    for (const [m, n] of [...porMotivoRevisao].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${m}`)
    }
  }

  const porMotivoRejeicao = new Map<string, number>()
  for (const r of rejeitadas) {
    porMotivoRejeicao.set(r.motivo, (porMotivoRejeicao.get(r.motivo) ?? 0) + 1)
  }
  if (porMotivoRejeicao.size) {
    console.log('\nMOTIVOS DE REJEICAO (nao importadas)')
    for (const [m, n] of [...porMotivoRejeicao].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${m}`)
    }
  }

  if (ambiguos) {
    console.log(`\n${ambiguos} par(es) de tema ambiguo aguardando sua decisao.`)
  }
}

function escreveArquivos(
  rejeitadas: QuestaoRejeitada[],
  ambiguos: Array<{ materia_slug: string; a: string; b: string; similaridade: number; motivo: string }>,
  porMateria: Map<string, Array<{ canonico: string; slug: string; quantidade: number }>>,
  aprovadas: QuestaoParseada[]
) {
  mkdirSync(resolve(process.cwd(), pastaSaida), { recursive: true })
  const salva = (nome: string, conteudo: string) => {
    const p = resolve(process.cwd(), pastaSaida, nome)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, conteudo, 'utf8')
    console.log(`  ${p}`)
  }

  console.log('\nARQUIVOS DE CONFERENCIA')

  salva(
    'rejeitadas.csv',
    ['id_legado;materia;motivo;detalhe']
      .concat(
        rejeitadas.map((r) =>
          [r.origem_legado_id, r.materia_key ?? '', r.motivo, r.detalhe.replace(/;/g, ',')].join(';')
        )
      )
      .join('\n')
  )

  salva(
    'temas-ambiguos.csv',
    ['materia;tema_a;tema_b;similaridade;motivo;decisao_manual']
      .concat(
        ambiguos.map((p) =>
          [p.materia_slug, p.a, p.b, p.similaridade, p.motivo, ''].join(';')
        )
      )
      .join('\n')
  )

  salva(
    'assuntos-propostos.csv',
    ['materia;assunto;slug;questoes']
      .concat(
        [...porMateria.entries()].flatMap(([m, gs]) =>
          gs.map((g) => [m, g.canonico, g.slug, g.quantidade].join(';'))
        )
      )
      .join('\n')
  )

  salva(
    'precisa-revisao.csv',
    ['id_legado;materia;motivos;enunciado']
      .concat(
        aprovadas
          .filter((q) => q.motivos_revisao.length > 0)
          .map((q) =>
            [
              q.origem_legado_id,
              q.materia_slug,
              q.motivos_revisao.join('|'),
              q.enunciado.slice(0, 120).replace(/[\r\n;]/g, ' '),
            ].join(';')
          )
      )
      .join('\n')
  )
}

main().catch((e) => {
  console.error('\nMigracao interrompida:', e instanceof Error ? e.message : e)
  console.error('O banco antigo permanece intacto.')
  process.exit(1)
})
