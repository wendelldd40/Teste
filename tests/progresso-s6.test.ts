import { coordenadas, caminhoDaLinha, LARGURA, ALTURA } from '../src/components/progresso/GraficoAcerto'
import { progressoMedalha } from '../src/components/progresso/Medalha'

let f = 0
const ck = (n: string, c: boolean, x = '') => { console.log(`${c?'OK  ':'FALHA'} ${n}${x?' :: '+x:''}`); if(!c) f++ }
const p = (semana: string, taxa: number) => ({ semana, taxa, respondidas: 10 })

// --- Grafico ---------------------------------------------------------------
ck('serie vazia nao gera coordenada', coordenadas([]).length === 0)
ck('serie vazia gera caminho vazio', caminhoDaLinha([]) === '')

const um = coordenadas([p('2026-07-27', 0.8)])
ck('ponto unico fica no centro, nao na borda', Math.abs(um[0].x - LARGURA/2) < 20, `x=${um[0].x.toFixed(0)}`)

const serie = [p('2026-06-01', 0), p('2026-06-08', 0.5), p('2026-06-15', 1)]
const c = coordenadas(serie)
ck('primeiro ponto na margem esquerda', c[0].x < LARGURA * 0.1)
ck('ultimo ponto na margem direita', c[2].x > LARGURA * 0.9)
ck('taxa 1 fica no topo', c[2].y < c[1].y && c[1].y < c[0].y, `y=${c.map((v) => v.y.toFixed(0)).join(',')}`)
ck('taxa 0 fica dentro da area', c[0].y <= ALTURA && c[0].y > 0)
ck('caminho comeca com M e tem 3 comandos', caminhoDaLinha(c).startsWith('M') && caminhoDaLinha(c).split(/[ML]/).length === 4)

const fora = coordenadas([p('a', -0.5), p('b', 1.7), p('c', NaN)])
ck('taxa negativa nao sai da area', fora[0].y <= ALTURA && fora[0].y > 0)
ck('taxa acima de 1 nao sai da area', fora[1].y >= 0)
ck('NaN nao gera coordenada NaN', Number.isFinite(fora[2].y) && Number.isFinite(fora[2].x))
ck('caminho nunca contem NaN', !caminhoDaLinha(fora).includes('NaN'))

// --- Medalha ---------------------------------------------------------------
ck('progresso medalha normal', Math.abs(progressoMedalha(50, 100) - 0.5) < 0.001)
ck('progresso passa do alvo mas trava em 1', progressoMedalha(500, 100) === 1)
ck('alvo zero nao divide por zero', progressoMedalha(10, 0) === 0)
ck('valor negativo vira zero', progressoMedalha(-5, 100) === 0)
ck('NaN vira zero', progressoMedalha(NaN, 100) === 0)

console.log(f ? `\n${f} FALHA(S)` : '\nS6 OK')
process.exit(f?1:0)
