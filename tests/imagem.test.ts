import { writeFileSync, mkdirSync } from 'node:fs'
import { capaFallbackSvg, iniciais, calcularRecorte16x9 } from '../src/lib/imagem'

mkdirSync('/tmp/capas', { recursive: true })

const materias = [
  ['Analises Clinicas Veterinarias', 'analises-clinicas-veterinarias'],
  ['Farmacologia Veterinaria e Toxicologia', 'farmacologia-veterinaria-e-toxicologia'],
  ['Patologia Veterinaria Geral', 'patologia-veterinaria-geral'],
  ['Semiologia Basica', 'semiologia-basica'],
  ['Inspecao de Leite, Produtos Lacteos e Mel', 'inspecao-de-leite-produtos-lacteos-e-mel'],
  ['Zootecnia I', 'zootecnia-i'],
  ['Aquicultura', 'aquicultura'],
]

// determinismo: mesma materia, mesma capa
for (const [nome, slug] of materias) {
  const a = capaFallbackSvg(nome, slug)
  const b = capaFallbackSvg(nome, slug)
  if (a !== b) { console.error('FALHA determinismo:', nome); process.exit(1) }
  writeFileSync(`/tmp/capas/${slug}.svg`, a)
  console.log(`${iniciais(nome).padEnd(3)} ${nome}`)
}

// recorte 16:9
const casos: Array<[number, number, string]> = [
  [1920, 1080, 'ja 16:9'],
  [4000, 3000, 'foto 4:3 (sobra nos lados)'],
  [1080, 1920, 'vertical de celular'],
  [800, 450, 'menor que o alvo'],
  [3000, 1000, 'panoramica'],
]
console.log('\nRECORTE 16:9')
let falhas = 0
for (const [w, h, desc] of casos) {
  const r = calcularRecorte16x9(w, h)
  const prop = r.largura / r.altura
  const dentro = Math.abs(prop - 16/9) < 0.01
  const cabe = r.x >= 0 && r.y >= 0 && r.x + r.largura <= w && r.y + r.altura <= h
  const centrado = Math.abs((w - r.largura)/2 - r.x) <= 1 && Math.abs((h - r.altura)/2 - r.y) <= 1
  const ok = dentro && cabe && centrado
  if (!ok) falhas++
  console.log(`${ok?'OK  ':'FALHA'} ${String(w)+'x'+String(h)} ${desc.padEnd(28)} -> ${r.largura}x${r.altura} em (${r.x},${r.y}) prop=${prop.toFixed(3)}`)
}
try { calcularRecorte16x9(0, 100); console.log('FALHA aceita dimensao zero'); falhas++ }
catch { console.log('OK   recusa dimensao invalida') }
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nRECORTE OK')
process.exit(falhas ? 1 : 0)
