'use client'

/**
 * Editor da fila de revisao.
 *
 * O botao "Publicar" pode falhar legitimamente: o trigger do banco recusa
 * questao sem 5 alternativas ou sem gabarito unico. A tela conferе antes
 * para explicar o que falta, mas nao confia nessa conferencia - quem decide
 * e o banco, e o erro dele aparece aqui em vez de virar um sucesso falso.
 */

import { useState, useTransition } from 'react'
import { AreaTexto, Botao, Campo, Cartao, Entrada, Erro, Selecao, Selo } from '@/components/ui'
import { publicarQuestao, salvarQuestao } from '@/app/(app)/admin/actions'
import type { Dificuldade, StatusRevisao, TipoQuestao } from '@/types/database'

const LETRAS = ['a', 'b', 'c', 'd', 'e'] as const

export interface AlternativaEditavel {
  letra: string
  texto: string
  correta: boolean
}

export interface AssertivaEditavel {
  ordem: number
  numeral: string
  texto: string
  correta: boolean | null
}

export interface QuestaoParaEditar {
  id: string
  materia_id: string
  materia_nome: string
  tipo: TipoQuestao
  dificuldade: Dificuldade
  enunciado: string
  comentario: string | null
  status: StatusRevisao
  alternativas: AlternativaEditavel[]
  assertivas: AssertivaEditavel[]
  assunto_ids: string[]
}

/** O que impede publicar. Mesmas regras do trigger, ditas em portugues. */
export function pendenciasParaPublicar(q: {
  enunciado: string
  comentario: string | null
  tipo: TipoQuestao
  alternativas: AlternativaEditavel[]
  assertivas: AssertivaEditavel[]
}): string[] {
  const faltas: string[] = []

  if (q.enunciado.trim().length < 10) faltas.push('O enunciado está muito curto.')

  const preenchidas = q.alternativas.filter((a) => a.texto.trim().length > 0)
  if (preenchidas.length !== 5) {
    faltas.push(`Faltam alternativas: ${preenchidas.length} de 5 preenchidas.`)
  }

  const corretas = q.alternativas.filter((a) => a.correta)
  if (corretas.length === 0) faltas.push('Nenhuma alternativa está marcada como correta.')
  if (corretas.length > 1) faltas.push('Mais de uma alternativa está marcada como correta.')

  if (q.tipo !== 'multipla_escolha') {
    const comTexto = q.assertivas.filter((a) => a.texto.trim().length > 0)
    if (comTexto.length < 2) faltas.push('Questão de assertivas precisa de ao menos duas.')
    if (q.tipo === 'julgamento' && comTexto.some((a) => a.correta === null)) {
      faltas.push('Toda assertiva precisa de gabarito neste tipo de questão.')
    }
  }

  if (!q.comentario || q.comentario.trim().length === 0) {
    faltas.push('Sem comentário: o aluno não vai entender por que errou.')
  }

  return faltas
}

export function EditorQuestao({ inicial }: { inicial: QuestaoParaEditar }) {
  const [q, setQ] = useState(inicial)
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [processando, iniciar] = useTransition()

  const alternativas = LETRAS.map(
    (letra) =>
      q.alternativas.find((a) => a.letra === letra) ?? { letra, texto: '', correta: false }
  )
  const faltas = pendenciasParaPublicar({ ...q, alternativas })

  function alterarAlternativa(letra: string, campos: Partial<AlternativaEditavel>) {
    setQ((atual) => ({
      ...atual,
      alternativas: LETRAS.map((l) => {
        const base = atual.alternativas.find((a) => a.letra === l) ?? {
          letra: l,
          texto: '',
          correta: false,
        }
        if (l !== letra) {
          // Marcar uma correta desmarca as outras: o banco so aceita uma.
          return campos.correta ? { ...base, correta: false } : base
        }
        return { ...base, ...campos }
      }),
    }))
  }

  function salvar(status: StatusRevisao) {
    setErro(null)
    setAviso(null)
    iniciar(async () => {
      const r = await salvarQuestao({
        id: q.id,
        materia_id: q.materia_id,
        tipo: q.tipo,
        dificuldade: q.dificuldade,
        enunciado: q.enunciado,
        comentario: q.comentario,
        status,
        alternativas: alternativas.filter((a) => a.texto.trim().length > 0),
        assertivas: q.assertivas.filter((a) => a.texto.trim().length > 0),
        assunto_ids: q.assunto_ids,
      })
      if (!r.ok) {
        setErro({ mensagem: r.mensagem ?? 'Não foi possível salvar.', detalhe: r.detalhe })
        return
      }
      setQ((atual) => ({ ...atual, status }))
      setAviso('Alterações salvas.')
    })
  }

  function publicar() {
    setErro(null)
    setAviso(null)
    iniciar(async () => {
      const r = await publicarQuestao(q.id)
      if (!r.ok) {
        setErro({
          mensagem: r.mensagem ?? 'O banco recusou a publicação.',
          detalhe: r.detalhe,
        })
        return
      }
      setQ((atual) => ({ ...atual, status: 'publicada' }))
      setAviso('Questão publicada.')
    })
  }

  return (
    <Cartao className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-corpo text-xs uppercase tracking-wide text-tinta-fraca">
            {q.materia_nome}
          </p>
          <Selo status={q.status} />
        </div>
        <Selecao
          value={q.dificuldade}
          onChange={(e) => setQ({ ...q, dificuldade: e.target.value as Dificuldade })}
          className="w-40"
        >
          <option value="facil">Fácil</option>
          <option value="medio">Médio</option>
          <option value="dificil">Difícil</option>
        </Selecao>
      </div>

      <Campo rotulo="Enunciado">
        <AreaTexto value={q.enunciado} onChange={(e) => setQ({ ...q, enunciado: e.target.value })} />
      </Campo>

      {q.assertivas.length > 0 && (
        <div>
          <p className="font-corpo text-sm font-semibold text-tinta-forte">Assertivas</p>
          <div className="mt-2 space-y-2">
            {q.assertivas.map((a) => (
              <div key={a.ordem} className="flex items-start gap-2">
                <span className="mt-2 w-8 shrink-0 font-corpo text-sm font-bold text-tinta-fraca">
                  {a.numeral}
                </span>
                <Entrada
                  value={a.texto}
                  onChange={(e) =>
                    setQ({
                      ...q,
                      assertivas: q.assertivas.map((x) =>
                        x.ordem === a.ordem ? { ...x, texto: e.target.value } : x
                      ),
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="font-corpo text-sm font-semibold text-tinta-forte">Alternativas</p>
        <p className="font-corpo text-xs text-tinta-fraca">
          Marque a correta. So uma pode ficar marcada.
        </p>
        <div className="mt-2 space-y-2">
          {alternativas.map((a) => (
            <div key={a.letra} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correta-${q.id}`}
                checked={a.correta}
                onChange={() => alterarAlternativa(a.letra, { correta: true })}
                aria-label={`Alternativa ${a.letra.toUpperCase()} e a correta`}
                className="h-4 w-4 shrink-0 accent-[#12876C]"
              />
              <span className="w-6 shrink-0 font-corpo text-sm font-bold uppercase text-tinta-fraca">
                {a.letra}
              </span>
              <Entrada
                value={a.texto}
                onChange={(e) => alterarAlternativa(a.letra, { texto: e.target.value })}
                placeholder={`Texto da alternativa ${a.letra.toUpperCase()}`}
              />
            </div>
          ))}
        </div>
      </div>

      <Campo rotulo="Comentário" dica="O que o aluno le depois de responder.">
        <AreaTexto
          value={q.comentario ?? ''}
          onChange={(e) => setQ({ ...q, comentario: e.target.value })}
        />
      </Campo>

      {faltas.length > 0 && (
        <div className="rounded-pequeno border border-ouro/50 bg-ouro/10 px-4 py-3">
          <p className="font-corpo text-sm font-semibold text-ouro-tinta">
            Falta isto para publicar:
          </p>
          <ul className="mt-1 list-disc pl-5 font-corpo text-sm text-ouro-tinta">
            {faltas.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {erro && <Erro mensagem={erro.mensagem} detalhe={erro.detalhe} />}
      {aviso && (
        <p role="status" className="font-corpo text-sm font-semibold text-acao">
          {aviso}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Botao variante="secundaria" carregando={processando} onClick={() => salvar('precisa_revisao')}>
          Salvar e continuar depois
        </Botao>
        <Botao carregando={processando} disabled={faltas.length > 0} onClick={publicar}>
          Publicar
        </Botao>
      </div>
    </Cartao>
  )
}
