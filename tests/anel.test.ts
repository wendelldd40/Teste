import { tracoDoArco, circunferencia, RAIO_EXTERNO, RAIO_INTERNO } from '../src/components/progresso/AnelProgresso'
let falhas = 0
const ck = (n: string, c: boolean, x='') => { console.log(`${c?'OK  ':'FALHA'} ${n}${x?' :: '+x:''}`); if(!c) falhas++ }

const c = circunferencia(RAIO_EXTERNO)
const arco = (p: number) => parseFloat(tracoDoArco(p, RAIO_EXTERNO).dasharray.split(' ')[0])

ck('progresso 0 nao desenha arco', arco(0) === 0)
ck('progresso 1 fecha a volta', Math.abs(arco(1) - c) < 0.01)
ck('progresso 0.5 e meia volta', Math.abs(arco(0.5) - c/2) < 0.01)
ck('progresso acima de 1 nao da mais que uma volta', Math.abs(arco(1.4) - c) < 0.01, `arco=${arco(1.4).toFixed(1)} c=${c.toFixed(1)}`)
ck('progresso negativo vira zero', arco(-0.3) === 0)
ck('NaN vira zero em vez de quebrar o SVG', arco(NaN) === 0)
ck('Infinity vira volta completa', Math.abs(arco(Infinity) - c) < 0.01)
ck('porcentagem arredonda certo', tracoDoArco(0.666, RAIO_EXTERNO).porcentagem === 67)
ck('anel interno usa raio menor', circunferencia(RAIO_INTERNO) < c)

// meta zerada nao pode gerar divisao por zero na origem (progressoSemanal ja vem 0)
ck('meta zero -> arco zero', arco(0/0 || 0) === 0)

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nANEL OK')

// gerar SVG para inspecao visual
import { writeFileSync } from 'node:fs'
const cenarios: Array<[string, number, number, number, number]> = [
  ['comeco da semana', 1, 6, 100, 0.06],
  ['meio da semana', 3, 48, 100, 0.48],
  ['meta batida', 7, 112, 100, 1],
  ['sem streak', 0, 0, 60, 0],
]
for (const [nome, dias, feitas, meta, prog] of cenarios) {
  const ext = tracoDoArco(prog, RAIO_EXTERNO)
  const int = tracoDoArco(Math.min(dias,7)/7, RAIO_INTERNO)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 128" width="640" height="256">
<rect width="320" height="128" fill="#FFFFFF"/>
<g transform="rotate(-90 64 64)">
<circle cx="64" cy="64" r="${RAIO_EXTERNO}" fill="none" stroke="#12876C" stroke-opacity="0.15" stroke-width="10"/>
<circle cx="64" cy="64" r="${RAIO_EXTERNO}" fill="none" stroke="#12876C" stroke-width="10" stroke-linecap="round" stroke-dasharray="${ext.dasharray}"/>
<circle cx="64" cy="64" r="${RAIO_INTERNO}" fill="none" stroke="#C99D66" stroke-opacity="0.2" stroke-width="7"/>
<circle cx="64" cy="64" r="${RAIO_INTERNO}" fill="none" stroke="#C99D66" stroke-width="7" stroke-linecap="round" stroke-dasharray="${int.dasharray}"/>
</g>
<text x="136" y="52" font-family="sans-serif" font-size="30" font-weight="800" fill="#0C3328">${dias}</text>
<text x="${136+(String(dias).length*18)}" y="52" font-family="sans-serif" font-size="12" font-weight="600" fill="#75887D">${dias===1?'dia seguido':'dias seguidos'}</text>
<text x="136" y="76" font-family="sans-serif" font-size="13" fill="#44594E">${feitas} de ${meta} na semana</text>
<text x="136" y="96" font-family="sans-serif" font-size="11" fill="#75887D">${nome}</text>
</svg>`
  writeFileSync(`/tmp/anel/${nome.replace(/ /g,'-')}.svg`, svg)
}
process.exit(falhas?1:0)
