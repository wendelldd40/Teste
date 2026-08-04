'use server'

/**
 * Server Actions do admin.
 *
 * Cada action chama requireAdmin() de novo. Nao e redundancia: o guard do
 * layout barra a NAVEGACAO, mas uma action e um endpoint - da para chama-la
 * direto, sem passar por pagina nenhuma. Quem so esconde o menu deixa essa
 * porta aberta.
 *
 * Escrita usa o client de servidor (sessao do proprio usuario), entao a RLS
 * continua valendo como ultima linha. O client de service role nao aparece
 * aqui de proposito.
 */

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { getServerClient } from '@/lib/supabase/server'
import { AppError, normalizaErro } from '@/lib/errors'
import type { StatusRevisao } from '@/types/database'

export interface RetornoAction {
  ok: boolean
  mensagem?: string
  detalhe?: string
  id?: string
}

async function executar(
  contexto: string,
  fn: () => Promise<string | undefined>
): Promise<RetornoAction> {
  try {
    await requireAdmin()
    const id = await fn()
    return { ok: true, id }
  } catch (e) {
    const erro = e instanceof AppError ? e : normalizaErro(e, contexto)
    return { ok: false, mensagem: erro.message, detalhe: erro.detalhe }
  }
}

// ---------------------------------------------------------------------------
// Materias
// ---------------------------------------------------------------------------

export async function salvarMateria(
  id: string,
  campos: {
    nome?: string
    descricao?: string | null
    imagem_url?: string | null
    imagem_alt?: string | null
    ativa?: boolean
    ordem?: number
  }
): Promise<RetornoAction> {
  return executar('admin.salvarMateria', async () => {
    const sb = await getServerClient()
    const { error } = await sb.from('materias').update(campos).eq('id', id)
    if (error) throw error
    revalidatePath('/admin/materias')
    revalidatePath('/estudar')
    return id
  })
}

/**
 * A imagem ja chega cortada em 16:9 e convertida para WebP pelo navegador
 * (lib/imagem.ts). Aqui so gravamos e apontamos a materia para ela.
 */
export async function salvarImagemMateria(
  materiaId: string,
  caminho: string,
  arquivo: File,
  textoAlternativo: string
): Promise<RetornoAction> {
  return executar('admin.salvarImagemMateria', async () => {
    const sb = await getServerClient()

    const { error: erroUpload } = await sb.storage
      .from('materias')
      .upload(caminho, arquivo, { contentType: 'image/webp', upsert: true })
    if (erroUpload) throw erroUpload

    const {
      data: { publicUrl },
    } = sb.storage.from('materias').getPublicUrl(caminho)

    const { error } = await sb
      .from('materias')
      .update({ imagem_url: publicUrl, imagem_alt: textoAlternativo })
      .eq('id', materiaId)
    if (error) throw error

    revalidatePath('/admin/materias')
    revalidatePath('/estudar')
    return publicUrl
  })
}

// ---------------------------------------------------------------------------
// Assuntos
// ---------------------------------------------------------------------------

export async function salvarAssunto(dados: {
  id?: string
  materia_id: string
  nome: string
  slug: string
  parent_id?: string | null
  ordem?: number
}): Promise<RetornoAction> {
  return executar('admin.salvarAssunto', async () => {
    const sb = await getServerClient()
    const { id, ...campos } = dados

    if (id) {
      const { error } = await sb.from('assuntos').update(campos).eq('id', id)
      if (error) throw error
      revalidatePath('/admin/assuntos')
      return id
    }

    const { data, error } = await sb.from('assuntos').insert(campos).select('id').single()
    if (error) throw error
    revalidatePath('/admin/assuntos')
    return data.id
  })
}

export async function removerAssunto(id: string): Promise<RetornoAction> {
  return executar('admin.removerAssunto', async () => {
    const sb = await getServerClient()
    const { error } = await sb.from('assuntos').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/admin/assuntos')
    return id
  })
}

// ---------------------------------------------------------------------------
// Questoes
// ---------------------------------------------------------------------------

export async function salvarQuestao(dados: {
  id?: string
  materia_id: string
  tipo: string
  dificuldade: string
  enunciado: string
  comentario: string | null
  status: StatusRevisao
  alternativas: Array<{ letra: string; texto: string; correta: boolean }>
  assertivas: Array<{ ordem: number; numeral: string; texto: string; correta: boolean | null }>
  assunto_ids: string[]
}): Promise<RetornoAction> {
  return executar('admin.salvarQuestao', async () => {
    const sb = await getServerClient()
    const { data, error } = await sb.rpc('admin_salvar_questao', {
      p_dados: dados as unknown as Record<string, unknown>,
    })
    if (error) throw error
    revalidatePath('/admin/revisao')
    return data as string
  })
}

/**
 * Publicar pode falhar por regra do banco: questao sem 5 alternativas ou sem
 * gabarito unico e recusada pelo trigger. O erro sobe ate a tela - engolir
 * aqui daria a impressao de que publicou.
 */
export async function publicarQuestao(id: string): Promise<RetornoAction> {
  return executar('admin.publicarQuestao', async () => {
    const sb = await getServerClient()
    const { error } = await sb.rpc('admin_publicar_questao', { p_questao: id })
    if (error) throw error
    revalidatePath('/admin/revisao')
    revalidatePath('/simulados')
    return id
  })
}
