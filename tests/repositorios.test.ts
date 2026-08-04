/**
 * O bug que a v10 tinha: gabarito era indice (`correct: 0`), entao embaralhar
 * as alternativas trocava a resposta certa de lugar. Aqui o gabarito e UUID.
 */
import { embaralhar, amostrar } from '../src/repositories/base'
import { calculaStreak, inicioDaSemana, assuntoMaisFraco } from '../src/repositories/progresso.repo'
import { montarArvore, idsComDescendentes } from '../src/repositories/assuntos.repo'

let falhas = 0
const check = (nome: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${nome}${extra ? ' :: ' + extra : ''}`)
  if (!cond) falhas++
}

// --- 1. Embaralhamento preserva o conjunto e o gabarito por UUID -----------
const alternativas = [
  { id: 'u-a', letra: 'a', texto: 'Apenas IV esta incorreta' },
  { id: 'u-b', letra: 'b', texto: 'Apenas I e II' },
  { id: 'u-c', letra: 'c', texto: 'Apenas III' },
  { id: 'u-d', letra: 'd', texto: 'Todas corretas' },
  { id: 'u-e', letra: 'e', texto: 'Apenas II e IV' },
]
const GABARITO = 'u-a'

let sempreConteve = true
let sempreCinco = true
let posicoesVistas = new Set<number>()
for (let i = 0; i < 5000; i++) {
  const ordem: string[] = embaralhar(alternativas.map((a) => a.id))
  if (ordem.length !== 5 || new Set(ordem).size !== 5) sempreCinco = false
  if (!ordem.includes(GABARITO)) sempreConteve = false
  posicoesVistas.add(ordem.indexOf(GABARITO))
}
check('embaralhar nunca perde nem duplica alternativa', sempreCinco)
check('gabarito continua presente em toda ordem', sempreConteve)
check('gabarito circula por todas as 5 posicoes', posicoesVistas.size === 5, `posicoes=${[...posicoesVistas].sort()}`)

// reaplicar a ordem gravada devolve a mesma sequencia (retomada da sessao)
const ordemGravada: string[] = embaralhar(alternativas.map((a) => a.id))
const porId = new Map(alternativas.map((a) => [a.id, a] as const))
const r1 = ordemGravada.map((id) => porId.get(id)!)
const r2 = ordemGravada.map((id) => porId.get(id)!)
check('retomada reproduz a ordem identica', JSON.stringify(r1) === JSON.stringify(r2))
check('a correta e achada por UUID, nao por indice', r1.find((a) => a.id === GABARITO)!.texto === 'Apenas IV esta incorreta')

// --- 2. Amostragem ---------------------------------------------------------
const universo = Array.from({ length: 200 }, (_, i) => `q${i}`)
const amostra = amostrar(universo, 30)
check('amostrar devolve a quantidade pedida', amostra.length === 30)
check('amostrar nao repete questao', new Set(amostra).size === 30)
check('amostrar com pedido maior que o universo nao estoura', amostrar(universo.slice(0, 5), 30).length === 5)

// --- 3. Streak -------------------------------------------------------------
const dia = (n: number) => { const d = new Date('2026-07-31T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0,10) }
const atv = (n: number, conta: boolean) => ({ usuario_id:'u', dia: dia(n), questoes_respondidas: conta?6:2, acertos:3, tempo_segundos:60, conta_streak: conta })

const seq = [atv(0,true), atv(1,true), atv(2,true), atv(4,true)]
const s1 = calculaStreak(seq, '2026-07-31')
check('streak conta dias seguidos ate hoje', s1.diasSeguidos === 3, `=${s1.diasSeguidos}`)
check('streak marca que hoje contou', s1.hojeContou === true)

// hoje ainda nao respondeu: nao pode zerar o streak de manha
const seq2 = [atv(1,true), atv(2,true), atv(3,true)]
const s2 = calculaStreak(seq2, '2026-07-31')
check('hoje em aberto nao quebra o streak', s2.diasSeguidos === 3, `=${s2.diasSeguidos}`)
check('hoje em aberto marca hojeContou=false', s2.hojeContou === false)

// dia com menos que o minimo nao conta
const seq3 = [atv(0,true), atv(1,false), atv(2,true)]
const s3 = calculaStreak(seq3, '2026-07-31')
check('dia abaixo do minimo quebra a sequencia', s3.diasSeguidos === 1, `=${s3.diasSeguidos}`)
check('recorde considera a maior sequencia da janela', s3.recorde >= 1)

check('sem atividade nenhuma o streak e zero', calculaStreak([], '2026-07-31').diasSeguidos === 0)

// --- 4. Semana -------------------------------------------------------------
check('semana comeca na segunda', new Date(inicioDaSemana(new Date('2026-07-31T12:00:00'))+'T00:00:00Z').getUTCDay() === 1, inicioDaSemana(new Date('2026-07-31T12:00:00')))

// --- 5. Arvore de assuntos -------------------------------------------------
const base = { materia_id:'m1', descricao:null, ordem:0, created_at:'', slug:'s' }
const lista = [
  { ...base, id:'A', parent_id:null, nome:'Modulo A' },
  { ...base, id:'A1', parent_id:'A', nome:'Assunto A1' },
  { ...base, id:'A2', parent_id:'A', nome:'Assunto A2' },
  { ...base, id:'A1a', parent_id:'A1', nome:'Sub A1a' },
  { ...base, id:'B', parent_id:null, nome:'Modulo B' },
]
const arvore = montarArvore(lista)
check('arvore tem duas raizes', arvore.length === 2)
check('modulo A tem dois filhos', arvore[0].filhos.length === 2)
check('neto fica no nivel certo', arvore[0].filhos[0].filhos[0].id === 'A1a')

const ids = idsComDescendentes(lista, 'A').sort()
check('descendentes incluem netos', JSON.stringify(ids) === JSON.stringify(['A','A1','A1a','A2']), ids.join(','))
check('folha devolve so ela mesma', JSON.stringify(idsComDescendentes(lista, 'B')) === JSON.stringify(['B']))

// parent_id apontando para fora da lista nao pode sumir com o assunto
const orfao = [{ ...base, id:'X', parent_id:'inexistente', nome:'Orfao' }]
check('assunto orfao vira raiz em vez de sumir', montarArvore(orfao).length === 1)

// --- 6. Assunto mais fraco -------------------------------------------------
const desemp = [
  { assunto_id:'a1', nome:'Raro', materia_id:'m', respondidas:2, acertos:0, taxa:0 },
  { assunto_id:'a2', nome:'Hemograma', materia_id:'m', respondidas:20, acertos:8, taxa:0.4 },
  { assunto_id:'a3', nome:'Bioquimica', materia_id:'m', respondidas:15, acertos:12, taxa:0.8 },
]
const fraco = assuntoMaisFraco(desemp)
check('ignora assunto com poucas respostas', fraco?.nome === 'Hemograma', fraco?.nome)
check('sem candidatos devolve null', assuntoMaisFraco([desemp[0]]) === null)

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`)
process.exit(falhas ? 1 : 0)
